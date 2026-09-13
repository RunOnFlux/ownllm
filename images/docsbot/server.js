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
const crypto = require('node:crypto');
const { liveContext, initTools } = require('./live.js');

const PORT = Number(process.env.PORT || 8080);
const ENGINE = process.env.UPSTREAM || 'http://127.0.0.1:11434';
const API_KEY = process.env.API_KEY || '';
const CHAT_MODEL = process.env.CHAT_MODEL || 'granite4:tiny-h';
const EMBED_MODEL = process.env.EMBED_MODEL || 'granite-embedding:278m';
const DOCS_DIR = process.env.DOCS_DIR || '/app/docs';
const TOP_K = Number(process.env.TOP_K || 5);
/**
 * Public mode serves /ask without a key, because a website widget puts its key
 * in page source where anyone can read it. The bot only ever answers from
 * published documentation, so there is nothing to protect but the compute -
 * which per-IP rate limiting covers. Everything else still needs the key.
 */
const PUBLIC_ASK = process.env.PUBLIC_ASK === 'true';
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 6);
/**
 * Origin allow-list, by hostname. ALLOWED_ORIGINS is a comma-separated list
 * of hostnames ("docs.runonflux.io"); an origin matches if its host is one of
 * them or the www. form of one, on http or https. "*" allows every origin.
 * Hostnames rather than full origins because a Flux env value is capped at
 * 400 characters and fourteen sites with schemes would not fit.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim().toLowerCase()).filter(Boolean);
function originAllowed(origin) {
  if (ALLOWED_ORIGINS.includes('*')) return true;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  return ALLOWED_ORIGINS.some(h => host === h || host === `www.${h}`);
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const window = hits.get(ip) || [];
  const recent = window.filter(t => now - t < 60000);
  if (recent.length >= RATE_PER_MIN) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  // Unbounded growth would be a slow leak on a public endpoint.
  if (hits.size > 10000) for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k);
  return false;
}

/**
 * Answers are cached by question.
 *
 * A documentation widget is asked the same few dozen things endlessly, and on
 * the slowest node measured a fresh answer costs 35 seconds against a cache
 * hit's milliseconds. The corpus only changes when the image is rebuilt, so a
 * cached answer cannot go stale within the life of a container.
 */
const CACHE_MAX = Number(process.env.CACHE_MAX || 500);
const cache = new Map();
const cacheKey = q => q.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
// Files listed here are prepended to every prompt, in a fixed order, ahead of
// the retrieved chunks. That gives every request an identical prefix, which is
// what llama.cpp's KV cache can actually reuse - retrieved chunks differ per
// question and can never be cached, but the instruction plus core facts can.
const PINNED = (process.env.PINNED_DOCS || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * Retrieval weight per corpus tier.
 *
 * The whitepaper is 227,000 words against 232,000 for all documentation
 * combined - roughly half the corpus - so on volume alone it wins retrieval
 * contests it should lose. It is authoritative about architecture and
 * intent, and close to useless for "how do I deploy an app", which the docs
 * answer directly.
 *
 * These multiply the final hybrid score, so a whitepaper passage still wins
 * when nothing more specific matches, but a documentation page beats it on
 * anything close. Facts generated from source rank highest: they cannot drift.
 */
const TIER_WEIGHTS = {
  facts: 1.35, docs: 1.2, academy: 1.1, product: 1.05,
  'product-repo': 1.0, enterprise: 0.95, website: 0.85, whitepaper: 0.8, blog: 0.7,
};
const weightOf = tier => TIER_WEIGHTS[tier] ?? 1.0;
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

async function retry(fn, times, what) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await fn(); } catch (err) {
      if (attempt >= times) throw err;
      console.log(`${what} failed (${err.message}), retry ${attempt}/${times - 1} in ${attempt * 10}s`);
      await new Promise(r => { setTimeout(r, attempt * 10000); });
    }
  }
}

