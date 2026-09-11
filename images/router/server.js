/**
 * Load-aware router for a Flux application.
 *
 * FDM balances round-robin and pins a browser to one instance for eight hours
 * with a cookie (haproxyTemplate.js). For a web server that is fine. For CPU
 * inference it is not: nodes vary enormously - 5 tok/s on the slowest measured
 * against 28 on the fastest - so a user handed the slow one waits six times
 * longer, all day, while a fast instance sits idle.
 *
 * This routes on outstanding requests first and observed latency second, which
 * is what you want when one request occupies an instance for tens of seconds.
 * It discovers instances from the Flux API rather than configuration, so
 * migrations and scaling need no redeploy.
 *
 * Responses stream through untouched. Buffering here would reintroduce exactly
 * the silence that makes FDM drop long answers.
 */
const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const TARGET_APP = process.env.TARGET_APP || 'ownllmdocs';
const TARGET_PORT = Number(process.env.TARGET_PORT || 33001);
const FLUX_API = process.env.FLUX_API || 'https://api.runonflux.io';
const DISCOVER_MS = Number(process.env.DISCOVER_MS || 60000);
const PROBE_MS = Number(process.env.PROBE_MS || 20000);
const EWMA = 0.3;

/** ip -> { healthy, inflight, latencyMs, detail } */
const peers = new Map();

async function discover() {
  try {
    const res = await fetch(`${FLUX_API}/apps/location/${TARGET_APP}`, { signal: AbortSignal.timeout(20000) });
    const body = await res.json();
    const ips = (body.data || []).map(i => i.ip.split(':')[0]);
    for (const ip of ips) {
      if (!peers.has(ip)) peers.set(ip, { healthy: false, inflight: 0, latencyMs: 0, detail: 'new' });
    }
    // An instance that has moved should stop receiving traffic, but not while
    // it still has requests in flight.
    for (const ip of [...peers.keys()]) {
      if (!ips.includes(ip) && peers.get(ip).inflight === 0) peers.delete(ip);
    }
    console.log(`discovered ${ips.length} instance(s) of ${TARGET_APP}`);
  } catch (err) {
    // Keep serving the peers already known: a lookup failure should not empty
    // the pool.
    console.log(`discovery failed, keeping ${peers.size} known peers: ${err.message}`);
  }
}

async function probe() {
  await Promise.all([...peers.entries()].map(async ([ip, p]) => {
    const started = Date.now();
    try {
      const res = await fetch(`http://${ip}:${TARGET_PORT}/healthz`, { signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      const rtt = Date.now() - started;
      p.latencyMs = p.latencyMs ? p.latencyMs * (1 - EWMA) + rtt * EWMA : rtt;
      p.healthy = res.status === 200;
      p.detail = text.slice(0, 60);
    } catch (err) {
      p.healthy = false;
      p.detail = err.message.slice(0, 60);
    }
  }));
}

/**
 * Fewest outstanding requests wins; latency breaks ties. With one request
 * occupying an instance for tens of seconds, "who is free" matters far more
 * than "who was fastest last time".
 */
function pick() {
  const healthy = [...peers.entries()].filter(([, p]) => p.healthy);
  if (!healthy.length) return null;
  healthy.sort(([, a], [, b]) => (a.inflight - b.inflight) || (a.latencyMs - b.latencyMs));
  return healthy[0][0];
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      target: `${TARGET_APP}:${TARGET_PORT}`,
      peers: [...peers.entries()].map(([ip, p]) => ({ ip, ...p })),
    }, null, 2));
  }
  // FDM health-checks '/' and the widget needs CORS.
  if (req.url === '/' || req.url === '/healthz' || req.url === '/health') {
    const up = [...peers.values()].filter(p => p.healthy).length;
    res.writeHead(up ? 200 : 503, { 'Content-Type': 'text/plain' });
    return res.end(up ? `ok (${up} healthy)` : 'no healthy instances');
  }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const ip = pick();
  if (!ip) { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"error":"no healthy instances"}'); }

  const peer = peers.get(ip);
  peer.inflight += 1;
  const started = Date.now();
  try {
    const upstream = await fetch(`http://${ip}:${TARGET_PORT}${req.url}`, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        // So the instance rate-limits the real client, not the router.
        'X-Forwarded-For': (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      duplex: 'half',
      signal: AbortSignal.timeout(900000),
    });
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'X-Served-By': ip,
    });
    // Piped, not buffered: the answer streams token by token and buffering it
    // here would recreate the silence FDM cuts off.
    if (upstream.body) for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    peer.latencyMs = peer.latencyMs * (1 - EWMA) + (Date.now() - started) * EWMA;
  } catch (err) {
    peer.healthy = false;
    peer.detail = `request failed: ${err.message.slice(0, 50)}`;
    if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(`{"error":"upstream failed"}`); }
    else res.end();
  } finally {
    peer.inflight -= 1;
  }
});

server.headersTimeout = 900000;
server.requestTimeout = 900000;
server.listen(PORT, () => console.log(`router on :${PORT} -> ${TARGET_APP}:${TARGET_PORT}`));

discover().then(probe);
setInterval(discover, DISCOVER_MS).unref();
setInterval(probe, PROBE_MS).unref();
