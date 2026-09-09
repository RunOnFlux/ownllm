#!/usr/bin/env node
/**
 * Thread-scaling curve per model.
 *
 * The optimum is not "all the cores": on granite4:tiny-h both generation and
 * prefill peak at 8 threads and get worse after, because synchronisation
 * eventually costs more than the extra parallelism returns. Where that peak
 * sits depends on how much work there is per layer, so it moves with model
 * size - which is exactly why it is worth measuring per model rather than
 * assuming.
 *
 *   FLUX_LLM_KEY=... node tools/thread-sweep.js <host> [model ...]
 */
const fs = require('node:fs');

const HOST = process.argv[2];
const KEY = process.env.FLUX_LLM_KEY;
if (!HOST || !KEY) { console.error('usage: FLUX_LLM_KEY=... node tools/thread-sweep.js <host> [model ...]'); process.exit(1); }
const base = HOST.startsWith('http') ? HOST : `http://${HOST}`;
const MODELS = process.argv.slice(3).length ? process.argv.slice(3)
  : ['granite4:tiny-h', 'gemma3:4b', 'gpt-oss:20b'];
const THREADS = [2, 4, 6, 8, 10, 12];

const post = async body => {
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(900000),
  });
  return res.json();
};
// Fresh every call: a repeated prompt would be served from the prefix cache and
// report a prefill rate that has nothing to do with the model.
const filler = () => Array.from({ length: 2500 }, () => Math.random().toString(36).slice(2, 9)).join(' ');

(async () => {
  const out = {};
  for (const model of MODELS) {
    out[model] = [];
    console.log(`\n${model}`);
    console.log('  threads   generation      prefill');
    for (const n of THREADS) {
      try {
        const g = await post({ model, prompt: 'Write one sentence about clouds.', stream: false, options: { num_predict: 60, num_thread: n } });
        const p = await post({ model, prompt: `${filler()}\nReply: done`, stream: false, options: { num_predict: 3, num_thread: n } });
        if (g.error || p.error) throw new Error(String(g.error || p.error).slice(0, 60));
        const gen = g.eval_count / (g.eval_duration / 1e9);
        const pre = p.prompt_eval_count / (p.prompt_eval_duration / 1e9);
        out[model].push({ threads: n, gen, pre });
        console.log(`  ${String(n).padStart(4)}    ${gen.toFixed(1).padStart(7)} tok/s  ${pre.toFixed(0).padStart(7)} tok/s`);
      } catch (err) {
        console.log(`  ${String(n).padStart(4)}    failed: ${err.message}`);
      }
      fs.writeFileSync('thread-sweep.json', `${JSON.stringify(out, null, 2)}\n`);
    }
    const best = out[model].slice().sort((a, b) => b.pre - a.pre)[0];
    if (best) console.log(`  -> prefill peaks at ${best.threads} threads (${best.pre.toFixed(0)} tok/s)`);
  }
})();
