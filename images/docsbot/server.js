/**
 * Grounded documentation bot: retrieval over baked-in docs, answered by a local
 * model that is instructed to refuse anything the docs do not cover.
 *
 * Why the index is built at boot rather than stored: a vector database would be
 * state, and state is what makes a Flux app hard to move. Documents are baked
 * into the image, embedded in memory at startup, and thrown away on exit - so
 * every instance is byte-identical, a migration costs one re-index, and there is
 * nothing to sync between replicas. A docs corpus is small enough that brute
 * force cosine similarity over an array is faster than any index would be.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const ENGINE = process.env.UPSTREAM || 'http://127.0.0.1:11434';
const API_KEY = process.env.API_KEY || '';
const CHAT_MODEL = process.env.CHAT_MODEL || 'granite4:tiny-h';
const EMBED_MODEL = process.env.EMBED_MODEL || 'granite-embedding:278m';
const DOCS_DIR = process.env.DOCS_DIR || '/app/docs';
const TOP_K = Number(process.env.TOP_K || 5);
// Files listed here are prepended to every prompt, in a fixed order, ahead of
// the retrieved chunks. That gives every request an identical prefix, which is
// what llama.cpp's KV cache can actually reuse - retrieved chunks differ per
// question and can never be cached, but the instruction plus core facts can.
const PINNED = (process.env.PINNED_DOCS || '').split(',').map(s => s.trim()).filter(Boolean);
const CHUNK_CHARS = Number(process.env.CHUNK_CHARS || 1200);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 200);

if (!API_KEY) { console.error('API_KEY unset - refusing to start unauthenticated'); process.exit(1); }

let index = [];
let ready = false;
let status = 'starting';

/** Split on headings first so a chunk rarely straddles two topics, then by size. */
function chunk(text, source) {
  const sections = text.split(/\n(?=#{1,6}\s)/g);
  const out = [];
  for (const section of sections) {
    if (section.length <= CHUNK_CHARS) {
      if (section.trim()) out.push({ source, text: section.trim() });
      continue;
    }
    for (let i = 0; i < section.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
      const piece = section.slice(i, i + CHUNK_CHARS).trim();
      if (piece) out.push({ source, text: piece });
    }
  }
  return out;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(md|markdown|txt)$/i.test(e.name) ? [p] : [];
  });
}