/**
 * A batch that keeps failing is usually one oversized chunk the engine refuses
 * ("input (823 tokens) is too large to process" from llama-server, which
 * errors rather than truncates). Retrying the batch cannot fix that, and
 * giving up used to restart the whole index. So after the retries, embed the
 * batch one chunk at a time, and a chunk that still fails is embedded from
 * its first 2,000 characters - a slightly worse vector beats no index.
 */
async function embedBatch(batch, at) {
  try {
    return await retry(() => embed(batch.map(c => c.text)), 3, `embed batch at ${at}`);
  } catch (err) {
    console.log(`embed batch at ${at} keeps failing (${err.message}); embedding its ${batch.length} chunks one by one`);
  }
  const out = [];
  for (const c of batch) {
    // Embedders have a hard input limit (512 tokens for granite-embedding and
    // bitnet-embedding alike). ollama truncates silently; llama-server refuses.
    // Dense text - tables of hashes, numbers - tokenizes at ~2.4 chars/token,
    // so a fixed character cut is not safe either: halve until it fits.
    let v = null;
    let text = c.text;
    for (;;) {
      try { v = (await embed([text]))[0]; break; } catch (err) {
        if (text.length <= 250) throw err;
        console.log(`chunk from ${c.source} rejected at ${text.length} chars (${err.message.slice(0, 70)}); halving`);
        text = text.slice(0, Math.floor(text.length / 2));
      }
    }
    out.push(v);
  }
  return out;
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));

/**
 * Prefers corpus.jsonl, which tools/ingest.js produces with a url and heading
 * per chunk - that metadata is what turns "[1]" into a link a reader can check.
 * Raw markdown is the fallback so the image still works without an ingest step.
 */
/**
 * Citations should open the published page, not the markdown on GitHub. The
 * corpus keeps GitHub URLs (that is what was ingested, and rewriting the
 * file would invalidate the precomputed vectors), so known documentation
 * repositories are mapped here at load time:
 *   flux-docs   docs/<path>.md  -> https://docs.runonflux.com/<path>   (Docusaurus, routeBasePath '/')
 *   ssp-docs    <path>.md       -> https://docs.sspwallet.io/<path>    (GitBook)
 * README.md and index.md are the directory page. Anything else is left alone.
 */
const SITE_MAPS = [
  { re: /^https:\/\/github\.com\/RunOnFlux\/flux-docs\/blob\/[^/]+\/docs\/(.+?)\.mdx?$/i, base: 'https://docs.runonflux.com/' },
  // GitBook slugs for nested pages do not follow file paths reliably (a nested
  // path 404ed when checked), so only top-level pages map; the rest keep GitHub.
  { re: /^https:\/\/github\.com\/RunOnFlux\/ssp-docs\/blob\/[^/]+\/([^/]+?)\.mdx?$/i, base: 'https://docs.sspwallet.io/' },
];
function siteUrl(url) {
  if (!url) return url;
  for (const m of SITE_MAPS) {
    const hit = m.re.exec(url);
    if (!hit) continue;
    let p = hit[1].replace(/(^|\/)(README|index)$/i, '$1').replace(/\/$/, '');
    return m.base + p;
  }
  return url;
}

function loadChunks() {
  const corpus = path.join(DOCS_DIR, 'corpus.jsonl');
  if (fs.existsSync(corpus)) {
    return fs.readFileSync(corpus, 'utf8').split('\n').filter(Boolean).map((l) => {
      const c = JSON.parse(l);
      c.url = siteUrl(c.url);
      return c;
    });
  }
  return walk(DOCS_DIR).flatMap(f => chunk(fs.readFileSync(f, 'utf8'), path.relative(DOCS_DIR, f)));
}

/**
 * Loads precomputed vectors if they match this corpus.
 *
 * The pair is only valid together: vectors describe specific text, so serving
 * one corpus with another's embeddings retrieves confidently wrong passages and
 * cites them. The hash makes that mismatch loud instead of silent - a stale
 * .vec is ignored and the bot embeds from scratch, slowly but correctly.
 */
