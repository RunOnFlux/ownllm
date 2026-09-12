#!/usr/bin/env node
/**
 * Harder evaluation than bench-models.js, which every model passed.
 *
 * That easy pass was itself a result: with a strict system prompt, even a 1.9 GB
 * model refuses questions its context cannot answer. So refusal alone does not
 * rank anything. What separates models is whether they stay correct when the
 * context is adversarial - a chunk that looks relevant but answers a different
 * question, two numbers that could be confused, or a fact that has to be
 * combined from two places.
 *
 *   FLUX_LLM_KEY=... node tools/eval-quality.js <host> [model ...]
 */
const fs = require('node:fs');

const HOST = process.argv[2];
const KEY = process.env.FLUX_LLM_KEY;
if (!HOST || !KEY) { console.error('usage: FLUX_LLM_KEY=... node tools/eval-quality.js <host> [model ...]'); process.exit(1); }
const base = HOST.startsWith('http') ? HOST : `http://${HOST}`;
const MODELS = process.argv.slice(3).length ? process.argv.slice(3)
  : ['granite4:tiny-h', 'granite4:micro-h', 'gemma3:4b', 'llama3.2:3b'];

// Deliberately includes near-miss distractors: several different limits, two
// different block counts, and tier numbers that are easy to swap.
const DOCS = `
[A] Flux app resource limits
Maximum per application: 15 CPU cores, 59000 MB RAM, 820 GB SSD.
A NIMBUS node offers applications 7.0 cores and 28000 MB.
A CUMULUS node offers applications 3.0 cores and 5000 MB.

[B] Image and filesystem limits
The container image must be 5 GB or smaller.
The container root filesystem is capped at 10 GB.
The persistent volume is created at exactly the hdd size requested.

[C] Lifetime
Minimum expire is 1 block. Maximum expire is 1056000 blocks.
Since the PON fork a block takes about 30 seconds, so 88000 blocks is one month.

[D] Instances
An application may have between 1 and 100 instances.

[E] Enterprise
Enterprise applications encrypt the compose section and run only on ArcaneOS
nodes. Every component must support the amd64 architecture.
`;
// EVAL_PROMPT=soft swaps the strict instruction for a gentler one. Small models
// read "Never guess" as "refuse when in doubt" and refuse covered questions;
// the same model with the soft prompt answers them. Score both when comparing
// models of very different size, or the prompt is what gets measured.
const STRICT = `Answer strictly from the DOCUMENTATION. If it does not contain the answer, reply exactly: "Not covered in the documentation." Never guess.\n\nDOCUMENTATION:${DOCS}`;
const SOFT = `You answer questions about Flux using only the DOCUMENTATION below. Quote the relevant figure. If the documentation really says nothing about the question, say "Not covered in the documentation."\n\nDOCUMENTATION:${DOCS}`;
const SYSTEM = process.env.EVAL_PROMPT === 'soft' ? SOFT : STRICT;

const TESTS = [
  { name: 'distractor-ram', weight: 1,
    q: 'How much RAM can an application use on a NIMBUS node?',
    // 28000 is right; 59000 and 5000 are the plausible wrong answers
    pass: r => /28[,.]?000/.test(r) && !/59[,.]?000/.test(r) },
  { name: 'distractor-size', weight: 1,
    q: 'What is the maximum size of a container image?',
    // 5 GB is right; 10 GB (rootfs) is the trap
    pass: r => /5\s*GB/i.test(r) && !/10\s*GB/i.test(r) },
  { name: 'multi-hop', weight: 2,
    q: 'If I deploy for the maximum allowed expire, roughly how many months is that?',
    // 1056000 / 88000 = 12; requires combining [C]'s two facts
    pass: r => /\b12\b|twelve/i.test(r) },
  { name: 'refusal-plausible', weight: 2,
    q: 'How much does a STRATUS node cost to run per month?',
    pass: r => /not covered in the documentation/i.test(r) },
  { name: 'refusal-adjacent', weight: 2,
    // GPU is never mentioned, but "cores" and "nodes" are, which tempts a guess
    q: 'How many GPU cores does a NIMBUS node give an application?',
    pass: r => /not covered in the documentation/i.test(r) },
  { name: 'no-overreach', weight: 1,
    q: 'How many instances can an application have?',
    pass: r => /100/.test(r) && /\b1\b|one/i.test(r) },
];

const WRITING = [
  { name: 'tweet', limit: 280,
    prompt: 'Write one tweet, under 280 characters, announcing that Flux now runs private AI models on decentralised nodes. No hashtags, no emoji.',
    check: t => t.length <= 280 && !t.includes('#') },
  { name: 'intro',
    prompt: 'Write a two-sentence opening for a blog post about deploying your own AI model on Flux. Plain, concrete, no marketing cliches.',
    check: t => t.split(/[.!?]\s/).filter(Boolean).length <= 3 && t.length > 40 },
];

