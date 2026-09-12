/**
 * ollama-compatible facade over two llama-server processes.
 *
 * Everything in this repository - the gate's readiness check, the docs bot,
 * bench-models.js, eval-quality.js - talks ollama's API. Teaching each of them
 * a second dialect would spread the research engine's quirks across four
 * files; translating once here keeps the comparison honest, because the
 * callers cannot tell which engine they are measuring.
 *
 *   /api/tags      -> the two baked-in models, so MODELS readiness passes
 *   /api/pull      -> immediate success (nothing to pull, weights are in the image)
 *   /api/delete    -> immediate success
 *   /api/generate  -> /completion on the chat server with BitNet's own chat
 *                     template applied here, SSE -> NDJSON,
 *                     with ollama's nanosecond timing fields filled from
 *                     llama-server's timings so tools/ollama.js rate() works
 *   /api/embed     -> /v1/embeddings on the embedding server
 */
const http = require('node:http');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 11434);
const CHAT = 'http://127.0.0.1:8081';
const EMBED = 'http://127.0.0.1:8082';
const MODELS = [
  { name: 'bitnet-2b-4t', model: 'bitnet-2b-4t', size: 1188 * 1024 * 1024, details: { family: 'bitnet', quantization_level: 'I2_S', parameter_size: '2.4B' } },
  { name: 'bitnet-embedding-270m', model: 'bitnet-embedding-270m', size: 367 * 1024 * 1024, details: { family: 'bitnet', quantization_level: 'I2_S', parameter_size: '270M' } },
];

const readBody = (req) => new Promise((resolve, reject) => {
  const parts = [];
  req.on('data', (d) => parts.push(d));
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch (e) { reject(e); } });
  req.on('error', reject);
});
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

/**
 * Process supervisor. The shim owns the two llama-servers: it spawns them,
 * respawns one that exits, and restarts one whose /health stays down. This
 * replaced shell `while` loops after the cgroup OOM killer took the embedding
 * server ("Killed" in the log, chat tasks continuing, embed tasks never
 * again) and the shell loop did not bring it back - the container sat there
 * half an engine for an hour. Everything that matters about liveness is now
 * observable in one process's log.
 *
 * Why it dies at all: memory use climbs over tens of thousands of embedding
 * requests (every crash so far came after a full corpus pass), which looks
 * like a leak in the fork's embedding path. A respawn is the mitigation; the
 * cause belongs to round two, where the runtime changes anyway.
 */
const BIN = process.env.BIN || '/opt/bitnet/bin';
const T = process.env.THREADS || '8';
const SERVERS = {
  chat: {
    port: 8081,
    args: ['-m', process.env.CHAT_GGUF, '-c', process.env.CTX || '4096', '-t', T, '-ngl', '0', '-cb', '-np', '1',
      '-b', '512', '-ub', '512', '--host', '127.0.0.1', '--port', '8081', '--no-webui', '--metrics'],
  },
  embed: {
    port: 8082,
    args: ['-m', process.env.EMBED_GGUF, '-t', T, '-ngl', '0', '--embeddings', '--pooling', 'mean', '-np', '4',
      '-c', '2048', '-b', '2048', '-ub', '2048', '--host', '127.0.0.1', '--port', '8082', '--no-webui'],
  },
};
const procs = {};
const log = (m) => console.log(`${new Date().toISOString().slice(11, 19)} supervisor: ${m}`);

function start(name) {
  const s = SERVERS[name];
  const child = spawn(`${BIN}/llama-server`, s.args, { stdio: 'inherit', env: { ...process.env, LD_LIBRARY_PATH: BIN } });
  procs[name] = { child, since: Date.now(), unhealthySince: null };
  log(`${name} started (pid ${child.pid})`);
  child.on('exit', (code, signal) => {
    log(`${name} exited (code ${code}, signal ${signal}); restarting in 2s`);
    setTimeout(() => start(name), 2000);
  });
}

async function healthy(port) {
  const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
  return !!(r && r.ok);
}

// Watchdog: a server that has been up for 2 minutes and unhealthy for 60 s
// is hung (loading takes seconds), so it is killed and respawned.
setInterval(async () => {
  for (const [name, s] of Object.entries(SERVERS)) {
    const p = procs[name];
    if (!p || Date.now() - p.since < 120000) continue;
    if (await healthy(s.port)) { p.unhealthySince = null; continue; }
    p.unhealthySince = p.unhealthySince || Date.now();
    if (Date.now() - p.unhealthySince > 60000) {
      log(`${name} unhealthy for 60s, killing pid ${p.child.pid}`);
      p.unhealthySince = null;
      p.child.kill('SIGKILL');
    }
  }
}, 15000);

start('chat');
start('embed');

// Both servers answer /health with 200 only once the model is loaded, which is
// exactly what the gate wants /api/tags to mean.
async function ready() {
  return (await healthy(SERVERS.chat.port)) && (await healthy(SERVERS.embed.port));
}