// Vectors are per embedder: corpus.jsonl.<model slug>.vec is tried first,
// then the historical corpus.jsonl.vec. Shipping one file per embedder is
// what lets a research rig with a different embedder boot in a minute
// instead of re-embedding 26,879 chunks (two hours) on every restart.
const modelSlug = (m) => String(m).toLowerCase().replace(/[^a-z0-9]+/g, '-');

function loadVectors(corpusPath, count) {
  const candidates = [`${corpusPath}.${modelSlug(EMBED_MODEL)}.vec`, `${corpusPath}.vec`];
  const bin = candidates.find(c => fs.existsSync(c) && fs.existsSync(`${c}.json`));
  if (!bin) return null;
  const meta = `${bin}.json`;
  try {
    const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const actual = crypto.createHash('sha256').update(fs.readFileSync(corpusPath)).digest('hex').slice(0, 16);
    if (m.corpusHash !== actual) {
      console.log(`precomputed vectors are for corpus ${m.corpusHash}, this is ${actual} - ignoring them`);
      return null;
    }
    if (m.count !== count) { console.log(`vector count ${m.count} != ${count} chunks - ignoring`); return null; }
    // Vectors from a different embedder are not comparable to the query
    // vectors this instance will produce: cosine over two unrelated spaces is
    // noise, and it would look like bad retrieval rather than a config error.
    // Re-embed instead - slow, but it is what makes a swapped embedder (the
    // ternary research rig) measurable at all.
    if (m.model !== EMBED_MODEL) {
      console.log(`precomputed vectors were built with ${m.model}, serving with ${EMBED_MODEL} - ignoring them`);
      return null;
    }
    const buf = fs.readFileSync(bin);
    return { dims: m.dims, data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
  } catch (err) {
    console.log(`could not read precomputed vectors: ${err.message}`);
    return null;
  }
}

async function buildIndex() {
  // A restarted build must start from an empty index. It used to append to
  // the previous attempt's entries: forty-eight restarts at the same failing
  // batch produced "embedded 32256/26879" - 48 copies of the first 672 chunks.
  index = [];
  const chunks = loadChunks();
  const files = new Set(chunks.map(c => c.source)).size;
  const corpusPath = path.join(DOCS_DIR, 'corpus.jsonl');
  const pre = fs.existsSync(corpusPath) ? loadVectors(corpusPath, chunks.length) : null;
  if (pre) {
    status = `loading ${chunks.length} precomputed vectors`;
    console.log(status);
    for (let i = 0; i < chunks.length; i += 1) {
      const v = pre.data.subarray(i * pre.dims, (i + 1) * pre.dims);
      index.push({ ...chunks[i], vec: v, mag: norm(v), tf: termFreq(chunks[i].text), len: countTokens(chunks[i].text) });
    }
  } else {

  status = `embedding ${chunks.length} chunks from ${files} sources`;
  console.log(status);
  // Batched: one request per 32 chunks keeps memory flat without paying a
  // round trip per chunk.
  const BATCH = Number(process.env.EMBED_BATCH || 96);
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    // A transient engine failure mid-index used to throw out of buildIndex,
    // which started over from chunk 0 - on the ternary rig that discarded
    // 4,000 embedded chunks per "fetch failed". Retry the batch in place;
    // only a persistent failure (5 in a row) gives up and restarts.
    // eslint-disable-next-line no-await-in-loop
    const vecs = await embedBatch(batch, i);
    batch.forEach((c, j) => {
      // Float32Array rather than a JS number array: identical retrieval quality
      // at half the memory. 26,879 chunks x 768 dims is 165 MB as doubles.
      const v = Float32Array.from(vecs[j]);
      index.push({ ...c, vec: v, mag: norm(v), tf: termFreq(c.text), len: countTokens(c.text) });
    });
    status = `embedded ${index.length}/${chunks.length}`;
  }
  }
  buildKeywordStats();
  buildPinned();
  await initTools(embed).catch(err => console.log(`live lookups unavailable: ${err.message}`));

  // Warm start: pull both models into RAM and lay down the KV cache for the
  // invariant prefix now, so the first real user does not pay for a 4 GB load
  // from disk plus a cold prefill. Ollama unloads on a timer, so the engine is
  // configured with OLLAMA_KEEP_ALIVE=-1 to keep them there.
  status = 'warming models';
  console.log(status);
  const t0 = Date.now();
  // Generating must be proven, not assumed. An instance passed readiness on
  // having models and an index, then returned empty answers: the check only
  // ever exercised the embedding path. A warm-up that is allowed to fail
  // quietly is not a check at all, so a failure here keeps the instance out of
  // rotation rather than being logged and ignored.
  const warm = await fetch(`${ENGINE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      prompt: 'Reply with the single word: ready',
      stream: false,
      options: { num_predict: 8, temperature: 0 },
    }),
    signal: AbortSignal.timeout(900000),
  }).then(r => r.json()).catch(err => ({ error: err.message }));
  if (warm.error || !warm.response) {
    throw new Error(`chat model cannot generate: ${warm.error || 'empty response'}`);
  }
  console.log(`warm in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  ready = true;
  status = `${index.length} chunks indexed from ${files} sources, models warm`;
  console.log(status);
}

/**
 * Hybrid retrieval: embeddings plus BM25-style keyword scoring.
 *
 * Pure vector search is weak exactly where technical documentation needs to be
 * strong. "ram must be a multiple of 100" and "hdd must be a whole number of
 * GB" embed almost identically, and a question about port 16127 finds nothing
 * because a number carries little semantic signal. Keyword scoring pins the
 * literal terms; embeddings handle the paraphrases. Neither alone is enough.
 */
const tokenize = t => (t.toLowerCase().match(/[a-z0-9_.:-]{2,}/g) || []);

/**
 * BM25 needs term frequency and document length, not the token sequence.
 * Keeping the full token array held every one of ~1.95M words as a separate
 * JS string - 94 MB, and the largest single cause of the container being
 * OOM-killed at 86% indexed. A Map of unique term to count answers both
 * questions in a fraction of the space.
 */
function termFreq(text) {
  const m = new Map();
  for (const t of tokenize(text)) m.set(t, (m.get(t) || 0) + 1);
  return m;
}
const countTokens = text => tokenize(text).length;
let df = new Map();
let avgLen = 1;

function buildKeywordStats() {
  df = new Map();
  for (const c of index) {
    for (const term of c.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  avgLen = index.reduce((a, c) => a + c.len, 0) / Math.max(1, index.length);
}

function bm25(queryTerms, c) {
  const k1 = 1.5; const b = 0.75; const N = index.length;
  let score = 0;
  for (const q of queryTerms) {
    const n = df.get(q) || 0;
    if (!n) continue;
    const tf = c.tf.get(q) || 0;
    if (!tf) continue;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * c.len) / avgLen)));
  }
  return score;
}

