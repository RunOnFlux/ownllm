#!/usr/bin/env node
/**
 * Replace one source's chunks in the corpus without rebuilding or re-embedding
 * the rest of it.
 *
 * tools/build-corpus.sh rebuilds everything from every source, and a full
 * re-embed of ~31,000 chunks takes hours on a node. When one document changes
 * (a new whitepaper revision, say) only its chunks need new vectors: every
 * chunk whose text is unchanged keeps the vector it already has, and only new
 * text goes to the embedder. The corpus, its .vec and the .vec.json hash are
 * written together, so the docs bot accepts the pair (see loadVectors).
 *
 * The replacement chunks take the place of the first chunk they replace, so
 * corpus order (and with it the tiers' grouping) stays as build-corpus.sh made it.
 *
 *   node tools/ingest.js --out /tmp/wp.jsonl --tier whitepaper --pdf-base https://whitepaper.app.runonflux.io \
 *     --pdf FluxWhitepaper.pdf --pdf FluxWhitepaper-Short.pdf
 *   node tools/replace-chunks.js --with /tmp/wp.jsonl --source FluxWhitepaper.pdf --source FluxWhitepaper-Short.pdf \
 *     [--corpus images/docsbot/docs/corpus.jsonl] [--host http://localhost:11434] [--model granite-embedding:278m]
 *
 * Embeds against an ollama-compatible /api/embed. Use the model the docs bot
 * serves with (EMBED_MODEL); a local ollama gives the same vectors as the node.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const one = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const many = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));

const CORPUS = one('--corpus', path.join(__dirname, '..', 'images', 'docsbot', 'docs', 'corpus.jsonl'));
const WITH = one('--with');
const SOURCES = new Set(many('--source'));
const HOST = one('--host', 'http://localhost:11434').replace(/\/$/, '');
const MODEL = one('--model', 'granite-embedding:278m');
const KEY = process.env.EMBED_KEY || '';
const BATCH = Number(one('--batch', 32));
if (!WITH || SOURCES.size === 0) {
  console.error('usage: replace-chunks.js --with new.jsonl --source NAME [--source NAME ...]');
  process.exit(1);
}

const VEC = `${CORPUS}.vec`;
const META = `${VEC}.json`;
const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function embed(texts) {
  const res = await fetch(`${HOST}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({ model: MODEL, input: texts }),
    signal: AbortSignal.timeout(600000),
  });
  const body = await res.json();
  if (!body.embeddings) throw new Error(body.error || 'no embeddings returned');
  return body.embeddings;
}

(async () => {
  const oldBuf = fs.readFileSync(CORPUS);
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  if (meta.corpusHash !== hashOf(oldBuf)) throw new Error(`${META} is for corpus ${meta.corpusHash}, not this one - rebuild the vectors first`);
  if (meta.model !== MODEL) throw new Error(`vectors were made with ${meta.model}, not ${MODEL}`);
  const D = meta.dims;
  const vecs = fs.readFileSync(VEC);
  const oldLines = oldBuf.toString('utf8').split('\n').filter(Boolean);
  if (oldLines.length !== meta.count) throw new Error(`corpus has ${oldLines.length} chunks, vectors ${meta.count}`);

  // Unchanged text keeps its vector, wherever it sits in the corpus.
  const byText = new Map();
  oldLines.forEach((l, i) => { const t = JSON.parse(l).text; if (!byText.has(t)) byText.set(t, i); });

  const incoming = fs.readFileSync(WITH, 'utf8').split('\n').filter(Boolean);
  const out = [];
  let removed = 0;
  for (const l of oldLines) {
    if (SOURCES.has(JSON.parse(l).source)) {
      if (removed === 0) out.push(...incoming);
      removed += 1;
    } else out.push(l);
  }
  if (removed === 0) out.push(...incoming);

  const rows = out.map((l) => byText.get(JSON.parse(l).text));
  const todo = rows.flatMap((r, i) => (r === undefined ? [i] : []));
  console.log(`${path.basename(CORPUS)}: ${oldLines.length} chunks, removing ${removed} from ${[...SOURCES].join(', ')}, adding ${incoming.length}`);
  console.log(`  ${out.length - todo.length} vectors reused, ${todo.length} to embed with ${MODEL} at ${HOST}`);

  const outVec = Buffer.alloc(out.length * D * 4);
  rows.forEach((r, i) => { if (r !== undefined) vecs.copy(outVec, i * D * 4, r * D * 4, (r + 1) * D * 4); });
  for (let b = 0; b < todo.length; b += BATCH) {
    const ids = todo.slice(b, b + BATCH);
    // eslint-disable-next-line no-await-in-loop
    const got = await embed(ids.map((i) => JSON.parse(out[i]).text));
    got.forEach((v, j) => {
      if (v.length !== D) throw new Error(`embedder returned ${v.length} dims, expected ${D}`);
      for (let k = 0; k < D; k += 1) outVec.writeFloatLE(v[k], (ids[j] * D + k) * 4);
    });
    process.stdout.write(`\r  embedded ${Math.min(b + BATCH, todo.length)}/${todo.length}`);
  }
  if (todo.length) process.stdout.write('\n');

  const newBuf = Buffer.from(`${out.join('\n')}\n`, 'utf8');
  fs.writeFileSync(CORPUS, newBuf);
  fs.writeFileSync(VEC, outVec);
  fs.writeFileSync(META, `${JSON.stringify({ model: MODEL, dims: D, count: out.length, corpusHash: hashOf(newBuf) }, null, 2)}\n`);
  console.log(`wrote ${out.length} chunks and vectors, corpus ${hashOf(newBuf)}`);
})().catch((err) => { console.error(err.message); process.exit(1); });
