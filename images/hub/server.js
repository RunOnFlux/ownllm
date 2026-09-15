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
 *   KEY_RPM        requests per minute per key (default 60)
 *   KEY_CONCURRENCY concurrent requests per key (default 4)
 *   KEY_LIMITS     name:rpm:concurrency[,...] per-key overrides
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
const KEY_RPM = Number(process.env.KEY_RPM || 60);
const KEY_CONCURRENCY = Number(process.env.KEY_CONCURRENCY || 4);
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
  const [name, rpm, conc] = s.split(':');
  return [name, { rpm: Number(rpm) || KEY_RPM, concurrency: Number(conc) || KEY_CONCURRENCY }];
}));

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

/** name -> { window: number[], inflight, requests, promptTokens, completionTokens, last, byModel, sticky } */
const usage = new Map();
function account(name) {
  if (!usage.has(name)) usage.set(name, { window: [], inflight: 0, requests: 0, promptTokens: 0, completionTokens: 0, errors: 0, last: 0, byModel: {}, sticky: {} });
  return usage.get(name);
}
function limitsFor(name) { return KEY_LIMITS.get(name) || { rpm: KEY_RPM, concurrency: KEY_CONCURRENCY }; }

// --- pools ------------------------------------------------------------------

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
      p.latencyMs = p.latencyMs ? p.latencyMs * (1 - EWMA) + rtt * EWMA : rtt;
      p.healthy = res.status === 200;
      p.detail = text.slice(0, 60);
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
function pick(pool, exclude, prefer) {
  if (prefer && prefer !== exclude) {
    const p = pool.peers.get(prefer);
    if (p && p.healthy && p.inflight === 0) return prefer;
  }
  const healthy = [...pool.peers.entries()].filter(([ip, p]) => p.healthy && ip !== exclude);
  if (!healthy.length) return null;
  healthy.sort(([, a], [, b]) => (a.inflight - b.inflight) || (a.latencyMs - b.latencyMs));
  return healthy[0][0];
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
  if (!name && !isAdmin(token)) return openaiError(res, 401, 'invalid API key', 'authentication_error', { 'WWW-Authenticate': 'Bearer' });
  const keyId = name || 'admin';

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
  if (!modelId) return openaiError(res, 404, `model not found: ${body.model || '(none)'}. Available: ${[...models.keys()].join(', ')}`, 'invalid_request_error');
  const target = models.get(modelId);
  const pool = pools.get(target.app);

  // Per-key limits, per instance.
  const acct = account(keyId);
  const lim = limitsFor(keyId);
  const now = Date.now();
  acct.window = acct.window.filter(t => now - t < 60000);
  if (acct.window.length >= lim.rpm) return openaiError(res, 429, `rate limit: ${lim.rpm} requests per minute`, 'rate_limit_error', { 'Retry-After': '10' });
  if (acct.inflight >= lim.concurrency) return openaiError(res, 429, `concurrency limit: ${lim.concurrency} requests in flight`, 'rate_limit_error', { 'Retry-After': '5' });
  acct.window.push(now);

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
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ip = pick(pool, tried, acct.sticky[target.app]);
      if (!ip) { acct.errors += 1; return openaiError(res, 503, `no healthy instance for ${modelId} (${target.app})`, 'server_error', { 'Retry-After': '30' }); }
      acct.sticky[target.app] = ip;
      const peer = pool.peers.get(ip);
      peer.inflight += 1;
      const started = Date.now();
      try {
        const upstream = await fetch(`http://${ip}:${pool.port}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pool.key}` },
          body: payload,
          signal: AbortSignal.timeout(900000),
        });
        if ((upstream.status === 503 || upstream.status === 502) && attempt === 0) {
          // The instance is not ready (pulling) or its engine is gone: mark it
          // and try another before the client sees anything.
          peer.healthy = false; peer.detail = `upstream ${upstream.status}`; tried = ip;
          try { await upstream.body?.cancel(); } catch { /* ignore */ }
          continue;
        }
        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'X-Served-By': `${target.app}/${ip}`,
          'X-Model': modelId,
        });
        let tail = '';
        if (upstream.body) {
          for await (const chunk of upstream.body) {
            res.write(chunk);
            // Keep only the end of the response for token accounting: the
            // usage object is in the final chunk (SSE) or the final line
            // (ndjson) or the whole body (non-stream JSON).
            tail = (tail + Buffer.from(chunk).toString('utf8')).slice(-4096);
          }
        }
        res.end();
        countUsage(tail, acct, per);
        peer.latencyMs = peer.latencyMs * (1 - EWMA) + (Date.now() - started) * EWMA;
        if (upstream.status >= 400) acct.errors += 1;
        return;
      } catch (err) {
        peer.healthy = false; peer.detail = `request failed: ${err.message.slice(0, 50)}`;
        if (res.headersSent) { res.end(); return; }
        if (attempt === 1) { acct.errors += 1; return openaiError(res, 502, `upstream failed: ${err.message.slice(0, 80)}`, 'server_error'); }
        tried = ip;
      } finally {
        peer.inflight -= 1;
      }
    }
  } finally {
    acct.inflight -= 1;
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
}

server.headersTimeout = 900000;
server.requestTimeout = 900000;
server.listen(PORT, () => console.log(`hub on :${PORT}: ${models.size} model(s) over ${pools.size} pool(s): ${[...models.keys()].join(', ')}`));

discover().then(probe);
setInterval(discover, DISCOVER_MS).unref();
setInterval(probe, PROBE_MS).unref();
