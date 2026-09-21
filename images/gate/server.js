/**
 * Auth + readiness gate in front of Ollama.
 *
 * Ollama has no authentication of any kind, so this is what stands between the
 * model server and the public internet. It also decides whether this instance
 * is fit to serve: FDM health-checks the published port, so returning 503 while
 * the engine is still downloading weights keeps a freshly-migrated instance out
 * of the load balancer's rotation until it can actually answer.
 *
 * No dependencies: node:http plus global fetch.
 */
const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const UPSTREAM = process.env.UPSTREAM || 'http://127.0.0.1:11434';
const API_KEY = process.env.API_KEY || '';
const REQUIRED = (process.env.MODELS || '').split(/[\s,]+/).filter(Boolean);
const READY_POLL_MS = 15000;

if (!API_KEY) {
  console.error('API_KEY is not set - refusing to start an unauthenticated gate');
  process.exit(1);
}

let ready = false;
let readyDetail = 'starting';
// Requests currently being served, reported on the health line so a router
// can see real load. The hub keeps its own in-flight count per hub instance,
// but three hub instances do not share it: each thought a gpt-oss node was
// idle and all sent it a ten-minute prompt at once (OLLAMA_NUM_PARALLEL=1),
// so the second and third queued behind the first.
let inflight = 0;
let digest = '';    // first 12 hex of the served model's blob digest
let served = '';    // its tag, for readability

/**
 * Keep the common prompt prefix warm in the engine's KV cache.
 *
 * Every request from the Flux Cloud UI starts with the same ~1k tokens of
 * system prompt and tool schema, and on a CPU node that prefix costs 10-14 s
 * to read. llama.cpp reuses a slot's cache for any request sharing its prefix,
 * so if one slot always holds that prefix, a new conversation pays only for
 * its own words - measured here as 13 s falling to 3 s.
 *
 * WARM_URL points at a JSON body ({model, messages, tools}); the gate replays
 * it with one predicted token every WARM_MS. The first replay after a restart
 * pays the full prefill, the rest are ~0.1 s.
 */
