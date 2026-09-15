#!/usr/bin/env node
/**
 * Can a CPU model drive "deploy with AI" on Flux Cloud?
 *
 * Gives a model the real tool schemas of the Flux Cloud MCP server
 * (mcp.runonflux.com) and the requests a user would type into the chat row,
 * then scores what it does: which tool it calls first, whether the arguments
 * are right, whether it quotes before deploying, and how long each turn
 * takes. Tools are MOCKED - nothing is deployed and no key is used; the mock
 * returns realistic results so the model can carry on to the next step.
 *
 *   FLUX_LLM_KEY=... node tools/deploy-agent-eval.js --base http://localhost:8799/v1 \
 *       --model granite4:tiny-h [--tools full|core] [--case 1,2,3]
 *
 * --tools core keeps the five tools the chat row needs (pricing, build,
 * quote, deploy, wait; ~3.7k tokens); full sends all fifteen (~6.7k).
 */
const fs = require('node:fs');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const BASE = opt('base', 'https://llm.runonflux.com/v1').replace(/\/$/, '');
const MODEL = opt('model', 'granite4:tiny-h');
const TOOLSET = opt('tools', 'core');
const CASES = (opt('case', '1,2,3,4')).split(',').map(Number);
const TOOLS_FILE = opt('tools-file', '/tmp/mcp-tools.json');
// The hosted MCP takes the two private keys as tool arguments. Inside Flux
// Cloud the app holds the keys and injects them server-side, so the model
// must never see key parameters: with them in the schema the careful models
// refuse to quote until the user pastes a key and the careless ones invent
// one ("your-wif-key"). --keyed keeps them, to reproduce that.
const KEYED = args.includes('--keyed');
const KEY_PARAMS = ['fluxIdPrivateKey', 'paymentPrivateKey'];
function stripKeys(schema) {
  if (KEYED || !schema || !schema.properties) return schema;
  const properties = Object.fromEntries(Object.entries(schema.properties).filter(([k]) => !KEY_PARAMS.includes(k)));
  const required = (schema.required || []).filter(k => !KEY_PARAMS.includes(k));
  return { ...schema, properties, required };
}
const KEY = process.env.FLUX_LLM_KEY;
if (!KEY) { console.error('FLUX_LLM_KEY required'); process.exit(1); }

const all = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
const CORE = ['flux_get_pricing', 'flux_build_spec', 'flux_quote_app', 'flux_deploy_app', 'flux_wait_for_app'];
const tools = (TOOLSET === 'full' ? all : all.filter(t => CORE.includes(t.name)))
  .map(t => ({ type: 'function', function: { name: t.name, description: KEYED ? t.description : t.description.replace(/\b(Requires|Needs) (the )?(Flux ID|fluxIdPrivateKey|payment)[^.]*\./gi, '').trim(), parameters: stripKeys(t.inputSchema) } }));

const SYSTEM = 'You are Flux AI inside Flux Cloud. Help the user run apps on the Flux decentralized cloud using the tools. '
  + 'Prices are USD per month. Always get a quote with flux_quote_app and show it before deploying; deploy only after the user agrees, with confirm=true. '
  + 'Be brief. Use tools rather than guessing numbers.'
  + (KEYED ? '' : ' The user is signed in; their Flux ID and payment are handled by the app, so never ask for keys or addresses.');

// What the mocked tools answer. Enough for the model to take the next step.
const SPEC = { version: 8, name: 'nginxdemo', description: 'nginx', owner: 'FLUXID', compose: [{ name: 'web', repotag: 'nginx:latest', ports: [80], containerPorts: [80], domains: [''], environmentParameters: [], commands: [], containerData: '/data', cpu: 1, ram: 1000, hdd: 10 }], instances: 3, expire: 88000 };
function mock(name, a) {
  if (name === 'flux_get_pricing') return { usdPerMonth: { cpuCore: 0.9, ramGB: 0.75, hddGB: 0.12, minimum: 0.99 }, fluxUsd: 0.21, payInFluxDiscount: 0.1 };
  if (name === 'flux_build_spec') {
    // Models shape the component many ways (flat, nested resources, "4Gi",
    // MB vs GB). Read what they meant so the quote reflects their numbers.
    const c = a.components?.[0] || a;
    const r = c.resources || c;
    const num = (v) => { if (v == null) return undefined; const m = String(v).match(/[\d.]+/); return m ? Number(m[0]) : undefined; };
    let ram = num(r.ram ?? r.memory ?? a.ram); if (ram !== undefined && ram <= 64) ram *= 1000; // GB given
    let hdd = num(r.hdd ?? r.disk ?? r.storage ?? a.hdd); if (hdd !== undefined && hdd >= 1000) hdd = Math.round(hdd / 1024); // MB given
    return { spec: { ...SPEC, name: a.name || SPEC.name, instances: Number(a.instances) || SPEC.instances, compose: [{ ...SPEC.compose[0], repotag: c.image || c.repotag || SPEC.compose[0].repotag, cpu: num(r.cpu ?? a.cpu) ?? 1, ram: ram ?? 1000, hdd: hdd ?? 10 }] } };
  }
  if (name === 'flux_quote_app') { const sp = a.spec || a; const c = (typeof sp.compose === 'string' ? JSON.parse(sp.compose) : sp.compose)?.[0] || SPEC.compose[0]; const inst = Number(sp.instances) || SPEC.instances; const usd = Math.max(0.99, (c.cpu * 0.9 + (c.ram / 1000) * 0.75 + c.hdd * 0.12) * inst); return { usdPerMonth: Number(usd.toFixed(2)), flux: Number((usd / 0.21 * 0.9).toFixed(2)), instances: inst, period: '1 month' }; }
  if (name === 'flux_deploy_app') return a.confirm ? { status: 'broadcast', txid: 'MOCKTX', name: a.spec?.name || SPEC.name } : { status: 'dry-run', quote: mock('flux_quote_app', a) };
  if (name === 'flux_wait_for_app') return { running: true, instances: [{ ip: '1.2.3.4' }], url: `https://${a.name || SPEC.name}.app.runonflux.io` };
  if (name === 'flux_get_network_info') return { nodes: { cumulus: 4200, nimbus: 1500, stratus: 677 }, height: 2951900, fluxUsd: 0.21 };
  if (name === 'flux_get_identity') return { fluxId: 'FLUXID', paymentAddress: 'tADDR', balanceFlux: 120 };
  if (name === 'flux_list_my_apps') return { apps: [{ name: 'nginxdemo', expiresInDays: 27, instances: 3 }] };
  if (name === 'flux_get_app') return { name: a.name, spec: SPEC, running: 3 };
  if (name === 'flux_get_app_logs') return { lines: ['nginx: [notice] start worker', '127.0.0.1 - GET / 200'] };
  return { ok: true, note: `mock ${name}` };
}