/**
 * BitNet's chat template is `Role: text<|eot_id|>` per turn, then `Assistant: `
 * (tokenizer_config.json). llama-server's built-in template matcher does not
 * recognise it and falls back to something else, which showed up as the model
 * echoing the prompt and never emitting <|eot_id|> - "Paris. The capital of
 * France is Paris. The capital of..." forever. So the shim formats the prompt
 * itself and calls the raw /completion endpoint with explicit stop strings.
 * Sampling defaults follow the model's generation_config (temp 0.6, top_p 0.9)
 * plus a mild repeat penalty, which a 2B model needs.
 */
const EOT = '<|eot_id|>';
function bitnetPrompt(system, user) {
  let p = '';
  if (system) p += `System: ${String(system).trim()}${EOT}`;
  p += `User: ${String(user).trim()}${EOT}Assistant: `;
  return p;
}

async function generate(body, res, req) {
  const o = body.options || {};
  // If the caller disconnects mid-stream, stop llama-server generating into a
  // dead pipe rather than let it run the request out (or worse).
  const ac = new AbortController();
  if (req) req.on('close', () => ac.abort());
  const upstream = await fetch(`${CHAT}/completion`, {
    method: 'POST',
    signal: ac.signal,
    // llama-server closes idle keep-alive sockets after 5 s; a reused one
    // resets mid-POST. One connection per request costs nothing on localhost.
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({
      prompt: bitnetPrompt(body.system, body.prompt || ''),
      stream: true,
      n_predict: o.num_predict ?? -1,
      temperature: o.temperature ?? 0.6,
      top_p: o.top_p ?? 0.9,
      top_k: o.top_k ?? 40,
      repeat_penalty: o.repeat_penalty ?? 1.1,
      stop: [EOT, '\nUser:', '\nSystem:', ...(o.stop || [])],
      cache_prompt: true,
    }),
  });
  if (!upstream.ok) return json(res, 502, { error: `chat server ${upstream.status}: ${(await upstream.text()).slice(0, 200)}` });

  const stream = body.stream !== false;
  const model = body.model || MODELS[0].name;
  const t0 = process.hrtime.bigint();
  let text = '';
  let timings = null;
  let buf = '';
  if (stream) res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  const decoder = new TextDecoder();
  for await (const piece of upstream.body) {
    buf += decoder.decode(piece, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.timings) timings = ev.timings;
      const delta = ev.content || '';
      if (!delta) continue;
      text += delta;
      if (stream) res.write(JSON.stringify({ model, response: delta, done: false }) + '\n');
    }
  }
  const total = Number(process.hrtime.bigint() - t0);
  // llama-server reports ms; ollama reports ns. prompt_n/predicted_n map to
  // prompt_eval_count/eval_count, which is what rate() divides.
  const done = {
    model, done: true, done_reason: 'stop',
    response: stream ? '' : text,
    total_duration: total,
    prompt_eval_count: timings?.prompt_n ?? 0,
    prompt_eval_duration: Math.round((timings?.prompt_ms ?? 0) * 1e6),
    eval_count: timings?.predicted_n ?? 0,
    eval_duration: Math.round((timings?.predicted_ms ?? 0) * 1e6),
  };
  if (stream) { res.write(JSON.stringify(done) + '\n'); res.end(); } else json(res, 200, done);
}

async function embed(body, res) {
  const input = Array.isArray(body.input) ? body.input : [body.input ?? body.prompt ?? ''];
  const t0 = process.hrtime.bigint();
  const upstream = await fetch(`${EMBED}/v1/embeddings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({ input }),
  });
  if (!upstream.ok) return json(res, 502, { error: `embedding server ${upstream.status}: ${(await upstream.text()).slice(0, 200)}` });
  const out = await upstream.json();
  const embeddings = (out.data || []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
  json(res, 200, {
    model: body.model || MODELS[1].name, embeddings,
    total_duration: Number(process.hrtime.bigint() - t0),
    prompt_eval_count: out.usage?.prompt_tokens ?? 0,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/version')) return json(res, 200, { version: 'ternary-shim' });
    if (url.pathname === '/api/tags') {
      if (!(await ready())) return json(res, 503, { error: 'models loading' });
      return json(res, 200, { models: MODELS });
    }
    if (url.pathname === '/api/pull') return json(res, 200, { status: 'success' });
    if (url.pathname === '/api/delete') return json(res, 200, {});
    if (url.pathname === '/api/ps') return json(res, 200, { models: MODELS });
    if (req.method !== 'POST') return json(res, 404, { error: 'not found' });
    const body = await readBody(req);
    if (url.pathname === '/api/generate') return await generate(body, res, req);
    if (url.pathname === '/api/embed' || url.pathname === '/api/embeddings') return await embed(body, res);
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: String(err.message || err).slice(0, 200) });
    else res.end();
  }
});
// The docs bot embeds in batches that take longer than Node's default 5 s idle
// keep-alive; it then reuses a socket this server had already closed and gets
// "fetch failed", and (before 1.4.2) restarted its whole index. Keep idle
// sockets for 10 minutes so a slow caller never finds the door shut.
server.keepAliveTimeout = 600000;
server.headersTimeout = 610000;
server.listen(PORT, '0.0.0.0', () => console.log(`ternary shim on :${PORT} -> chat ${CHAT}, embed ${EMBED}`));
