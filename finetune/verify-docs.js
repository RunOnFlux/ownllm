#!/usr/bin/env node
/**
 * Turn teacher-written batches into training examples, keeping only what
 * verifies: for each item the teacher wrote `qa: [{question, answer}]`. An
 * answer is kept if every [n] it cites exists in the item's context, every
 * number it states appears in a cited chunk, it has no URLs or headings, and
 * for refusal items it is exactly the refusal line. The example's user turn
 * is the docs bot's real prompt over the context.
 *
 *   node finetune/verify-docs.js --in finetune/data/batches-out --out finetune/data/docs.jsonl
 */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const IN = opt('in', path.join(__dirname, 'data', 'batches-out'));
const OUT = opt('out', path.join(__dirname, 'data', 'docs.jsonl'));
const INSTRUCTION = 'You answer strictly from the DOCUMENTATION below. Cite the sources you used as [1], [2]. '
  + 'Answer the question that was asked, concisely, in plain prose or as a numbered list of at most eight short steps (1., 2., ...). '
  + 'Put citations like [1] at the end of a sentence; never use [1] as a step number. '
  + 'State figures as the documentation gives them; do not explain how a figure is derived unless asked. '
  + 'Stop after the last sentence of the answer - no list of sources, no headings, no links, and do not mention "the documentation". '
  + 'If the documentation does not contain the answer, reply exactly: "Not covered in the documentation." '
  + 'Never guess and never use outside knowledge.\n\n';
const REFUSAL = 'Not covered in the documentation.';
const prompt = (q, ctx) => `${INSTRUCTION}RETRIEVED DOCUMENTATION:\n${ctx.map((h) => `[${h.n}]\n${h.text}`).join('\n\n')}\n\nQUESTION: ${q}\n\nANSWER:`;
function verify(answer, ctx, refusal) {
  if (!answer || typeof answer !== 'string') return 'empty';
  answer = answer.trim();
  if (refusal) return answer === REFUSAL ? null : 'refusal-expected';
  if (answer === REFUSAL) return null; // teacher judged it unanswerable: fine
  if (/https?:\/\/|^#|\n#/i.test(answer)) return 'url-or-heading';
  if (/the documentation/i.test(answer)) return 'mentions-documentation';
  if (answer.length > 1500) return 'too-long';
  const cites = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (!cites.length) return 'no-citation';
  if (cites.some((n) => n < 1 || n > ctx.length)) return 'bad-citation';
  const cited = ctx.filter((h) => cites.includes(h.n)).map((h) => h.text).join('\n');
  const citedBare = cited.replace(/,/g, '');
  const nums = (answer.replace(/\[\d+\]/g, '').match(/\d[\d,.]*/g) || []).map((x) => x.replace(/[,.]$/, ''));
  for (const n of nums) { if (/^[1-8]$/.test(n)) continue; if (!cited.includes(n) && !citedBare.includes(n.replace(/,/g, ''))) return `number-not-in-source:${n}`; }
  return null;
}
const reasons = {}; let kept = 0; let total = 0;
const out = fs.createWriteStream(OUT);
for (const f of fs.readdirSync(IN).filter((x) => x.endsWith('.json')).sort()) {
  let items; try { items = JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')); } catch (e) { reasons[`parse:${f}`] = 1; continue; }
  for (const it of items) {
    for (const qa of it.qa || []) {
      total += 1;
      const why = verify(qa.answer, it.context, it.refusal);
      if (why) { reasons[why.split(':')[0]] = (reasons[why.split(':')[0]] || 0) + 1; continue; }
      out.write(`${JSON.stringify({ messages: [{ role: 'user', content: prompt(qa.question, it.context) }, { role: 'assistant', content: qa.answer.trim() }], meta: { source: it.target.source, refusal: !!it.refusal } })}\n`);
      kept += 1;
    }
  }
}
out.end();
console.log(`kept ${kept} of ${total} -> ${OUT}; rejected: ${JSON.stringify(reasons)}`);
