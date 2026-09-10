#!/usr/bin/env node
/**
 * Precomputes corpus embeddings so the docs bot does not embed at boot.
 *
 * Embedding 26,879 chunks on a CPU node took 4.5 hours per instance, repeated
 * on every migration. The corpus is baked into the image and never changes at
 * runtime, so the vectors can be baked in too and boot becomes a file read.
 *
 * Written to survive being killed. An earlier version held every parsed chunk
 * and the whole 83 MB output array in memory, was killed by memory pressure at
 * 5,280 chunks, and lost all of it. This version keeps one batch in memory,
 * writes each batch straight to its offset in a preallocated file, and records
 * progress - so it resumes rather than restarting.
 *
 *   node tools/embed-corpus.js [corpus.jsonl] --host http://ip:33000
 */
const fs = require('node:fs');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const CORPUS = args.find(a => !a.startsWith('--') && a.endsWith('.jsonl')) || 'images/docsbot/docs/corpus.jsonl';
const HOST = flag('--host', process.env.OLLAMA_HOST || 'http://127.0.0.1:11434');
const KEY = process.env.FLUX_LLM_KEY || '';
const MODEL = flag('--model', 'granite-embedding:278m');
const BATCH = Number(flag('--batch', 96));
const CONC = Number(flag('--concurrency', 3));
const DIMS = Number(flag('--dims', 768));

const VEC = `${CORPUS}.vec`;
const META = `${CORPUS}.vec.json`;
const PROG = `${CORPUS}.vec.progress`;

// Raw lines only. Parsing all 26,879 into objects up front was a large part of
// what got the previous version killed; each batch is parsed as it is needed.
const lines = fs.readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean);
const count = lines.length;
const corpusHash = crypto.createHash('sha256').update(fs.readFileSync(CORPUS)).digest('hex').slice(0, 16);
console.log(`${CORPUS}: ${count.toLocaleString()} chunks, hash ${corpusHash}`);

// Preallocate so every batch can be written at its own offset, in any order.
const bytes = count * DIMS * 4;
if (!fs.existsSync(VEC) || fs.statSync(VEC).size !== bytes) {
  fs.writeFileSync(VEC, Buffer.alloc(0));
  fs.truncateSync(VEC, bytes);
  fs.writeFileSync(PROG, JSON.stringify({ corpusHash, done: [] }));
  console.log(`  allocated ${(bytes / 1e6).toFixed(0)} MB`);
}

let done = new Set();
try {
  const p = JSON.parse(fs.readFileSync(PROG, 'utf8'));
  if (p.corpusHash === corpusHash) done = new Set(p.done);
  else console.log('  progress file is for a different corpus, starting over');
} catch { /* no progress yet */ }

const offsets = [];
for (let i = 0; i < count; i += BATCH) offsets.push(i);
const todo = offsets.filter(o => !done.has(o));
if (done.size) console.log(`  resuming: ${done.size}/${offsets.length} batches already done`);

const fd = fs.openSync(VEC, 'r+');
let next = 0;
let completed = done.size;
const started = Date.now();

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

function saveProgress() {
  fs.writeFileSync(PROG, JSON.stringify({ corpusHash, done: [...done] }));
}

async function worker() {
  for (;;) {
    const idx = next; next += 1;
    if (idx >= todo.length) return;
    const start = todo[idx];
    const batch = lines.slice(start, start + BATCH).map(l => JSON.parse(l).text);
    let vecs;
    try {
      // eslint-disable-next-line no-await-in-loop
      vecs = await embed(batch);
    } catch (err) {
      console.error(`\n  batch at ${start} failed: ${err.message} - will retry on the next run`);
      continue;
    }
    const buf = Buffer.allocUnsafe(vecs.length * DIMS * 4);
    vecs.forEach((v, j) => { for (let k = 0; k < DIMS; k += 1) buf.writeFloatLE(v[k], (j * DIMS + k) * 4); });
    fs.writeSync(fd, buf, 0, buf.length, start * DIMS * 4);
    done.add(start);
    completed += 1;
    // Every batch. The progress file is a few hundred integers; writing it
    // costs nothing next to a batch that takes ~40 seconds to embed, and it
    // caps what a kill can lose at one batch instead of ten.
    saveProgress();
    const rate = ((completed - (offsets.length - todo.length)) * BATCH) / ((Date.now() - started) / 60000);
    process.stdout.write(`\r  ${(completed * BATCH).toLocaleString()}/${count.toLocaleString()}  ${rate.toFixed(0)}/min  eta ${(((offsets.length - completed) * BATCH) / Math.max(rate, 1)).toFixed(0)}m   `);
  }
}

(async () => {
  await Promise.all(Array.from({ length: CONC }, worker));
  saveProgress();
  fs.closeSync(fd);
  process.stdout.write('\n');
  if (done.size === offsets.length) {
    fs.writeFileSync(META, `${JSON.stringify({ model: MODEL, dims: DIMS, count, corpusHash }, null, 2)}\n`);
    fs.unlinkSync(PROG);
    console.log(`complete: ${VEC} (${(bytes / 1e6).toFixed(0)} MB) for corpus ${corpusHash}`);
  } else {
    console.log(`incomplete: ${done.size}/${offsets.length} batches. Re-run to resume; no metadata written yet.`);
  }
})();
