#!/usr/bin/env node
/**
 * Knowledge-bot training examples from the documentation corpus.
 *
 * For a sampled chunk the teacher writes questions a real user would ask and
 * answers grounded ONLY in a small retrieved-style context (the chunk plus a
 * few neighbours from the same document, in random order), in exactly the
 * style the docs bot is prompted for: concise prose or numbered steps,
 * citations [n] at sentence ends, no source list, and "Not covered in the
 * documentation." when the context does not answer. Every example is built
 * with the docs bot's own prompt text so training matches serving.
 *
 * Verification: an answer is kept only if every [n] it cites exists in the
 * context, every number it states appears in the cited chunks, and it does
 * not contain URLs or headings. Refusal examples are made by pairing a
 * question with unrelated chunks.
 *
 *   TEACHER_BASE=http://localhost:8799/v1 TEACHER_MODEL=gpt-oss:20b TEACHER_KEY=... \
 *   node finetune/gen-docs.js --n 1500 --out finetune/data/docs.jsonl [--concurrency 12] [--corpus images/docsbot/docs/corpus.jsonl]
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const N = Number(opt('n', 500));
const OUT = opt('out', path.join(__dirname, 'data', 'docs.jsonl'));
const CONC = Number(opt('concurrency', 8));
const CORPUS = opt('corpus', path.join(__dirname, '..', 'images', 'docsbot', 'docs', 'corpus.jsonl'));
const SEED = Number(opt('seed', 11));
const TEACHER = { base: (process.env.TEACHER_BASE || 'http://localhost:8799/v1').replace(/\/$/, ''), model: process.env.TEACHER_MODEL || 'gpt-oss:20b', key: process.env.TEACHER_KEY || '' };
if (!TEACHER.key) { console.error('TEACHER_KEY required'); process.exit(1); }

let seed = SEED;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Must match images/docsbot/server.js buildPrompt() word for word.
const INSTRUCTION = 'You answer strictly from the DOCUMENTATION below. Cite the sources you used as [1], [2]. '
  + 'Answer the question that was asked, concisely, in plain prose or as a numbered list of at most eight short steps (1., 2., ...). '
  + 'Put citations like [1] at the end of a sentence; never use [1] as a step number. '
  + 'State figures as the documentation gives them; do not explain how a figure is derived unless asked. '
  + 'Stop after the last sentence of the answer - no list of sources, no headings, no links, and do not mention "the documentation". '
  + 'If the documentation does not contain the answer, reply exactly: "Not covered in the documentation." '
  + 'Never guess and never use outside knowledge.\n\n';
const REFUSAL = 'Not covered in the documentation.';

// Chunks worth asking about: real docs and generated facts, not glossary
// filler or terms of service; long enough to hold an answer.
const TIERS = new Set(['docs', 'facts', 'howto', 'enterprise', 'product-repo']);
const chunks = fs.readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((c) => c && TIERS.has(c.tier) && c.text && c.text.length > 300 && !/glossary|terms of service|privacy policy/i.test(c.source || ''));
const bySource = new Map();
for (const c of chunks) { if (!bySource.has(c.source)) bySource.set(c.source, []); bySource.get(c.source).push(c); }
console.error(`${chunks.length} candidate chunks from ${bySource.size} documents`);

function contextFor(target, refusal = false) {
  const siblings = (bySource.get(target.source) || []).filter((c) => c !== target);
  const others = [];
  while (others.length < 2) { const c = pick(chunks); if (c.source !== target.source) others.push(c); }
  const set = refusal ? [pick(chunks), pick(chunks), pick(chunks)].filter((c) => c.source !== target.source).slice(0, 3)
    : shuffle([target, ...shuffle(siblings).slice(0, 1), ...others.slice(0, 1)]);
  return set.length ? set : [others[0]];
}
const render = (ctx) => ctx.map((h, i) => `[${i + 1}]\n${h.text}`).join('\n\n');
const prompt = (question, ctx) => `${INSTRUCTION}RETRIEVED DOCUMENTATION:\n${render(ctx)}\n\nQUESTION: ${question}\n\nANSWER:`;

async function teacher(system, user, maxTokens = 700) {
  const res = await fetch(`${TEACHER.base}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEACHER.key}` },
    // reasoning_effort low: gpt-oss otherwise spends the whole budget thinking
    // about a 2,500-character excerpt and returns empty content.
    body: JSON.stringify({ model: TEACHER.model, temperature: 0.7, max_tokens: maxTokens, reasoning_effort: 'low', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(900000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const j = await res.json().catch(() => null);
  return (j?.choices?.[0]?.message?.content || '').trim();
}

/** Questions a user might ask that THIS chunk answers. */
async function questionsFor(chunk) {
  const out = await teacher(
    'You write questions that real users of a product would type into a documentation chatbot. Given a documentation excerpt, write 3 short, natural, specific questions that the excerpt answers (different angles: a how-to, a what-is, a figure or limit). Do not mention "the excerpt" or "the documentation". One question per line, no numbering, no quotes.',
    `Product: Flux (decentralized cloud), FluxOS, Flux Cloud, SSP Wallet, Zelcore.\nSource: ${chunk.source}\nHeading: ${chunk.heading || ''}\n\n${chunk.text.slice(0, 2500)}`, 700);
  return (out || '').split('\n').map((l) => l.replace(/^[\d.\-*)\s]+/, '').trim()).filter((l) => l.length > 12 && l.length < 200 && /\?$/.test(l)).slice(0, 3);
}