async function embed(input) {
  const res = await fetch(`${ENGINE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
    signal: AbortSignal.timeout(300000),
  });
  const body = await res.json();
  if (!body.embeddings) throw new Error(body.error || 'no embeddings returned');
  return body.embeddings;
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));

async function buildIndex() {
  const files = walk(DOCS_DIR);
  const chunks = files.flatMap(f => chunk(fs.readFileSync(f, 'utf8'), path.relative(DOCS_DIR, f)));
  status = `embedding ${chunks.length} chunks from ${files.length} files`;
  console.log(status);
  // Batched: one request per 32 chunks keeps memory flat without paying a
  // round trip per chunk.
  for (let i = 0; i < chunks.length; i += 32) {
    const batch = chunks.slice(i, i + 32);
    // eslint-disable-next-line no-await-in-loop
    const vecs = await embed(batch.map(c => c.text));
    batch.forEach((c, j) => index.push({ ...c, vec: vecs[j], mag: norm(vecs[j]) }));
    status = `embedded ${index.length}/${chunks.length}`;
  }
  buildPinned();

  // Warm start: pull both models into RAM and lay down the KV cache for the
  // invariant prefix now, so the first real user does not pay for a 4 GB load
  // from disk plus a cold prefill. Ollama unloads on a timer, so the engine is
  // configured with OLLAMA_KEEP_ALIVE=-1 to keep them there.
  status = 'warming models';
  console.log(status);
  const t0 = Date.now();
  await fetch(`${ENGINE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      prompt: buildPrompt('warmup', []),
      stream: false,
      options: { num_predict: 1, temperature: 0 },
    }),
    signal: AbortSignal.timeout(900000),
  }).catch(err => console.log(`warmup generate failed (continuing): ${err.message}`));
  console.log(`warm in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  ready = true;
  status = `${index.length} chunks indexed from ${files.length} files, models warm`;
  console.log(status);
}

function retrieve(queryVec) {
  const qm = norm(queryVec);
  return index
    .map(c => ({ ...c, score: dot(queryVec, c.vec) / (qm * c.mag || 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

/**
 * The refusal instruction is the whole anti-hallucination mechanism: a small
 * model asked to answer only from context reliably says so when the context is
 * silent, which is the failure mode we want.
 */
let pinnedBlock = '';
function buildPinned() {
  const chunks = index.filter(c => PINNED.some(p => c.source === p || c.source.startsWith(p)));
  pinnedBlock = chunks.map(c => `(${c.source})\n${c.text}`).join('\n\n');
  if (pinnedBlock) console.log(`pinned prefix: ${chunks.length} chunks, ~${Math.round(pinnedBlock.length / 4)} tokens`);
}

function buildPrompt(question, hits) {
  const ctx = hits.map((h, i) => `[${i + 1}] (${h.source})\n${h.text}`).join('\n\n');
  // Invariant part first (instruction + pinned), variable part after: anything
  // before the first difference is a cache hit on the next request.
  return `You answer strictly from the DOCUMENTATION below. Cite the sources you used as [1], [2]. `
    + `If the documentation does not contain the answer, reply exactly: "Not covered in the documentation." `
    + `Never guess and never use outside knowledge.\n\n`
    + (pinnedBlock ? `CORE DOCUMENTATION:\n${pinnedBlock}\n\n` : '')
    + `RETRIEVED DOCUMENTATION:\n${ctx}\n\nQUESTION: ${question}\n\nANSWER:`;
}

async function answer(question) {
  const [qvec] = await embed([question]);
  const hits = retrieve(qvec);
  const res = await fetch(`${ENGINE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL, prompt: buildPrompt(question, hits),
      stream: false, options: { temperature: 0.1, num_predict: 500 },
    }),
    signal: AbortSignal.timeout(900000),
  });
  const body = await res.json();
  return {
    answer: (body.response || '').trim(),
    sources: hits.map((h, i) => ({ n: i + 1, source: h.source, score: Number(h.score.toFixed(3)) })),
  };
}

function authorized(req) {
  const given = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (given.length !== API_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ API_KEY.charCodeAt(i);
  return diff === 0;
}

const readBody = req => new Promise(resolve => {
  let b = ''; req.on('data', d => { b += d; }); req.on('end', () => resolve(b));
});

http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // Unauthenticated and answering on '/', because that is the path FDM's
  // default HAProxy check uses.
  if (['/', '/health', '/healthz'].includes(req.url)) {
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'text/plain' });
    res.end(ready ? 'ok' : status);
    return;
  }
  if (!authorized(req)) return send(401, { error: 'unauthorized' });
  if (!ready) return send(503, { error: 'index not ready', detail: status });

  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    // /ask takes {question}; /v1/chat/completions takes the last user message,
    // so existing OpenAI clients work without knowing about this service.
    const question = req.url === '/v1/chat/completions'
      ? (body.messages || []).filter(m => m.role === 'user').pop()?.content
      : body.question;
    if (!question) return send(400, { error: 'no question' });

    const result = await answer(question);
    if (req.url === '/v1/chat/completions') {
      return send(200, {
        object: 'chat.completion',
        model: CHAT_MODEL,
        choices: [{ index: 0, message: { role: 'assistant', content: result.answer }, finish_reason: 'stop' }],
        sources: result.sources,
      });
    }
    return send(200, result);
  } catch (err) {
    return send(500, { error: err.message });
  }
}).listen(PORT, () => console.log(`docsbot on :${PORT} -> ${ENGINE}`));

// Retry rather than exit: the engine is a separate component and may still be
// pulling its models when this container starts.
(async function start() {
  for (;;) {
    try { await buildIndex(); return; } catch (err) {
      status = `waiting for engine: ${err.message}`;
      console.log(status);
      await new Promise(r => { setTimeout(r, 15000); });
    }
  }
}());