const WARM_URL = process.env.WARM_URL || '';
const WARM_MS = Number(process.env.WARM_MS || 120000);
let warmBody = null;
let warmState = 'off';
async function warmOnce() {
  if (!WARM_URL || inflight > 0) return;              // never compete with a real request
  try {
    if (!warmBody) {
      const r = await fetch(WARM_URL, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`warm payload ${r.status}`);
      warmBody = await r.json();
    }
    const body = { ...warmBody, stream: false, options: { ...(warmBody.options || {}), num_predict: 1 } };
    const t0 = Date.now();
    const res = await fetch(`${UPSTREAM}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(300000),
    });
    warmState = res.ok ? `warm ${Date.now() - t0}ms` : `warm failed ${res.status}`;
  } catch (err) {
    warmState = `warm error: ${String(err.message).slice(0, 60)}`;
  }
}

// Readiness is "every required model is actually pulled", not "ollama answers".
// Ollama replies 200 on /api/tags from the moment it boots, long before a 13 GB
// download finishes, so tags-is-up would put a useless instance into rotation.
async function pollReady() {
  try {
    const res = await fetch(`${UPSTREAM}/api/tags`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`tags ${res.status}`);
    const { models = [] } = await res.json();
    const have = new Set(models.map((m) => m.name));
    // Report the digest of the model we serve, so "which weights is this node
    // running?" has an answer that cannot be forged by naming. A tag can be
    // pointed anywhere - during the v5 rollout an alias created by hand made
    // several nodes advertise "fluxai:tiny-v5" while still serving v4 - but the
    // digest comes from the blob itself.
    const first = models.find((m) => REQUIRED.length && m.name.split(':')[0] === REQUIRED[0].split(':')[0]) || models[0];
    digest = first && first.digest ? String(first.digest).slice(0, 12) : '';
    served = first ? first.name : '';
    const missing = REQUIRED.filter(
      (m) => !have.has(m) && !have.has(`${m}:latest`) && ![...have].some((h) => h.split(':')[0] === m.split(':')[0]),
    );
    ready = missing.length === 0;
    readyDetail = ready ? `${have.size} model(s) loaded` : `pulling: ${missing.join(', ')}`;
  } catch (err) {
    ready = false;
    readyDetail = `engine unreachable: ${err.message}`;
  }
}
pollReady();
setInterval(pollReady, READY_POLL_MS).unref();
if (WARM_URL) {
  // only once the model is actually present, or the first warm wastes a pull wait
  const kick = setInterval(() => { if (ready) warmOnce(); }, WARM_MS);
  kick.unref();
}

// Constant-time compare so the key cannot be recovered by timing the response.
function authorized(req) {
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (given.length !== API_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ API_KEY.charCodeAt(i);
  return diff === 0;
}


/**
 * Upstream request over node:http rather than fetch. Node's fetch (undici)
 * gives up if response headers have not arrived within 300 s, and ollama
 * sends headers only after prefill - a 10k-token prompt on CPU takes longer
 * than that, so every long agent turn died as "fetch failed" at 300 s (twice,
 * with the retry: 600 s). http.request has no such clock; the only limit is
 * the explicit total one.
 */
function upstreamRequest(url, { method = 'GET', headers = {}, body, timeoutMs = 900000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
      clearTimeout(timer);
      resolve({ status: res.statusCode, headers: res.headers, body: res, destroy: () => res.destroy(), text: () => new Promise((ok) => { const parts = []; res.on('data', (d) => parts.push(d)); res.on('end', () => ok(Buffer.concat(parts).toString('utf8'))); res.on('error', () => ok('')); }) });
    });
    const timer = setTimeout(() => { req.destroy(new Error(`upstream timeout after ${timeoutMs} ms`)); }, timeoutMs);
    req.on('error', (err) => { clearTimeout(timer); reject(err); });
    if (body && typeof body.pipe === 'function') body.pipe(req); else req.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  // Unauthenticated, because FDM's health check cannot carry a bearer token.
  // It exposes only readiness, never anything about the models or the key.
  //
  // '/' matters most: FDM is HAProxy, and an app with no custom entry gets
  // `option httpchk` + `http-check send meth GET uri /` (flux-domain-manager,
  // src/services/application/custom.js). Answering 401 there - which is what
  // requiring the bearer token on every path would do - marks the backend down
  // for good. '/health' is the path FDM's custom entries use; '/healthz' is
  // kept because things may already point at it.
  if (req.url === '/' || req.url === '/health' || req.url === '/healthz') {
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'text/plain', 'X-Inflight': String(inflight) });
    res.end(ready ? `ok inflight=${inflight}${served ? ` model=${served}` : ''}${digest ? ` digest=${digest}` : ''}${WARM_URL ? ` ${warmState}` : ''}` : readyDetail);
    return;
  }

  if (!authorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end('{"error":"unauthorized"}');
    return;
  }

  // Management calls from an authenticated client are allowed before the
  // instance is ready - pulling a model is how it becomes ready, and refusing
  // the pull because the model is missing locked an operator out for good.
  const management = /^\/api\/(pull|delete|tags|ps|show)(\?|$)/.test(req.url);
  if (!ready && !(management && authorized(req))) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
    res.end(JSON.stringify({ error: 'model not ready on this instance', detail: readyDetail }));
    return;
  }

  inflight += 1;
  res.on('close', () => { inflight -= 1; });
  try {
    const upstream = await upstreamRequest(`${UPSTREAM}${req.url}`, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json', ...(req.headers['content-length'] ? { 'Content-Length': req.headers['content-length'] } : { 'Transfer-Encoding': 'chunked' }) },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      // CPU inference is slow, and a request may also queue behind another
      // on this instance; a long generation must not be cut short.
      timeoutMs: 1800000,
    });
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers['content-type'] || 'application/json',
    });
    // Streamed token-by-token so the client sees output as it is generated.
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (err) {
    console.log(`${req.method} ${req.url}: upstream failed: ${err.message.slice(0, 120)}`);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(res.headersSent ? undefined : JSON.stringify({ error: 'upstream failed', detail: err.message }));
  }
});

server.headersTimeout = 1800000;
server.requestTimeout = 1800000;
server.listen(PORT, () => console.log(`gate listening on :${PORT} -> ${UPSTREAM}`));
