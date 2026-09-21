/**
 * Hub: one OpenAI-compatible endpoint in front of many model pools on Flux.
 *
 * A pool is a Flux application running the gate + engine pair (tools/gen.js
 * --api-only). The hub maps a model name to a pool, discovers that pool's
 * instances from the Flux API, and sends each request to the least busy
 * healthy instance - the same routing the docs router does, per model.
 * Clients see a single base URL, one API key, and /v1/models listing every
 * model the pools serve; pools scale, migrate and get replaced underneath
 * without any client noticing.
 *
 * Keys are stateless. A key is "sk-flux-<name>-<sig>" where sig is an HMAC of
 * the name under HUB_SECRET; every instance verifies it with no shared store,
 * which is the only kind of state a multi-instance Flux app can have. Revoke a
 * name with REVOKED, rotate everything with a new secret. Per-key limits
 * (requests per minute, concurrent requests) are enforced per instance, and
 * usage counters are per instance too - /admin/usage shows this instance's
 * view, and FDM spreads clients over instances, so treat the numbers as a
 * sample rather than a ledger.
 *
 * Environment (each value under Flux's 400-character cap):
 *   POOLS          model=app:port[,model=app:port...]  a model may be an alias
 *                  "alias=name@app:port" when the pool knows it by another name
 *   UPSTREAM_KEY   gate key shared by the pools generated for the hub
 *   UPSTREAM_KEYS  app=key[,app=key] overrides for pools with their own key
 *   HUB_SECRET     master secret for API keys (required)
 *   ADMIN_KEY      bearer for /admin/*; defaults to the key named "admin"
 *   KEY_RPM        sustained requests per minute per key (default 120)
 *   KEY_BURST      how many may arrive at once before the rate applies (20)
 *   KEY_CONCURRENCY concurrent requests per key (default 6)
 *   KEY_LIMITS     name:rpm:concurrency[:burst][,...] per-key overrides
 *   PUBLIC_IP_RPM  for the shared PUBLIC_KEY_NAME key, an extra per-visitor
 *                  limit (rpm, default 8; burst PUBLIC_IP_BURST 4; one at a
 *                  time), so one script cannot use the demo key up for all
 *   REVOKED        comma-separated key names that no longer work
 *   THINK_OFF      models whose thinking is switched off unless the client
 *                  asks for it (reasoning_effort on /v1, think on /api): a
 *                  small reasoning model on CPU otherwise spends its whole
 *                  budget thinking and answers nothing
 *   ALLOWED_ORIGINS hostnames allowed to call from a browser ("*" = any)
 *   PUBLIC_KEY_NAME name of a key the front page hands out (a demo key with
 *                  tight KEY_LIMITS); empty = the page shows none
 *
 * No dependencies: node:http, node:crypto, global fetch.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');

const PORT = Number(process.env.PORT || 8080);
// Comma-separated; tried in order. Every Flux node also answers the same
// query on :16127, and every pool instance runs on a Flux node, so once one
// lookup has succeeded the pool IPs themselves are fallback API hosts - one
// hub instance sat on a node that could not reach api.runonflux.io at all.
const FLUX_APIS = (process.env.FLUX_API || 'https://api.runonflux.io').split(',').map(s => s.trim()).filter(Boolean);
const DISCOVER_MS = Number(process.env.DISCOVER_MS || 60000);
const PROBE_MS = Number(process.env.PROBE_MS || 20000);
const HUB_SECRET = process.env.HUB_SECRET || '';
const KEY_RPM = Number(process.env.KEY_RPM || 120);
const KEY_BURST = Number(process.env.KEY_BURST || 20);
const KEY_CONCURRENCY = Number(process.env.KEY_CONCURRENCY || 6);
const PUBLIC_IP_RPM = Number(process.env.PUBLIC_IP_RPM || 8);
const PUBLIC_IP_BURST = Number(process.env.PUBLIC_IP_BURST || 4);
const THINK_OFF = new Set((process.env.THINK_OFF || '').split(',').map(s => s.trim()).filter(Boolean));
const REVOKED = new Set((process.env.REVOKED || '').split(',').map(s => s.trim()).filter(Boolean));
const EWMA = 0.3;
const MAX_BODY = 8 * 1024 * 1024;

if (!HUB_SECRET) {
  console.error('HUB_SECRET is not set - refusing to start a hub that would accept any key');
  process.exit(1);
}

/** model -> { upstreamModel, app, port } */
const models = new Map();
/** app -> { port, key, peers: Map<ip, peer> } */
const pools = new Map();
const UPSTREAM_KEYS = new Map((process.env.UPSTREAM_KEYS || '').split(',').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
for (const entry of (process.env.POOLS || '').split(',').map(s => s.trim()).filter(Boolean)) {
  const m = /^([^=]+)=(?:([^@]+)@)?([^:]+):(\d+)$/.exec(entry);
  if (!m) { console.error(`bad POOLS entry: ${entry}`); process.exit(1); }
  const [, name, upstreamModel, app, port] = m;
  models.set(name, { upstreamModel: upstreamModel || name, app, port: Number(port) });
  if (!pools.has(app)) pools.set(app, { port: Number(port), key: UPSTREAM_KEYS.get(app) || process.env.UPSTREAM_KEY || '', peers: new Map() });
}
if (!models.size) { console.error('POOLS is empty'); process.exit(1); }

const KEY_LIMITS = new Map((process.env.KEY_LIMITS || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const [name, rpm, conc, burst] = s.split(':');
  return [name, { rpm: Number(rpm) || KEY_RPM, concurrency: Number(conc) || KEY_CONCURRENCY, burst: Number(burst) || Math.max(1, Math.min(KEY_BURST, Number(rpm) || KEY_RPM)) }];
}));