/** Drains a response keeping only the tail: pull progress is megabytes of NDJSON. */
async function tailOf(res) {
  if (!res.body) return '';
  const decoder = new TextDecoder();
  let tail = '';
  for await (const piece of res.body) tail = (tail + decoder.decode(piece, { stream: true })).slice(-4096);
  return tail;
}

/**
 * Ensure the model is present. Without this the whole run reports 0/9 with
 * "model not found" for every test, which looks like a catastrophic quality
 * result rather than a missing download.
 */
async function ensure(model) {
  const res = await fetch(`${base}/api/pull`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false }),
    signal: AbortSignal.timeout(3600000),
  });
  const text = await tailOf(res);
  const lines = text.split('\n').filter(l => l.trim());
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.error) throw new Error(String(obj.error).slice(0, 80));
      return;
    } catch (err) { if (err.message && !/JSON/.test(err.message)) throw err; }
  }
}

/**
 * Reasoning models emit a <think> block before the answer. Scoring the raw
 * response counts facts that appear only inside that reasoning as though the
 * model had answered - lfm2.5 scored PASS in the speed bench purely because
 * "5 GB" appeared while it was thinking aloud, then ran out of budget before
 * producing an answer. Strip it, so what is scored is what a user would see.
 */
function visible(text) {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // An unterminated block means the model never finished thinking: nothing
  // reached the user at all.
  return /<think>/i.test(closed) ? '' : closed;
}

/**
 * Some models reason out loud in plain prose with no tag to strip -
 * granite4.2:3b opens every answer with "We need to answer strictly from the
 * DOCUMENTATION. The question: ..." and scored a perfect 9/9 purely because the
 * facts appeared somewhere in that deliberation.
 *
 * Scoring the tail defeats both shapes: a model that reasons and then answers
 * is still credited, a model that only reasons is not. The length is reported
 * alongside, because reaching the answer after 900 characters of thinking is a
 * real cost even when the answer is right.
 */
const ANSWER_TAIL = 300;
const tail = t => t.slice(-ANSWER_TAIL);

async function gen(model, prompt, opts) {
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: opts }),
    signal: AbortSignal.timeout(900000),
  });
  const body = await res.json();
  if (body.error) throw new Error(String(body.error).slice(0, 80));
  return (body.response || '').trim();
}

(async () => {
  const all = [];
  for (const model of MODELS) {
    const row = { model, tests: {}, writing: {}, score: 0, max: 0 };
    process.stdout.write(`pulling ${model} ... `);
    try { await ensure(model); console.log('ok'); }
    catch (err) { console.log(`skip (${err.message})`); continue; }
    for (const t of TESTS) {
      row.max += t.weight;
      try {
        const raw = await gen(model, `${SYSTEM}\n\nQUESTION: ${t.q}\n\nANSWER:`, { temperature: 0.1, num_predict: 200 });
        const text = visible(raw);
        const ok = t.pass(tail(text));
        if (ok) row.score += t.weight;
        row.tests[t.name] = { pass: ok, chars: text.length, text: text.slice(0, 200) };
      } catch (err) { row.tests[t.name] = { pass: false, text: `ERROR ${err.message}` }; }
    }
    for (const w of WRITING) {
      try {
        const text = await gen(model, w.prompt, { temperature: 0.7, num_predict: 200 });
        row.writing[w.name] = { ok: w.check(text), chars: text.length, text };
      } catch (err) { row.writing[w.name] = { ok: false, text: `ERROR ${err.message}` }; }
    }
    all.push(row);
    // Written after every model so a crash cannot lose the whole run.
    fs.writeFileSync('eval-results.json', `${JSON.stringify(all, null, 2)}\n`);
    const verbosity = Math.round(Object.values(row.tests).reduce((a, t) => a + (t.chars || 0), 0)
      / Math.max(1, Object.keys(row.tests).length));
    console.log(`${model.padEnd(20)} grounding ${String(row.score).padStart(2)}/${row.max}`
      + `   avg answer ${String(verbosity).padStart(4)} chars`
      + `   tweet ${row.writing.tweet?.ok ? 'ok ' : 'BAD'} (${row.writing.tweet?.chars ?? '?'} chars)`);
    for (const [n, t] of Object.entries(row.tests)) if (!t.pass) console.log(`    fail ${n}: ${t.text.slice(0, 110)}`);
  }
  console.log('\nfull answers and writing samples: eval-results.json');
})();