/** The grounded answer, written under the bot's own instruction. */
async function answerFor(question, ctx) {
  return teacher('You are a documentation assistant. Follow the instruction in the message exactly.', prompt(question, ctx), 1400);
}

function verify(answer, ctx) {
  if (!answer) return false;
  if (/https?:\/\/|^#|\n#|\[\d+\]\s*(source|http)/i.test(answer)) return false;
  if (answer.length > 1400) return false;
  const cites = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (!cites.length || cites.some((n) => n < 1 || n > ctx.length)) return false;
  const cited = cites.map((n) => ctx[n - 1].text).join('\n');
  // Every number in the answer must come from a cited chunk (allowing
  // thousands separators and step numbers 1-8).
  const nums = (answer.replace(/\[\d+\]/g, '').match(/\d[\d,.]*/g) || []).map((x) => x.replace(/[,.]$/, ''));
  for (const n of nums) {
    if (/^[1-8]$/.test(n)) continue;
    const bare = n.replace(/,/g, '');
    if (!cited.includes(n) && !cited.replace(/,/g, '').includes(bare)) return false;
  }
  return true;
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const outStream = fs.createWriteStream(OUT);
  let written = 0; let refusals = 0; let rejected = 0; let attempts = 0;
  const jobs = Array.from({ length: Math.ceil(N / 3) }, () => pick(chunks));
  async function worker() {
    while (jobs.length && written < N) {
      const chunk = jobs.pop();
      const qs = await questionsFor(chunk);
      for (const q of qs) {
        attempts += 1;
        const refusal = rnd() < 0.15;
        const ctx = contextFor(chunk, refusal);
        let answer;
        if (refusal) answer = REFUSAL;
        else { answer = await answerFor(q, ctx); if (!verify(answer, ctx)) { rejected += 1; continue; } }
        outStream.write(`${JSON.stringify({ messages: [{ role: 'user', content: prompt(q, ctx) }, { role: 'assistant', content: answer }], meta: { source: chunk.source, refusal } })}\n`);
        written += 1; if (refusal) refusals += 1;
        if (written % 25 === 0) process.stderr.write(`${written}/${N} written, ${rejected} rejected of ${attempts}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  outStream.end();
  console.log(`wrote ${written} examples to ${OUT} (${refusals} refusals, ${rejected} rejected by verification of ${attempts})`);
})();