/**
 * Token bucket: `burst` tokens to start, refilled at `rpm` per minute. A
 * client that sends a burst of requests gets them through; one that keeps
 * going settles to the sustained rate; neither sees the "fixed window"
 * cliff where the 11th request of a quiet minute is refused.
 */
function takeToken(b, rpm, burst, now) {
  if (b.tokens === undefined) { b.tokens = burst; b.at = now; }
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 60000) * rpm);
  b.at = now;
  if (b.tokens >= 1) { b.tokens -= 1; return 0; }
  return Math.ceil(((1 - b.tokens) / rpm) * 60); // seconds until a token exists
}

// --- API keys ---------------------------------------------------------------

function sign(name) {
  return crypto.createHmac('sha256', HUB_SECRET).update(name).digest('base64url').slice(0, 24);
}
/** "sk-flux-<name>-<sig>" -> name, or null. Constant-time on the signature. */
function keyName(token) {
  const m = /^sk-flux-([a-z0-9][a-z0-9-]{0,31})-([A-Za-z0-9_-]{24})$/.exec(token || '');
  if (!m) return null;
  const expect = Buffer.from(sign(m[1]));
  const given = Buffer.from(m[2]);
  if (expect.length !== given.length || !crypto.timingSafeEqual(expect, given)) return null;
  if (REVOKED.has(m[1])) return null;
  return m[1];
}
/**
 * Scoped keys: "sk-fluxs-<payload>-<sig>", payload = base64url of
 * {n:name, o:[origin hosts], m:[model ids], e:expiry unix seconds}, signed the
 * same way. They exist so a key can be shipped in a browser bundle: it works
 * only from the listed origins, only for the listed models, and only until it
 * expires. Nothing is stored, so any instance verifies any key.
 *
 * Honest about the limit: a browser sends Origin and cannot forge it, so this
 * stops another site from using a leaked key, but any server-side caller can
 * set the header by hand. It narrows casual misuse; it is not a substitute for
 * proxying through your own backend when the traffic must really be yours.
 */
