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
let seed = Number(opt('seed', 3));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const readAll = (csv) => csv.split(',').map((p) => p.trim()).filter(Boolean).flatMap((p) => { const rows = read(p); console.log(`${rows.length.toString().padStart(6)} ${path.basename(p)}`); return rows; });
const rows = [...readAll(DOCS).map((r) => ({ messages: r.messages })), ...readAll(DEPLOY).map((r) => ({ messages: r.messages, tools: r.tools }))];
for (let i = rows.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
const nEval = Math.max(20, Math.round(rows.length * FRAC));
fs.writeFileSync(path.join(D, 'eval.jsonl'), rows.slice(0, nEval).map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(D, 'train.jsonl'), rows.slice(nEval).map((r) => JSON.stringify(r)).join('\n') + '\n');
const tools = rows.filter((r) => r.tools).length;
console.log(`${rows.length} examples (${tools} with tools, ${rows.length - tools} docs) -> train ${rows.length - nEval}, eval ${nEval}`);