function retrieve(queryVec, question) {
  const qm = norm(queryVec);
  const qTerms = tokenize(question);
  const scored = index.map(c => ({
    c,
    vec: dot(queryVec, c.vec) / (qm * c.mag || 1),
    kw: bm25(qTerms, c),
  }));
  // Normalise each signal to its own maximum before combining: BM25 is
  // unbounded while cosine is capped at 1, so raw addition would let keyword
  // scores drown the embeddings entirely.
  const maxKw = Math.max(1e-9, ...scored.map(s => s.kw));
  const maxVec = Math.max(1e-9, ...scored.map(s => s.vec));
  return scored
    .map(s => ({
      ...s.c,
      score: (0.6 * (s.vec / maxVec) + 0.4 * (s.kw / maxKw)) * weightOf(s.c.tier),
    }))
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
  // Sources became full paths like RunOnFlux/ownllm/images/docsbot/docs/
  // flux-facts.md when citations moved to GitHub URLs, so matching the whole
  // string against a bare filename silently stopped pinning anything.
  // A pinned document that ships as a file in DOCS_DIR (the generated facts
  // sheet, the hand-written how-to sheet) is read whole from disk; it need not
  // be in the corpus at all. Anything else is looked up among the corpus
  // chunks by filename.
  const base = p => p.split('/').pop();
  const parts = [];
  let n = 0;
  for (const want of PINNED) {
    const file = path.join(DOCS_DIR, base(want));
    if (fs.existsSync(file)) { parts.push(`(${base(want)})\n${fs.readFileSync(file, 'utf8').trim()}`); n += 1; continue; }
    const chunks = index.filter(c => base(c.source) === base(want));
    chunks.forEach(c => parts.push(`(${c.source})\n${c.text}`));
    n += chunks.length;
  }
  pinnedBlock = parts.join('\n\n');
  if (pinnedBlock) console.log(`pinned prefix: ${n} document(s)/chunk(s), ~${Math.round(pinnedBlock.length / 4)} tokens`);
}

