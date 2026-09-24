/**
 * Production retrieval, reproduced for the eval's flux_search_docs.
 *
 * The eval used to answer flux_search_docs from a dozen regexes I wrote by hand,
 * and they kept missing. A query about the component limit or the signing
 * wallets matched nothing and returned an empty result; the model was then
 * graded on a question the mock could not answer, and a model that correctly
 * said "the docs do not give a number" failed for the right behaviour.
 *
 * This is the docs bot's own retriever (images/docsbot/server.js retrieve()):
 * the same 26,879-chunk corpus, the same granite-embedding:278m vectors, the
 * same 0.6 cosine + 0.4 BM25 hybrid with each signal normalised to its own max,
 * the same tier weights and the same tokeniser. What the eval retrieves is what
 * a user in production would get. Queries are embedded through a local ollama.
 */
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'images', 'docsbot', 'docs');
// DOCS_CORPUS points the eval at an alternative index, e.g. a candidate rebuild.
const CORPUS = process.env.DOCS_CORPUS || path.join(DOCS, 'corpus.jsonl');
const ENGINE = process.env.EMBED_ENGINE || 'http://localhost:11434';
const EMBED_MODEL = 'granite-embedding:278m';
const TOP_K = 3;
const TIER_WEIGHTS = { facts: 1.35, docs: 1.2, academy: 1.1, product: 1.05, 'product-repo': 1.0, enterprise: 0.95, website: 0.85, whitepaper: 0.8, blog: 0.7 };
const weightOf = (t) => TIER_WEIGHTS[t] ?? 1.0;
const tokenize = (t) => (String(t).toLowerCase().match(/[a-z0-9_.:-]{2,}/g) || []);

let index = null; let df = null; let avgLen = 1;
function load() {
  const meta = JSON.parse(fs.readFileSync(`${CORPUS}.vec.json`, 'utf8'));
  const buf = fs.readFileSync(`${CORPUS}.vec`);
  const dims = meta.dims;
  const vecs = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const lines = fs.readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean);
  if (lines.length !== meta.count) throw new Error(`corpus has ${lines.length} chunks, vectors cover ${meta.count}`);
  index = lines.map((l, i) => {
    const c = JSON.parse(l);
    const v = vecs.subarray(i * dims, (i + 1) * dims);
    let m = 0; for (let k = 0; k < dims; k += 1) m += v[k] * v[k];
    const tf = new Map();
    for (const t of tokenize(`${c.heading || ''} ${c.text}`)) tf.set(t, (tf.get(t) || 0) + 1);
    let len = 0; for (const n of tf.values()) len += n;
    return { text: c.text, url: c.url || '', heading: c.heading || '', tier: c.tier, vec: v, mag: Math.sqrt(m), tf, len };
  });
  df = new Map();
  for (const c of index) for (const t of c.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  avgLen = index.reduce((a, c) => a + c.len, 0) / index.length;
}
function bm25(q, c) {
  const k1 = 1.5; const b = 0.75; const N = index.length; let s = 0;
  for (const t of q) {
    const n = df.get(t) || 0; if (!n) continue;
    const f = c.tf.get(t) || 0; if (!f) continue;
    s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.len) / avgLen)));
  }
  return s;
}
async function embed(text) {
  const r = await fetch(`${ENGINE}/api/embed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: EMBED_MODEL, input: text }) });
  const j = await r.json();
  return Float32Array.from(j.embeddings[0]);
}
const cache = new Map();
async function search(query, k = TOP_K) {
  if (!index) load();
  const key = `${k}|${query}`;
  if (cache.has(key)) return cache.get(key);
  const qv = await embed(query);
  let qm = 0; for (const x of qv) qm += x * x; qm = Math.sqrt(qm);
  const qt = tokenize(query);
  const scored = index.map((c) => {
    let d = 0; for (let i = 0; i < qv.length; i += 1) d += qv[i] * c.vec[i];
    return { c, vec: d / (qm * c.mag || 1), kw: bm25(qt, c) };
  });
  const maxKw = Math.max(1e-9, ...scored.map((s) => s.kw));
  const maxVec = Math.max(1e-9, ...scored.map((s) => s.vec));
  const ranked = scored
    .map((s) => ({ c: s.c, score: (0.6 * (s.vec / maxVec) + 0.4 * (s.kw / maxKw)) * weightOf(s.c.tier) }))
    .sort((a, b) => b.score - a.score);
  const out = []; const seen = new Set();
  for (const { c, score } of ranked) {
    const sig = c.text.slice(0, 80);
    if (seen.has(sig)) continue; seen.add(sig);
    out.push({ n: out.length + 1, title: c.heading, text: c.text.replace(/\s+/g, ' ').slice(0, 700), url: c.url, score: +score.toFixed(3) });
    if (out.length >= k) break;
  }
  cache.set(key, out);
  return out;
}
module.exports = { search };
if (require.main === module) {
  (async () => {
    for (const r of await search(process.argv.slice(2).join(' '))) console.log(`[${r.n}] ${r.score} ${r.title.slice(0, 70)}\n    ${r.text.slice(0, 200)}\n`);
  })();
}
