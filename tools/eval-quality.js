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
const SYSTEM = `Answer strictly from the DOCUMENTATION. If it does not contain the answer, reply exactly: "Not covered in the documentation." Never guess.\n\nDOCUMENTATION:${DOCS}`;

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
    for (const t of TESTS) {
      row.max += t.weight;
      try {
        const text = await gen(model, `${SYSTEM}\n\nQUESTION: ${t.q}\n\nANSWER:`, { temperature: 0.1, num_predict: 200 });
        const ok = t.pass(text);
        if (ok) row.score += t.weight;
        row.tests[t.name] = { pass: ok, text: text.slice(0, 200) };
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
    console.log(`${model.padEnd(20)} grounding ${String(row.score).padStart(2)}/${row.max}`
      + `   tweet ${row.writing.tweet?.ok ? 'ok ' : 'BAD'} (${row.writing.tweet?.chars ?? '?'} chars)`);
    for (const [n, t] of Object.entries(row.tests)) if (!t.pass) console.log(`    fail ${n}: ${t.text.slice(0, 110)}`);
  }
  console.log('\nfull answers and writing samples: eval-results.json');
})();