/**
 * Conversation history from the widget: up to the last two turns, trimmed
 * hard. It goes into the prompt after the documentation and before the
 * question, so the model can resolve "and on NIMBUS?"; it also joins the
 * previous question to the retrieval query, so the search does too. Kept
 * small on purpose: history is prompt, prompt is prefill, prefill is what a
 * CPU pays for in seconds.
 */
const HISTORY_TURNS = Number(process.env.HISTORY_TURNS || 2);
const HISTORY_Q_CHARS = Number(process.env.HISTORY_Q_CHARS || 200);
const HISTORY_A_CHARS = Number(process.env.HISTORY_A_CHARS || 400);
function cleanHistory(raw) {
  if (!Array.isArray(raw) || HISTORY_TURNS <= 0) return [];
  return raw.slice(-HISTORY_TURNS).map(t => ({
    q: String((t && t.q) || '').slice(0, HISTORY_Q_CHARS),
    a: String((t && t.a) || '').replace(/\s+/g, ' ').slice(0, HISTORY_A_CHARS),
  })).filter(t => t.q && t.a);
}
const retrievalQuery = (question, history) => (history.length ? `${history[history.length - 1].q}\n${question}` : question);

function buildPrompt(question, hits, live, history = []) {
  // No URLs or paths in the context: the model only needs the number to cite,
  // and given a "[1] path <url>" line it copied it into answers verbatim.
  const ctx = hits.map((h, i) => `[${i + 1}] ${h.heading || h.source}\n${h.text}`).join('\n\n');
  // Invariant part first (instruction + pinned), variable part after: anything
  // before the first difference is a cache hit on the next request.
  return `You answer strictly from the DOCUMENTATION below. Cite the sources you used as [1], [2]. `
    + `Answer the question that was asked, in plain prose or short steps; do not list the source headings, `
    + `do not mention "the documentation" or section names, and do not include links. `
    + `If the documentation does not contain the answer, reply exactly: "Not covered in the documentation." `
    + `Never guess and never use outside knowledge.\n\n`
    + (live ? `LIVE NETWORK STATUS (accurate as of now, prefer this over the documentation for current figures):\n${live}\n\n` : '')
    + (pinnedBlock ? `CORE DOCUMENTATION:\n${pinnedBlock}\n\n` : '')
    + `RETRIEVED DOCUMENTATION:\n${ctx}\n\n`
    + (history.length ? `CONVERSATION SO FAR (for context; the QUESTION below may refer to it):\n${history.map(t => `User: ${t.q}\nAssistant: ${t.a}`).join('\n')}\n\n` : '')
    + `QUESTION: ${question}\n\nANSWER:`;
}

