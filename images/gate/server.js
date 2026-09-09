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

// Readiness is "every required model is actually pulled", not "ollama answers".
// Ollama replies 200 on /api/tags from the moment it boots, long before a 13 GB
// download finishes, so tags-is-up would put a useless instance into rotation.
async function pollReady() {
  try {
    const res = await fetch(`${UPSTREAM}/api/tags`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`tags ${res.status}`);
    const { models = [] } = await res.json();
    const have = new Set(models.map((m) => m.name));
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

// Constant-time compare so the key cannot be recovered by timing the response.
function authorized(req) {
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (given.length !== API_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ API_KEY.charCodeAt(i);
  return diff === 0;
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
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'text/plain' });
    res.end(ready ? 'ok' : readyDetail);
    return;
  }

  if (!authorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end('{"error":"unauthorized"}');
    return;
  }

  if (!ready) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
    res.end(JSON.stringify({ error: 'model not ready on this instance', detail: readyDetail }));
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}${req.url}`, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      duplex: 'half',
      // CPU inference is slow; a long generation must not be cut short.
      signal: AbortSignal.timeout(900000),
    });
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    if (upstream.body) {
      const reader = upstream.body.getReader();
      // Streamed token-by-token so the client sees output as it is generated.
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream failed', detail: err.message }));
  }
});

server.headersTimeout = 900000;
server.requestTimeout = 900000;
server.listen(PORT, () => console.log(`gate listening on :${PORT} -> ${UPSTREAM}`));
