#!/usr/bin/env node
/**
 * Mix the generated sets into train/eval splits.
 *
 * Docs examples carry no tools; deploy examples carry the compact tool
 * schema. Both are plain chat JSONL, so they train together and the model
 * learns when tools are in play from the presence of the schema. The eval
 * split is by whole conversation (never the same dialogue in both), 5%.
 *
 *   node finetune/mix.js [--docs data/docs.jsonl] [--deploy data/deploy.jsonl] [--eval-frac 0.05] [--seed 3]
 */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const D = path.join(__dirname, 'data');
// Comma-separated lists: every docs set and every deploy set that exists.
const DOCS = opt('docs', ['docs-v1-public.jsonl', 'docs-v2.jsonl'].map((f) => path.join(D, f)).join(','));
const DEPLOY = opt('deploy', ['deploy-v2.jsonl', 'marketplace-deploy.jsonl'].map((f) => path.join(D, f)).join(','));
const FRAC = Number(opt('eval-frac', 0.05));
// Docs rows are repeated this many times in the train split (not in eval): one
// epoch of the deploy data was enough for tool use, but docs grounding fell back
// to the base level in v2, so v3 gives the docs a second pass.
const DOCS_WEIGHT = Number(opt('docs-weight', 2));
let seed = Number(opt('seed', 3));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const readAll = (csv) => csv.split(',').map((p) => p.trim()).filter(Boolean).flatMap((p) => { const rows = read(p); console.log(`${rows.length.toString().padStart(6)} ${path.basename(p)}`); return rows; });
// A third of the docs rows get a deploy-agent surface (system prompt + tools) in
// front of them: in the Flux Cloud chat the tools are always present, and a
// knowledge question must be answered without calling any.
const surfaces = require('./surfaces');
const withSurface = (r) => { if (rnd() >= 0.33) return { messages: r.messages }; const surf = surfaces.sample(rnd); return { messages: [{ role: 'system', content: surf.system }, ...r.messages.filter((m) => m.role !== 'system')], tools: surf.tools }; };
const rows = [...readAll(DOCS).map(withSurface), ...readAll(DEPLOY).map((r) => ({ messages: r.messages, tools: r.tools }))];
for (let i = rows.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
const nEval = Math.max(20, Math.round(rows.length * FRAC));
fs.writeFileSync(path.join(D, 'eval.jsonl'), rows.slice(0, nEval).map((r) => JSON.stringify(r)).join('\n') + '\n');
const train = rows.slice(nEval).flatMap((r) => (r.tools ? [r] : Array.from({ length: DOCS_WEIGHT }, () => r)));
for (let i = train.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [train[i], train[j]] = [train[j], train[i]]; }
fs.writeFileSync(path.join(D, 'train.jsonl'), train.map((r) => JSON.stringify(r)).join('\n') + '\n');
const tools = rows.filter((r) => r.tools).length;
console.log(`${rows.length} examples (${tools} with tools, ${rows.length - tools} docs, docs x${DOCS_WEIGHT} in train) -> train ${train.length}, eval ${nEval}`);