/**
 * Streams the answer.
 *
 * Two reasons, and the first is not cosmetic. FDM gives an app 25 seconds of
 * silence before it cuts the connection (haproxyTemplate.js, `timeout server
 * 25s`), and a non-streamed answer sends nothing until it is complete - on the
 * slowest node measured that is 78 seconds, so every substantial question
 * failed through the load balancer while working fine directly. Streaming
 * resets that timer with every token.
 *
 * The second is that a reader seeing words appear is waiting; a reader seeing
 * a blank page assumes it is broken.
 *
 * Sources go first, so a client can render citations before the prose arrives.
 */
async function answerStream(question, res, history = []) {
  // Both at once: the API call is network-bound and the embedding is
  // CPU-bound, so serialising them would add a round trip to every question.
  const [qvec] = await embed([retrievalQuery(question, history)]);
  // The question vector is already computed for retrieval, so routing to a live
  // lookup reuses it - the decision costs a few thousand multiplications, not a
  // second pass through the language model.
  const live = await liveContext(question, qvec);
  const hits = retrieve(qvec, retrievalQuery(question, history));
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`${JSON.stringify({
    live: live || undefined,
    sources: hits.map((h, i) => ({
      n: i + 1, source: h.source, heading: h.heading || undefined,
      url: h.url || undefined, tier: h.tier || undefined,
    })),
  })}\n`);

  let upstream;
  try {
    upstream = await fetch(`${ENGINE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CHAT_MODEL, prompt: buildPrompt(question, hits, live, history),
        stream: true, options: { temperature: 0.1, num_predict: 250, stop: ['\n_', '\nQUESTION:', '\nUser:'] },
      }),
      signal: AbortSignal.timeout(900000),
    });
  } catch (err) {
    // Headers are out, so say so in-band and end the stream cleanly.
    console.log(`engine unreachable mid-answer: ${err.message}`);
    res.write(`${JSON.stringify({ error: 'engine unreachable', detail: err.message })}\n`);
    return res.end();
  }

  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  for await (const piece of upstream.body) {
    buf += decoder.decode(piece, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.error) { res.write(`${JSON.stringify({ error: String(obj.error).slice(0, 200) })}\n`); res.end(); return; }
      if (obj.response) { text += obj.response; res.write(`${JSON.stringify({ delta: obj.response })}\n`); }
      if (obj.done) {
        const finished = text.trim();
        // Live answers are deliberately not cached: a node count cached for an
        // hour is exactly the stale number this feature exists to avoid.
        if (finished && !live) {
          if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
          if (!history.length) cache.set(cacheKey(question), { answer: finished, sources: hits.map((h, i) => ({ n: i + 1, source: h.source, url: h.url || undefined, tier: h.tier || undefined })) });
        }
        res.write(`${JSON.stringify({ done: true, answer: finished })}\n`);
      }
    }
  }
  res.end();
}

async function answer(question) {
  const [qvec] = await embed([question]);
  const live = await liveContext(question, qvec);
  const hits = retrieve(qvec, question);
  const res = await fetch(`${ENGINE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL, prompt: buildPrompt(question, hits),
      // 500 was generous; measured answers are 40-120 tokens and the tail was
      // the model copying the fact sheet's footer. At 5 tok/s on a slow node
      // each unnecessary token is a fifth of a second of user waiting.
      stream: false, options: { temperature: 0.1, num_predict: 250, stop: ['\n_', '\nQUESTION:'] },
    }),
    signal: AbortSignal.timeout(900000),
  });
  const body = await res.json();
  // An engine error used to become an empty string with a 200 status, so a
  // failure was indistinguishable from a model that had nothing to say. That
  // hid an intermittent fault for an entire deployment.
  if (body.error) throw new Error(`engine: ${String(body.error).slice(0, 200)}`);
  if (!body.response || !body.response.trim()) {
    throw new Error(`engine returned no text (done_reason=${body.done_reason || 'unknown'}, eval_count=${body.eval_count ?? 0})`);
  }
  return {
    answer: (body.response || '').trim(),
    sources: hits.map((h, i) => ({
      n: i + 1, source: h.source, heading: h.heading || undefined, url: h.url || undefined,
      tier: h.tier || undefined, score: Number(h.score.toFixed(3)),
    })),
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
  const origin = req.headers.origin || '';
  if (PUBLIC_ASK && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // /ask is open in public mode; the model API and everything else is not.
  const isPublicAsk = PUBLIC_ASK && req.url.startsWith('/ask');
  if (!isPublicAsk && !authorized(req)) return send(401, { error: 'unauthorized' });
  if (isPublicAsk && !authorized(req)) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return send(429, { error: `rate limit: ${RATE_PER_MIN} questions per minute` });
  }
  if (!ready) return send(503, { error: 'index not ready', detail: status });

  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    // /ask takes {question}; /v1/chat/completions takes the last user message,
    // so existing OpenAI clients work without knowing about this service.
    const question = req.url === '/v1/chat/completions'
      ? (body.messages || []).filter(m => m.role === 'user').pop()?.content
      : body.question;
    if (!question) return send(400, { error: 'no question' });

    // Streaming is the default: a non-streamed answer is silent long enough
    // for FDM to drop it. Pass {"stream": false} for a single JSON body when
    // the caller is going direct to an instance and can wait.
    const history = cleanHistory(body.history);
    const cached = history.length ? null : cache.get(cacheKey(question));
    if (cached) {
      if (body.stream !== false && req.url !== '/v1/chat/completions') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(`${JSON.stringify({ sources: cached.sources, cached: true })}\n`);
        res.write(`${JSON.stringify({ delta: cached.answer })}\n`);
        res.write(`${JSON.stringify({ done: true, answer: cached.answer, cached: true })}\n`);
        return res.end();
      }
      return send(200, { ...cached, cached: true });
    }

    if (body.stream !== false && req.url !== '/v1/chat/completions') {
      // `return await`, not `return`: a returned promise's rejection escapes
      // the surrounding try/catch, and one "fetch failed" from the engine
      // then took the whole process down - and with it a two-hour index.
      return await answerStream(question, res, history);
    }

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