const CASE_LIST = [
  { id: 1, user: 'Estimate the cost of 3 instances, 2 vCPU, 4 GB RAM, 20 GB disk for nginx.', want: { firstTool: ['flux_get_pricing', 'flux_build_spec', 'flux_quote_app'], mustCall: ['flux_quote_app'], mustNot: ['flux_deploy_app'] } },
  { id: 2, user: 'Deploy nginx:latest on port 80, 1 core, 1 GB RAM, 10 GB disk, 3 instances for a month. My app name is nginxdemo.', want: { firstTool: ['flux_build_spec', 'flux_quote_app', 'flux_get_pricing'], mustCall: ['flux_quote_app'], mustNot: ['flux_deploy_app:confirm'] } },
  { id: 3, user: 'Yes, go ahead and deploy it.', pre: 2, want: { mustCall: ['flux_deploy_app:confirm'] } },
  { id: 4, user: 'A Minecraft server for 20 players in Europe, how much would that be per month?', want: { mustCall: ['flux_quote_app'], mustNot: ['flux_deploy_app'] } },
];

async function chat(messages) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: 'auto', max_tokens: 800, temperature: 0.1 }),
    signal: AbortSignal.timeout(1800000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  const j = JSON.parse(text.trim());
  return { msg: j.choices[0].message, usage: j.usage || {}, ms: Date.now() - t0 };
}

async function runCase(c, history) {
  const messages = history || [{ role: 'system', content: SYSTEM }];
  messages.push({ role: 'user', content: c.user });
  const called = [];
  let turns = 0; let ms = 0; let prompt = 0; let text = '';
  for (; turns < 6; turns += 1) {
    const r = await chat(messages);
    ms += r.ms; prompt += r.usage.prompt_tokens || 0;
    messages.push(r.msg);
    const calls = r.msg.tool_calls || [];
    if (!calls.length) { text = r.msg.content || ''; break; }
    for (const tc of calls) {
      let a = {}; try { a = JSON.parse(tc.function.arguments || '{}'); } catch { /* bad json */ }
      const tag = tc.function.name + (tc.function.name === 'flux_deploy_app' && a.confirm ? ':confirm' : '');
      called.push({ tag, args: a });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(mock(tc.function.name, a)) });
    }
  }
  const tags = called.map(x => x.tag);
  const w = c.want || {};
  const okFirst = !w.firstTool || (tags.length && w.firstTool.includes(tags[0].split(':')[0]));
  const okMust = (w.mustCall || []).every(t => tags.includes(t));
  const okNot = !(w.mustNot || []).some(t => tags.includes(t));
  const pass = okFirst && okMust && okNot;
  console.log(`\ncase ${c.id} ${pass ? 'PASS' : 'FAIL'}  ${(ms / 1000).toFixed(0)}s, ${turns + 1} model turns, ${prompt} prompt tok`);
  console.log(`  tools: ${tags.join(' -> ') || '(none)'}`);
  for (const x of called) if (['flux_build_spec', 'flux_quote_app', 'flux_deploy_app'].includes(x.tag.split(':')[0])) console.log(`  ${x.tag} args: ${JSON.stringify(x.args).slice(0, 220)}`);
  console.log(`  said: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
  return { pass, messages };
}

(async () => {
  console.log(`=== ${MODEL} via ${BASE}, ${tools.length} tools${KEYED ? ' (keyed)' : ' (keyless)'} (~${Math.round(JSON.stringify(tools).length / 4)} tok of schema)`);
  const results = {}; const hist = {};
  for (const c of CASE_LIST.filter(x => CASES.includes(x.id))) {
    try {
      const r = await runCase(c, c.pre ? hist[c.pre] : null);
      results[c.id] = r.pass; hist[c.id] = r.messages;
    } catch (err) { console.log(`\ncase ${c.id} ERROR ${err.message.slice(0, 200)}`); results[c.id] = false; }
  }
  const n = Object.values(results).filter(Boolean).length;
  console.log(`\n=== ${MODEL}: ${n}/${Object.keys(results).length} cases passed`);
})();
