#!/usr/bin/env node
/**
 * Benchmarks candidate models on a live Flux instance: speed, and whether they
 * stay faithful to retrieved context.
 *
 * Speed alone picks the wrong model. A model that generates fast but invents
 * answers is useless as a documentation bot, and a reasoning model can spend
 * its whole token budget thinking and emit nothing at all (qwen3:4b did exactly
 * that). So every model is scored on three things: how fast it reads context,
 * whether it answers a grounded question correctly, and whether it refuses a
 * question the context cannot answer.
 *
 *   FLUX_LLM_KEY=... node tools/bench-models.js <host> [model ...]
 *
 * Pulls each model on demand and writes bench-results.json alongside the table.
 */
const fs = require('node:fs');

const HOST = process.argv[2];
const KEY = process.env.FLUX_LLM_KEY;
if (!HOST || !KEY) {
  console.error('usage: FLUX_LLM_KEY=... node tools/bench-models.js <host[:port]> [model ...]');
  process.exit(1);
}
const base = HOST.startsWith('http') ? HOST : `http://${HOST}`;

const DEFAULT_MODELS = [
  'granite4:micro-h', 'granite4:tiny-h', 'granite4:small-h',
  'gemma3:4b', 'gemma3:12b',
  'llama3.1:8b', 'llama3.2:3b',
  'phi4-mini:latest', 'mistral:7b', 'qwen3:4b-instruct',
  'qwen2.5:7b-instruct', 'olmo2:7b',
];
const MODELS = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_MODELS;
// With --cleanup, each model is deleted once measured. A survey of thirty
// candidates is hundreds of GB; keeping them all would need a volume nobody
// wants to pay for, and nothing here needs the model after its numbers are in.
// Models named in KEEP are never deleted - those are the ones being served.
const CLEANUP = process.argv.includes('--cleanup');
const KEEP = new Set((process.env.KEEP_MODELS || 'granite4:tiny-h,gemma3:4b,granite-embedding:278m').split(','));

// Real specification facts, the sort a retriever would hand the model.
const DOCS = `
Flux application specification v8:
- Maximum per app: 15 CPU cores, 59000 MB RAM, 820 GB SSD.
- cpu must be a multiple of 0.1; ram must be a multiple of 100; hdd whole GB.
- Maximum container image size is 5 GB.
- An app may have 1 to 100 instances.
- Minimum expire is 1 block; maximum is 1056000 blocks. 88000 blocks is one month.
- App names must not start with "flux" or "zel".
- Ports 0-1023, 8080, 8081, 8443 and 6667 carry an extra fee.
- Enterprise apps encrypt the compose and run only on ArcaneOS nodes.
`;
const SYSTEM = `You answer strictly from the DOCUMENTATION. If the answer is not in it, reply exactly: "Not covered in the documentation." Never guess.\n\nDOCUMENTATION:${DOCS}`;

const TESTS = [
  {
    name: 'grounded',
    q: 'What is the maximum container image size, and how many blocks is one month?',
    // both facts must appear; this is recall, not phrasing
    pass: r => /5\s*GB/i.test(r) && /88[,.]?000/.test(r),
  },
  {
    name: 'refusal',
    q: 'How many GPUs can I attach to a Flux app?',
    pass: r => /not covered in the documentation/i.test(r),
  },
];

const post = async (path, body, ms = 900000) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  // /api/pull answers with a stream of NDJSON progress objects even when asked
  // not to stream. Buffering that whole stream is what killed an earlier run:
  // a 19 GB model emits enough progress lines to exhaust memory. Read
  // incrementally and keep only the tail, which holds the final status.
  const text = await tailOf(res);
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split('\n').filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try { return JSON.parse(lines[i]); } catch { /* keep walking back */ }
    }
    return { error: `unparseable response: ${text.slice(0, 120)}` };
  }
};