function scopedKey(token) {
  const m = /^sk-fluxs-([A-Za-z0-9_-]{8,512})-([A-Za-z0-9_-]{24})$/.exec(token || '');
  if (!m) return null;
  const expect = Buffer.from(sign(m[1]));
  const given = Buffer.from(m[2]);
  if (expect.length !== given.length || !crypto.timingSafeEqual(expect, given)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!claims || typeof claims.n !== 'string') return null;
  if (REVOKED.has(claims.n)) return null;
  return claims;
}
/** null when allowed, else the reason to refuse. */
function scopeDenied(claims, origin, modelId) {
  if (claims.e && Date.now() / 1000 > claims.e) return 'API key has expired';
  if (Array.isArray(claims.o) && claims.o.length) {
    if (!origin) return 'this API key may only be used from a browser on an allowed origin';
    let host;
    try { host = new URL(origin).hostname.toLowerCase(); } catch { return 'bad Origin header'; }
    if (!claims.o.some(h => host === h || host === `www.${h}`)) return `origin ${host} is not allowed for this API key`;
  }
  if (Array.isArray(claims.m) && claims.m.length && modelId && !claims.m.includes(modelId)) {
    return `this API key may not use model ${modelId}`;
  }
  return null;
}
const ADMIN_KEY = process.env.ADMIN_KEY || `sk-flux-admin-${sign('admin')}`;
const PUBLIC_KEY = process.env.PUBLIC_KEY_NAME ? `sk-flux-${process.env.PUBLIC_KEY_NAME}-${sign(process.env.PUBLIC_KEY_NAME)}` : '';
// The front page: what this is, live model status, quick start, a try-it box.
// Served at / to browsers; FDM's health check and curl get the text version.
const PAGE = (() => { try { return fs.readFileSync(`${__dirname}/index.html`, 'utf8'); } catch { return null; } })();
const VERSION = process.env.HUB_VERSION || '';
function isAdmin(token) {
  const a = Buffer.from(ADMIN_KEY); const b = Buffer.from(token || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** name -> { tokens, at (bucket), inflight, requests, promptTokens, completionTokens, last, byModel, sticky } */
const usage = new Map();
function account(name) {
  if (!usage.has(name)) usage.set(name, { inflight: 0, requests: 0, promptTokens: 0, completionTokens: 0, errors: 0, last: 0, byModel: {}, sticky: {} });
  return usage.get(name);
}
function limitsFor(name) { return KEY_LIMITS.get(name) || { rpm: KEY_RPM, concurrency: KEY_CONCURRENCY, burst: KEY_BURST }; }
/** visitor ip -> bucket, for the shared public key only; pruned hourly. */
const visitors = new Map();
setInterval(() => { const cut = Date.now() - 3600000; for (const [ip, v] of visitors) if (v.at < cut && !v.inflight) visitors.delete(ip); }, 600000).unref();
const clientIp = (req) => (req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?');

// --- pools ------------------------------------------------------------------

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

let lastDiscovery = 'never';
async function locate(app) {
  const known = [...new Set([...pools.values()].flatMap(pool => [...pool.peers.values()].map(p => p.api).filter(Boolean)))];
  const hosts = [...FLUX_APIS, ...known.sort(() => Math.random() - 0.5).slice(0, 3)];
  let lastErr = null;
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/apps/location/${app}`, { signal: AbortSignal.timeout(15000) });
      const body = await res.json();
      if (body.status !== 'success' || !Array.isArray(body.data)) throw new Error(`${host}: ${JSON.stringify(body).slice(0, 80)}`);
      lastDiscovery = `${new Date().toISOString()} via ${host}`;
      // ip is "host:fluxos-api-port" (16127, or another port on a host that
      // runs several nodes); remember the API endpoint for fallback lookups.
      return body.data.map(i => ({ ip: i.ip.split(':')[0], api: `http://${i.ip.includes(':') ? i.ip : `${i.ip}:16127`}` }));
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('no API host');
}

async function discover() {
  await Promise.all([...pools.entries()].map(async ([app, pool]) => {
    try {
      const found = await locate(app);
      const ips = found.map(f => f.ip);
      for (const f of found) {
        if (!pool.peers.has(f.ip)) pool.peers.set(f.ip, { healthy: false, inflight: 0, latencyMs: 0, detail: 'new', api: f.api });
        else pool.peers.get(f.ip).api = f.api;
      }
      for (const ip of [...pool.peers.keys()]) if (!ips.includes(ip) && pool.peers.get(ip).inflight === 0) pool.peers.delete(ip);
    } catch (err) {
      console.log(`discovery of ${app} failed, keeping ${pool.peers.size} known: ${err.message}`);
    }
  }));
}

async function probe() {
  await Promise.all([...pools.values()].flatMap(pool => [...pool.peers.entries()].map(async ([ip, p]) => {
    const started = Date.now();
    try {
      const res = await fetch(`http://${ip}:${pool.port}/health`, { signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      const rtt = Date.now() - started;
      // Network round trip only. This used to share one field with real request
      // timings, and since probes are frequent and fast they kept pulling a slow
      // node's average back down - a node taking 230 s to answer still looked
      // like a 300 ms node, so routing kept choosing it.
      p.probeMs = p.probeMs ? p.probeMs * (1 - EWMA) + rtt * EWMA : rtt;
      p.latencyMs = p.probeMs;
      p.healthy = res.status === 200;
      p.detail = text.slice(0, 60);
      // The gate reports its own in-flight count (1.4.31+): load from every
      // hub instance, not just this one. Unknown on older gates.
      const m = /inflight=(\d+)/.exec(text);
      p.remoteInflight = m ? Number(m[1]) : undefined;
      // The gate benchmarks its own node hourly with a cache-defeating prompt
      // and publishes the prefill rate (gate 1.4.35+). This is the only signal
      // that reaches an idle node before a user does.
      const b = /bench=(\d+)/.exec(text);
      p.benchTps = b ? Number(b[1]) : p.benchTps;
    } catch (err) {
      p.healthy = false;
      p.detail = err.message.slice(0, 60);
    }
  })));
}

/**
 * The instance a key used last for this pool, if it is healthy and idle;
 * otherwise the least busy healthy instance, latency breaking ties.
 *
 * Sticky first because of the prompt cache: an agent harness re-sends the
 * whole conversation on every tool call, and ollama reuses the KV cache only
 * when the request lands on the instance that saw the prefix. Same instance:
 * a few hundred new tokens of prefill. Any other: the full 20k again, minutes
 * on CPU. A busy sticky instance is not waited for - a session with two
 * requests in flight is already paying for it.
 */
// Busy-ness as this hub sees it: its own in-flight count, or the gate's
// reported one when that is higher (requests from the other hub instances).
const load = (p) => Math.max(p.inflight, p.remoteInflight || 0);
// How busy a sticky instance may be before we give up its warm cache. 0 was
// too strict once conversations (not API keys) became the sticky unit: a node
// serving one other turn still answers far faster than a cold node re-reading
// a 1k-token tool schema, which costs 10-14 s on a CPU node.
const STICKY_MAX_LOAD = Number(process.env.STICKY_MAX_LOAD || 1);
function pick(pool, exclude, prefer) {
  if (prefer && prefer !== exclude) {
    const p = pool.peers.get(prefer);
    if (p && p.healthy && load(p) <= STICKY_MAX_LOAD) return prefer;
  }
  const healthy = [...pool.peers.entries()].filter(([ip, p]) => p.healthy && ip !== exclude);
  if (!healthy.length) return null;
  // Speed as measured by real requests, not by pings. Nodes vary by 20x on this
  // pool - the same 1k-token prompt took 12 s on one and 230 s on another - and
  // an unmeasured node is given the median so it gets tried without being
  // preferred blindly.
  const seen = healthy.map(([, p]) => p.serveMs).filter((v) => v > 0).sort((a, b) => a - b);
  const median = seen.length ? seen[Math.floor(seen.length / 2)] : 0;
  // Prefer what real requests measured; for a node nothing has been sent to,
  // fall back to its self-benchmark (tokens/s, so invert into ms-per-1k) before
  // resorting to the median. That way a slow idle node is avoided from the
  // start rather than after it has spoiled someone's first impression.
  const speed = (p) => p.serveMs || (p.benchTps ? 1000000 / p.benchTps : 0) || median || p.probeMs || 0;
  healthy.sort(([, a], [, b]) => (load(a) - load(b)) || (speed(a) - speed(b)));
  return healthy[0][0];
}

/**
 * Which conversation a request belongs to, for prompt-cache stickiness.
 *
 * Stickiness used to be per API key, which is right for one user with one key
 * and wrong for a UI where every visitor shares one key: all of them pinned to
 * one instance, and each turn evicted the previous conversation's cache. The
 * unit that matters is the conversation, because that is what shares a prefix.
 *
 * `user` is the OpenAI-standard field and the best signal when the client sets
 * it. Otherwise the system message plus the first user turn identify a
 * conversation and stay identical as it grows.
 */
function conversationKey(body) {
  if (body && typeof body.user === 'string' && body.user) return `u:${body.user}`;
  const msgs = Array.isArray(body && body.messages) ? body.messages : [];
  const sys = msgs.find((m) => m && m.role === 'system');
  const first = msgs.find((m) => m && m.role === 'user');
  const basis = `${(sys && typeof sys.content === 'string' ? sys.content : '').slice(0, 200)}|${(first && typeof first.content === 'string' ? first.content : '').slice(0, 200)}`;
  return basis.trim() ? `c:${crypto.createHash('sha256').update(basis).digest('base64url').slice(0, 16)}` : '';
}
/** Per-account conversation -> instance, capped so a busy key cannot grow it without bound. */
const STICKY_MAX = Number(process.env.STICKY_MAX || 500);
function stickyGet(acct, app, conv) {
  const m = acct.sticky[app];
  if (!m || !conv) return undefined;
  const hit = m.get(conv);
  if (!hit) return undefined;
  m.delete(conv); m.set(conv, hit);   // LRU touch
  return hit;
}
function stickySet(acct, app, conv, ip) {
  if (!conv) return;
  if (!(acct.sticky[app] instanceof Map)) acct.sticky[app] = new Map();
  const m = acct.sticky[app];
  m.delete(conv); m.set(conv, ip);
  while (m.size > STICKY_MAX) m.delete(m.keys().next().value);
}

/** Exact, then case-insensitive, then "-" for ":" (OpenAI clients that reject colons). */
function resolveModel(name) {
  if (!name) return null;
  if (models.has(name)) return name;
  const lc = String(name).toLowerCase();
  for (const k of models.keys()) if (k.toLowerCase() === lc) return k;
  for (const k of models.keys()) if (k.toLowerCase().replace(/:/g, '-') === lc.replace(/:/g, '-')) return k;
  return null;
}

// --- request handling -------------------------------------------------------

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim().toLowerCase()).filter(Boolean);
function originAllowed(origin) {
  if (ALLOWED_ORIGINS.includes('*')) return true;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  return ALLOWED_ORIGINS.some(h => host === h || host === `www.${h}`);
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
  res.end(JSON.stringify(body));
}
function openaiError(res, status, message, type = 'invalid_request_error', extra = {}) {
  json(res, status, { error: { message, type } }, extra);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const modelList = () => [...models.keys()].map(id => ({ id, object: 'model', created: 0, owned_by: 'flux' }));

/** Paths that carry a model in the body and are forwarded to a pool. */
const FORWARD = /^\/(v1\/(chat\/completions|completions|embeddings)|api\/(chat|generate|embed|embeddings|show))(\?|$)/;

function healthSummary() {
  const out = {};
  for (const [app, pool] of pools) {
    const ps = [...pool.peers.values()];
    out[app] = { instances: ps.length, healthy: ps.filter(p => p.healthy).length, inflight: ps.reduce((n, p) => n + p.inflight, 0) };
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !originAllowed(origin)) return openaiError(res, 403, 'origin not allowed');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = req.url.split('?')[0];

  // Unauthenticated: FDM's health check carries no token.
  if (path === '/status.json') {
    // Public, no IPs: per-model instance and health counts for the front page.
    const out = {};
    for (const [id, m] of models) { const ps = [...pools.get(m.app).peers.values()]; out[id] = { pool: m.app, instances: ps.length, healthy: ps.filter(p => p.healthy).length, inflight: ps.reduce((n, p) => n + p.inflight, 0) }; }
    return json(res, 200, { models: out, version: VERSION }, { 'Cache-Control': 'no-store' });
  }
  if (path === '/' || path === '/health' || path === '/healthz') {
    const anyUp = [...pools.values()].some(pool => [...pool.peers.values()].some(p => p.healthy));
    if (path === '/' && PAGE && /text\/html/.test(req.headers.accept || '')) {
      res.writeHead(anyUp ? 200 : 503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(PAGE.replace('__CONFIG__', JSON.stringify({ publicKey: PUBLIC_KEY, version: VERSION })));
    }
    if (path === '/') {
      res.writeHead(anyUp ? 200 : 503, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`ownllm hub\n\nOpenAI-compatible API. Base URL: this origin + /v1\n`
        + `Authorization: Bearer sk-flux-<name>-<sig>\n\nmodels:\n${[...models.keys()].map(m => `  ${m}`).join('\n')}\n\n`
        + `pools: ${JSON.stringify(healthSummary())}\n`);
    }
    res.writeHead(anyUp ? 200 : 503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: anyUp, pools: healthSummary() }));
  }

  const token = bearer(req);
  if (path.startsWith('/admin/')) {
    if (!isAdmin(token)) return openaiError(res, 401, 'admin key required', 'authentication_error');
    if (path === '/admin/usage') {
      const keys = {};
      for (const [name, u] of usage) keys[name] = { requests: u.requests, promptTokens: u.promptTokens, completionTokens: u.completionTokens, errors: u.errors, inflight: u.inflight, last: u.last ? new Date(u.last).toISOString() : null, byModel: u.byModel, sticky: u.sticky, limits: limitsFor(name) };
      return json(res, 200, { instance: process.env.HOSTNAME || null, keys });
    }
    if (path === '/admin/status') {
      const out = { _discovery: lastDiscovery };
      for (const [app, pool] of pools) out[app] = { port: pool.port, models: [...models.entries()].filter(([, m]) => m.app === app).map(([k]) => k), peers: [...pool.peers.entries()].map(([ip, p]) => ({ ip, ...p })) };
      return json(res, 200, out);
    }
    return openaiError(res, 404, 'no such admin route');
  }

  const name = keyName(token);
  const claims = name ? null : scopedKey(token);
  if (!name && !claims && !isAdmin(token)) return openaiError(res, 401, 'invalid API key', 'authentication_error', { 'WWW-Authenticate': 'Bearer' });
  // A scoped key carries its own origin/model/expiry limits; check origin now
  // and the model once the body has been parsed.
  if (claims) {
    const why = scopeDenied(claims, origin, null);
    if (why) return openaiError(res, 403, why, 'authentication_error');
  }
  const keyId = name || (claims && claims.n) || 'admin';

  if (path === '/v1/models' && req.method === 'GET') return json(res, 200, { object: 'list', data: modelList() });
  const mm = /^\/v1\/models\/(.+)$/.exec(path);
  if (mm && req.method === 'GET') {
    const id = resolveModel(decodeURIComponent(mm[1]));
    return id ? json(res, 200, { id, object: 'model', created: 0, owned_by: 'flux' }) : openaiError(res, 404, `model not found: ${mm[1]}`);
  }
  if (path === '/api/tags' && req.method === 'GET') return json(res, 200, { models: [...models.keys()].map(m => ({ name: m, model: m })) });
  if (path === '/api/version') return json(res, 200, { version: 'ownllm-hub' });
  if (!FORWARD.test(path) || req.method !== 'POST') return openaiError(res, 404, `no such route: ${req.method} ${path}`);

  let raw; let body;
  try { raw = await readBody(req); body = JSON.parse(raw.toString('utf8') || '{}'); } catch (err) { return openaiError(res, 400, `invalid JSON body: ${err.message}`); }
  const modelId = resolveModel(body.model);
  const convKey = conversationKey(body);   // prompt-cache stickiness, see conversationKey()
  if (claims) {
    const why = scopeDenied(claims, origin, modelId || body.model);
    if (why) return openaiError(res, 403, why, 'authentication_error');
  }
  if (!modelId) return openaiError(res, 404, `model not found: ${body.model || '(none)'}. Available: ${[...models.keys()].join(', ')}`, 'invalid_request_error');
  const target = models.get(modelId);
  const pool = pools.get(target.app);

  // Per-key limits, per instance: a token bucket for rate, a counter for
  // concurrency. The shared public key also gets a bucket per visitor.
  const acct = account(keyId);
  const lim = limitsFor(keyId);
  const now = Date.now();
  const rl = (limit, remaining) => ({ 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(Math.max(0, Math.floor(remaining))) });
  if (acct.inflight >= lim.concurrency) return openaiError(res, 429, `Too many requests at once for this key: ${lim.concurrency} allowed in flight. Wait for one to finish.`, 'rate_limit_error', { 'Retry-After': '5', ...rl(lim.rpm, acct.tokens ?? lim.burst) });
  let visitor = null;
  if (process.env.PUBLIC_KEY_NAME && keyId === process.env.PUBLIC_KEY_NAME) {
    const ip = clientIp(req);
    visitor = visitors.get(ip) || visitors.set(ip, { inflight: 0 }).get(ip);
    if (visitor.inflight >= 1) return openaiError(res, 429, 'The shared demo key allows one request at a time per visitor. Wait for yours to finish, or ask for your own key.', 'rate_limit_error', { 'Retry-After': '5' });
    const waitIp = takeToken(visitor, PUBLIC_IP_RPM, PUBLIC_IP_BURST, now);
    if (waitIp) return openaiError(res, 429, `The shared demo key allows ${PUBLIC_IP_RPM} requests per minute per visitor. Retry in ${waitIp}s, or ask for your own key.`, 'rate_limit_error', { 'Retry-After': String(waitIp), ...rl(PUBLIC_IP_RPM, 0) });
  }
  const wait = takeToken(acct, lim.rpm, lim.burst, now);
  if (wait) return openaiError(res, 429, `Rate limit for this key: ${lim.rpm} requests per minute (bursts of ${lim.burst}). Retry in ${wait}s.`, 'rate_limit_error', { 'Retry-After': String(wait), ...rl(lim.rpm, 0) });
  res.setHeader('X-RateLimit-Limit', String(lim.rpm));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Math.floor(acct.tokens))));
  if (visitor) visitor.inflight += 1;

  body.model = target.upstreamModel;
  const isV1 = path.startsWith('/v1/');
  const streaming = !!body.stream;
  if (THINK_OFF.has(modelId)) {
    if (isV1 && body.reasoning_effort === undefined) body.reasoning_effort = 'none';
    if (!isV1 && body.think === undefined) body.think = false;
  }
  // Usage in the last chunk of a stream, so tokens can be counted here and the
  // client gets them too. Harmless for clients that ignore it.
  if (isV1 && streaming && path === '/v1/chat/completions' && !body.stream_options) body.stream_options = { include_usage: true };
  const payload = JSON.stringify(body);

  acct.inflight += 1; acct.requests += 1; acct.last = now;
  const per = acct.byModel[modelId] || (acct.byModel[modelId] = { requests: 0, promptTokens: 0, completionTokens: 0 });
  per.requests += 1;
  let tried = null;
  // A streaming request commits to 200 + its stream type before the upstream
  // is even contacted, because fetch() does not resolve until the engine
  // sends headers, and ollama sends them after prefill - the whole silent
  // stretch the heartbeat exists for. So for streams the heartbeat starts
  // now; an upstream error is then delivered inside the stream. Non-stream
  // requests cannot do that (the status must be right) and get no heartbeat.
  // Non-streaming requests get the same treatment with whitespace: a JSON
  // parser skips leading spaces, and the alternative - a 504 from the proxy
  // for every agent whose harness does not stream - is worse than the one
  // cost of committing early, which is that an engine error after prefill
  // arrives as an {"error":...} body under a 200 instead of its own status.
  const streamType = streaming ? (isV1 ? 'text/event-stream' : 'application/x-ndjson') : 'application/json';
  const filler = streamType === 'text/event-stream' ? ': keepalive\n\n' : streaming ? '\n' : ' ';
  let heartbeat = null;
  const streamError = (status, message) => {
    const err = { error: { message, type: status >= 500 ? 'server_error' : 'invalid_request_error', code: status } };
    res.write(!streaming ? JSON.stringify(err) : isV1 ? `data: ${JSON.stringify(err)}\n\ndata: [DONE]\n\n` : `${JSON.stringify(err)}\n`);
    res.end();
  };
  res.writeHead(200, { 'Content-Type': streamType, 'X-Model': modelId, 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  res.write(filler);
  heartbeat = setInterval(() => { if (!res.writableEnded) res.write(filler); }, 10000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ip = pick(pool, tried, stickyGet(acct, target.app, convKey));
      if (!ip) {
        acct.errors += 1;
        return streamError(503, `no healthy instance for ${modelId} (${target.app})`);
      }
      stickySet(acct, target.app, convKey, ip);
      const peer = pool.peers.get(ip);
      peer.inflight += 1;
      const started = Date.now();
      try {
        const upstream = await upstreamRequest(`http://${ip}:${pool.port}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Authorization: `Bearer ${pool.key}` },
          body: payload,
          timeoutMs: 1800000,
        });
        if ((upstream.status === 503 || upstream.status === 502) && attempt === 0) {
          // The instance is not ready (pulling) or its engine is gone: mark it
          // and try another before the client sees anything.
          console.log(`${modelId} ${ip}: upstream ${upstream.status} after ${Date.now() - started} ms, retrying elsewhere`);
          peer.healthy = false; peer.detail = `upstream ${upstream.status}`; tried = ip;
          try { upstream.destroy(); } catch { /* ignore */ }
          continue;
        }
        if (upstream.status >= 400) {
          // Already committed to a 200: relay the error in the body.
          const text = await upstream.text().catch(() => '');
          console.log(`${modelId} ${ip}: upstream ${upstream.status} after ${Date.now() - started} ms: ${text.slice(0, 120)}`);
          let msg = text.slice(0, 300); try { msg = JSON.parse(text).error?.message || JSON.parse(text).error || msg; } catch { /* raw */ }
          acct.errors += 1;
          if (heartbeat) clearInterval(heartbeat);
          return streamError(upstream.status, `upstream ${upstream.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        }
        let tail = '';
        for await (const chunk of upstream.body) {
          if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
          res.write(chunk);
          // Keep only the end of the response for token accounting: the
          // usage object is in the final chunk (SSE) or the final line
          // (ndjson) or the whole body (non-stream JSON).
          tail = (tail + chunk.toString('utf8')).slice(-4096);
        }
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        res.end();
        if (!tail.trim()) console.log(`${modelId} ${ip}: upstream ${upstream.status} ended with an empty body after ${Date.now() - started} ms`);
        countUsage(tail, acct, per);
        // How fast this node actually serves, normalised per 1k prompt tokens so
        // a long conversation does not look like a slow machine. Measured only
        // from real requests; the health probe cannot see inference speed.
        {
          const ms = Date.now() - started;
          const kTok = Math.max(0.25, (per.lastPromptTokens || 1000) / 1000);
          const perK = ms / kTok;
          peer.serveMs = peer.serveMs ? peer.serveMs * (1 - EWMA) + perK * EWMA : perK;
        }
        if (upstream.status >= 400) acct.errors += 1;
        return;
      } catch (err) {
        console.log(`${modelId} ${ip}: request failed after ${Date.now() - started} ms (attempt ${attempt + 1}): ${err.message.slice(0, 100)}`);
        peer.healthy = false; peer.detail = `request failed: ${err.message.slice(0, 50)}`;
        if (attempt === 1) {
          acct.errors += 1;
          if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
          return streamError(502, `upstream failed: ${err.message.slice(0, 80)}`);
        }
        tried = ip;
      } finally {
        peer.inflight -= 1;
      }
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    acct.inflight -= 1;
    if (visitor) visitor.inflight -= 1;
  }
});

/** Pull prompt/completion token counts out of the response tail, any format. */
function countUsage(tail, acct, per) {
  let prompt = 0; let completion = 0;
  // OpenAI shape ("usage" carries nested objects, so match the fields, not the
  // object) or ollama's native counters.
  const pt = /"prompt_tokens"\s*:\s*(\d+)/.exec(tail); const ct = /"completion_tokens"\s*:\s*(\d+)/.exec(tail);
  if (pt || ct) { prompt = Number(pt ? pt[1] : 0); completion = Number(ct ? ct[1] : 0); } else {
    const p = /"prompt_eval_count"\s*:\s*(\d+)/.exec(tail); const c = /(?<!prompt_)"eval_count"\s*:\s*(\d+)/.exec(tail);
    if (p) prompt = Number(p[1]); if (c) completion = Number(c[1]);
  }
  acct.promptTokens += prompt; acct.completionTokens += completion;
  per.promptTokens += prompt; per.completionTokens += completion;
  per.lastPromptTokens = prompt || per.lastPromptTokens;   // normalises the speed measure in pick()
}

server.headersTimeout = 1800000;
server.requestTimeout = 1800000;
server.listen(PORT, () => console.log(`hub on :${PORT}: ${models.size} model(s) over ${pools.size} pool(s): ${[...models.keys()].join(', ')}`));

discover().then(probe);
setInterval(discover, DISCOVER_MS).unref();
setInterval(probe, PROBE_MS).unref();