/**
 * Two error classes, and they need opposite handling.
 *
 * The engine is a separate component that may still be pulling multi-GB models,
 * so "model not found" and connection failures are expected and retried
 * indefinitely.
 *
 * A failure to read the corpus is not transient. It ships inside this image, so
 * an EIO or ENOENT means the layer is unreadable on this node - retrying reads
 * the same broken bytes forever. One instance sat in exactly that loop
 * reporting "EIO: i/o error, open '/app/docs/corpus.jsonl'" while the other two
 * indexed. Exiting hands the problem to Docker and FluxOS, which can restart the
 * container or replace the instance; staying up cannot fix it.
 */
// Belt and braces: log a stray rejection instead of dying with the index.
process.on('unhandledRejection', (err) => console.error(`unhandled rejection: ${err?.message || err}`));

const FATAL = /^(EIO|ENOENT|EACCES|EISDIR)\b/;

(async function start() {
  let corpusFailures = 0;
  for (;;) {
    try { await buildIndex(); return; } catch (err) {
      const fatal = FATAL.test(err.code || '') || FATAL.test(err.message || '');
      if (fatal) {
        corpusFailures += 1;
        console.error(`corpus unreadable (attempt ${corpusFailures}): ${err.message}`);
        // One retry, in case it was a partially-materialised layer.
        if (corpusFailures >= 2) {
          console.error('exiting so the platform can restart or replace this instance');
          process.exit(1);
        }
      }
      status = `waiting for engine: ${err.message}`;
      console.log(status);
      await new Promise(r => { setTimeout(r, 15000); });
    }
  }
}());