/** Drains a response, retaining only the last 4 KB - enough for the final object. */
async function tailOf(res) {
  if (!res.body) return '';
  const decoder = new TextDecoder();
  let tail = '';
  for await (const piece of res.body) {
    tail = (tail + decoder.decode(piece, { stream: true })).slice(-4096);
  }
  return tail;
}

const rate = (count, ns) => (ns ? count / (ns / 1e9) : 0);

async function speed(model) {
  const gen = await post('/api/generate', {
    model, prompt: 'Write one sentence about decentralised computing.',
    stream: false, options: { num_predict: 60 },
  });
  if (gen.error) throw new Error(String(gen.error).slice(0, 90));
  // A fresh random prompt every run so nothing can be served from the prefix cache.
  const filler = Array.from({ length: 2500 }, () => Math.random().toString(36).slice(2, 9)).join(' ');
  const pre = await post('/api/generate', {
    model, prompt: `${filler}\nReply: done`, stream: false, options: { num_predict: 3 },
  });
  return {
    genTps: rate(gen.eval_count, gen.eval_duration),
    preTps: rate(pre.prompt_eval_count, pre.prompt_eval_duration),
  };
}

async function quality(model) {
  const out = {};
  for (const t of TESTS) {
    const r = await post('/api/generate', {
      model, prompt: `${SYSTEM}\n\nQUESTION: ${t.q}\n\nANSWER:`,
      stream: false, options: { num_predict: 200, temperature: 0.1 },
    });
    const text = (r.response || '').trim();
    out[t.name] = { pass: t.pass(text), text: text.slice(0, 300) };
  }
  const tweet = await post('/api/generate', {
    model, prompt: 'Write one tweet (under 280 characters) announcing that Flux now runs private AI models on decentralised nodes. No hashtags.',
    stream: false, options: { num_predict: 120, temperature: 0.7 },
  });
  out.tweet = (tweet.response || '').trim().slice(0, 300);
  return out;
}

(async () => {
  const results = [];
  for (const model of MODELS) {
    process.stdout.write(`pulling ${model} ... `);
    const pull = await post('/api/pull', { model, stream: false }, 3600000);
    if (pull.error) { console.log(`skip (${String(pull.error).slice(0, 60)})`); results.push({ model, error: String(pull.error).slice(0, 80) }); continue; }
    console.log('ok');
    try {
      const s = await speed(model);
      const q = await quality(model);
      results.push({ model, ...s, ...q });
      console.log(`  ${model}: ${s.genTps.toFixed(1)} gen/s, ${s.preTps.toFixed(1)} pre/s, `
        + `grounded=${q.grounded.pass ? 'PASS' : 'fail'} refusal=${q.refusal.pass ? 'PASS' : 'fail'}`);
    } catch (err) {
      console.log(`  ${model}: FAILED ${err.message}`);
      results.push({ model, error: err.message });
    }
    // Written after every model: a survey this long must not lose everything
    // to one crash at the end.
    fs.writeFileSync('bench-results.json', `${JSON.stringify(results, null, 2)}\n`);
    if (CLEANUP && !KEEP.has(model)) {
      await fetch(`${base}/api/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      }).then(() => console.log(`  (removed ${model})`)).catch(() => {});
    }
  }

  fs.writeFileSync('bench-results.json', `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\n${'model'.padEnd(22)}${'gen'.padStart(8)}${'prefill'.padStart(9)}${'4k TTFT'.padStart(9)}  grounded  refusal`);
  for (const r of results.filter(x => !x.error).sort((a, b) => b.preTps - a.preTps)) {
    console.log(
      r.model.padEnd(22)
      + `${r.genTps.toFixed(1)}/s`.padStart(8)
      + `${r.preTps.toFixed(0)}/s`.padStart(9)
      + `${(4000 / r.preTps).toFixed(0)}s`.padStart(9)
      + `  ${r.grounded.pass ? '  PASS  ' : '  fail  '}`
      + `  ${r.refusal.pass ? 'PASS' : 'fail'}`,
    );
  }
  console.log('\nfull answers and tweets: bench-results.json');
})();
