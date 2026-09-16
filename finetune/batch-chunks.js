#!/usr/bin/env node
/**
 * Sample corpus chunks into batch files for a teacher that works from files
 * (a Claude Code subagent) rather than an API. Each batch holds items with
 * the retrieved-style context already assembled - the target chunk plus a
 * sibling from the same document and one unrelated chunk, shuffled, plus a
 * few pure-refusal items whose context is unrelated to the target - and the
 * exact prompt prefix the docs bot uses. The teacher writes questions and
 * answers; verify-docs.js checks them.
 *
 *   node finetune/batch-chunks.js --n 500 --per-batch 25 --out finetune/data/batches
 */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const N = Number(opt('n', 500)); const PER = Number(opt('per-batch', 25));
const OUT = opt('out', path.join(__dirname, 'data', 'batches'));
const CORPUS = opt('corpus', path.join(__dirname, '..', 'images', 'docsbot', 'docs', 'corpus.jsonl'));
let seed = Number(opt('seed', 11));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const TIERS = new Set(['docs', 'facts', 'howto', 'product-repo', 'website']);
// Internal product repos are in the corpus for the enterprise bot; the public
// assistant must not be taught from them.
const INTERNAL = /fluxai-enterprise|ssp-enterprise|brimley|fluxai-beaver|console-api|beaverai|RunOnFlux\/ownllm/i;
const chunks = fs.readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((c) => c && TIERS.has(c.tier) && c.text && c.text.length > 300 && c.text.length < 6000 && !/glossary|terms of service|privacy policy|CHANGELOG|LICENSE/i.test(c.source || '') && !INTERNAL.test(`${c.origin || ''} ${c.source || ''}`));
const bySource = new Map();
for (const c of chunks) { if (!bySource.has(c.source)) bySource.set(c.source, []); bySource.get(c.source).push(c); }
// weight real docs over repo files so questions look like user questions
// Weight: Flux docs x3, other docs/facts x2, the rest x1.
const weighted = chunks.filter((c) => /flux-docs|runonflux\.com|cloud\.runonflux|fluxedge/i.test(c.origin || '') && c.tier === 'docs').flatMap((c) => [c, c, c])
  .concat(chunks.filter((c) => c.tier === 'docs' || c.tier === 'facts' || c.tier === 'howto'))
  .concat(chunks);
fs.mkdirSync(OUT, { recursive: true });
const items = [];
const used = new Set();
while (items.length < N) {
  const t = pick(weighted); if (used.has(t)) continue; used.add(t);
  const refusal = rnd() < 0.15;
  let ctx;
  if (refusal) { ctx = []; while (ctx.length < 3) { const c = pick(chunks); if (c.source !== t.source && !ctx.includes(c)) ctx.push(c); } }
  else { const sib = shuffle((bySource.get(t.source) || []).filter((c) => c !== t)).slice(0, 1); let o; do { o = pick(chunks); } while (o.source === t.source); ctx = shuffle([t, ...sib, o]); }
  items.push({ id: items.length + 1, refusal, target: { source: t.source, heading: t.heading || '', text: t.text }, context: ctx.map((c, i) => ({ n: i + 1, source: c.source, heading: c.heading || '', text: c.text })) });
}
let b = 0;
for (let i = 0; i < items.length; i += PER) { b += 1; fs.writeFileSync(path.join(OUT, `batch-${String(b).padStart(2, '0')}.json`), JSON.stringify(items.slice(i, i + PER), null, 1)); }
console.log(`${items.length} items in ${b} batches -> ${OUT} (${items.filter((x) => x.refusal).length} refusal items)`);
