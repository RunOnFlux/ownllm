#!/usr/bin/env node
/**
 * A deliberately small coding agent for CPU models.
 *
 * Full harnesses (opencode, Claude Code) open with 10k+ tokens of system
 * prompt and tool schemas. On a CPU node that is 15-25 minutes of prefill
 * before the first token of the first turn - measured: gpt-oss:20b took 27
 * minutes for one opencode turn and then wrote no file. This agent keeps the
 * prompt to a few hundred tokens and four tools, so a turn costs what the
 * model actually says, not what the harness says first.
 *
 *   FLUX_LLM_KEY=sk-flux-... node tools/mini-agent.js --model gpt-oss:20b --dir ./site "Build a landing page..."
 *   options: --base https://llm.runonflux.com/v1  --max-turns 12  --max-tokens 3000
 *
 * Tools: list_files, read_file, write_file, done. Files stay inside --dir.
 * Prints every turn with timings so the cost of each step is visible.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const BASE = (opt('base', 'https://llm.runonflux.com/v1')).replace(/\/$/, '');
const MODEL = opt('model', 'gpt-oss:20b');
const DIR = path.resolve(opt('dir', './agent-out'));
const MAX_TURNS = Number(opt('max-turns', 12));
const MAX_TOKENS = Number(opt('max-tokens', 3000));
const KEY = process.env.FLUX_LLM_KEY;
const TASK = args.filter(a => !a.startsWith('--')).join(' ');
if (!KEY || !TASK) { console.error('usage: FLUX_LLM_KEY=... node tools/mini-agent.js [--model m] [--dir d] "task"'); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });

const safe = (p) => {
  const full = path.resolve(DIR, p);
  if (!full.startsWith(DIR + path.sep) && full !== DIR) throw new Error(`path escapes the work dir: ${p}`);
  return full;
};
const TOOLS = [
  { type: 'function', function: { name: 'list_files', description: 'List files in the project directory.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_file', description: 'Read a file.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or overwrite a file with the full content.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'done', description: 'Call when the task is complete.', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } } },
];
function run(name, a) {
  if (name === 'list_files') return JSON.stringify(fs.readdirSync(DIR));
  if (name === 'read_file') return fs.readFileSync(safe(a.path), 'utf8').slice(0, 20000);
  if (name === 'write_file') { fs.mkdirSync(path.dirname(safe(a.path)), { recursive: true }); fs.writeFileSync(safe(a.path), a.content); return `wrote ${a.path} (${a.content.length} chars)`; }
  return 'unknown tool';
}

const messages = [
  { role: 'system', content: 'You are a coding agent working in an empty project directory. Use the tools to create files. Write complete files in one write_file call each. Do not describe what you would do: do it with tools. When the task is complete, call done with a one-line summary.' },
  { role: 'user', content: TASK },
];

(async () => {
  const t0 = Date.now();
  let totalPrompt = 0; let totalCompletion = 0;
  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const ts = Date.now();
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: MAX_TOKENS, temperature: 0.2 }),
      signal: AbortSignal.timeout(1800000),
    });
    if (!res.ok) { console.error(`turn ${turn}: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
    const body = await res.json();
    const msg = body.choices[0].message;
    const u = body.usage || {};
    totalPrompt += u.prompt_tokens || 0; totalCompletion += u.completion_tokens || 0;
    const secs = ((Date.now() - ts) / 1000).toFixed(0);
    console.log(`\n--- turn ${turn}: ${secs}s, prompt ${u.prompt_tokens} tok, completion ${u.completion_tokens} tok, finish=${body.choices[0].finish_reason}`);
    messages.push(msg);
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      console.log(`model said: ${(msg.content || '').slice(0, 400)}`);
      messages.push({ role: 'user', content: 'Use the tools. Create the files with write_file, then call done.' });
      continue;
    }
    let finished = false;
    for (const c of calls) {
      let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch { a = {}; }
      if (c.function.name === 'done') { console.log(`done: ${a.summary}`); finished = true; messages.push({ role: 'tool', tool_call_id: c.id, content: 'ok' }); continue; }
      let out; try { out = run(c.function.name, a); } catch (err) { out = `error: ${err.message}`; }
      console.log(`tool ${c.function.name}(${JSON.stringify(a).slice(0, 80)}) -> ${out.slice(0, 80)}`);
      messages.push({ role: 'tool', tool_call_id: c.id, content: out });
    }
    if (finished) break;
  }
  console.log(`\n=== ${MODEL}: ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min, ${totalPrompt} prompt + ${totalCompletion} completion tokens; files: ${fs.readdirSync(DIR).join(', ') || '(none)'}`);
})().catch(err => { console.error(err.message); process.exit(1); });
