#!/usr/bin/env node
/**
 * Marketplace knowledge, two ways.
 *
 * 1. A facts sheet for the corpus (marketplace-facts.md): one section per
 *    visible marketplace app - category, price, image, ports, resources,
 *    instances, the parameters a user fills in - so the docs bot retrieves
 *    real presets and the teacher can write Q&A about them.
 * 2. Deploy-agent dialogues (marketplace-deploy.jsonl) in which the user asks
 *    for a marketplace app by name and the assistant uses the REAL preset:
 *    image, ports, env, sizes, and asks for the user parameters the preset
 *    declares before building the spec. Same correct-by-construction method
 *    as gen-deploy.js; tool calls come from the preset, not from a model.
 *
 *   node finetune/gen-marketplace.js [--src finetune/data/sources/marketplace.json] [--n 600]
 */
const fs = require('node:fs');
const path = require('node:path');
const TOOLS = require('./tools-compact');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const SRC = opt('src', path.join(__dirname, 'data', 'sources', 'marketplace.json'));
const N = Number(opt('n', 600));
const D = path.join(__dirname, 'data');
let seed = Number(opt('seed', 5));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;

const apps = JSON.parse(fs.readFileSync(SRC, 'utf8')).data.filter((a) => a.visible !== false && a.enabled !== false);
const SYSTEM = 'You are Flux AI, the assistant inside Flux Cloud. You help people run apps on the Flux decentralized cloud with the tools. '
  + 'Prices are USD per month. Get a quote with flux_quote_app and show it before any deployment; call flux_deploy_app with confirm=true only after the user has agreed to that quote. '
  + 'The user is signed in: never ask for keys, wallets or addresses. Be brief.';

// --- 1. facts sheet ----------------------------------------------------------
const money = (n) => `$${Number(n).toFixed(2)}`;
let md = '# Flux Marketplace apps (curated one-click presets in Flux Cloud > Marketplace)\n\n'
  + 'Each marketplace app is a ready-made specification: pick it, fill in its parameters if it has any, and pay. Prices are USD per month for the preset size and instance count; the same app can also be deployed manually with different resources.\n';
for (const a of apps) {
  const comps = a.compose || [];
  const total = comps.reduce((t, c) => ({ cpu: t.cpu + (c.cpu || 0), ram: t.ram + (c.ram || 0), hdd: t.hdd + (c.hdd || 0) }), { cpu: 0, ram: 0, hdd: 0 });
  md += `\n## ${a.name} <https://cloud.runonflux.com/marketplace>\n`;
  md += `${a.name} is a ${a.category || 'marketplace'} app on the Flux marketplace: ${(a.description || '').trim()}${/[.!?]$/.test((a.description || '').trim()) ? '' : '.'} `;
  md += `Preset price ${money(a.priceUSD)} per month for ${a.instances || 3} ${a.instances === 1 ? 'instance' : 'instances'}${(a.lockedValues || []).includes('instances') ? ' (instance count is fixed for this app)' : ''}. `;
  md += `Total resources ${total.cpu} cores, ${total.ram} MB RAM, ${total.hdd} GB storage across ${comps.length} ${comps.length === 1 ? 'component' : 'components'}.`;
  for (const c of comps) {
    md += `\n- Component ${c.name}: image ${c.repotag}; ${c.cpu} cores, ${c.ram} MB RAM, ${c.hdd} GB; ports ${(c.ports || []).join(', ') || 'none'} (container ${(c.containerPorts || []).join(', ') || 'none'}); data path ${c.containerData || '/data'}.`;
    const params = c.userEnvironmentParameters || [];
    if (params.length) md += ` Parameters the user fills in: ${params.map((p) => `${p.name} (${p.description || 'no description'})`).join('; ')}.`;
  }
  md += '\n';
}
fs.writeFileSync(path.join(D, 'marketplace-facts.md'), md);

// --- 2. deploy dialogues from real presets ---------------------------------------
let callN = 0;
const tc = (name, a) => ({ id: `call_${(callN += 1).toString(36)}`, type: 'function', function: { name, arguments: JSON.stringify(a) } });
const toolMsg = (id, obj) => ({ role: 'tool', tool_call_id: id, content: JSON.stringify(obj) });
const PRICING = { cpuCore: 0.9, ramGB: 0.75, hddGB: 0.12, minimum: 0.99, fluxUsd: 0.21, discount: 0.1 };
function quoteFor(spec) {
  const months = spec.expire / 88000;
  const perInst = spec.compose.reduce((t, c) => t + c.cpu * PRICING.cpuCore + (c.ram / 1000) * PRICING.ramGB + c.hdd * PRICING.hddGB, 0);
  const usd = Math.max(PRICING.minimum, perInst * spec.instances) * months;
  return { usdPerMonth: Number((usd / months).toFixed(2)), usdTotal: Number(usd.toFixed(2)), months, instances: spec.instances, flux: Number((usd / PRICING.fluxUsd * (1 - PRICING.discount)).toFixed(2)) };
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
function dialogue(a) {
  callN = 0;
  const comps = a.compose || [];
  const params = comps.flatMap((c) => (c.userEnvironmentParameters || []).map((p) => ({ ...p, comp: c.name })));
  const name = `${slug(a.name)}${Math.floor(rnd() * 90 + 10)}`;
  const m = [{ role: 'system', content: SYSTEM }];
  const ask = pick([`Deploy ${a.name} from the marketplace.`, `I want the ${a.name} app.`, `Set up ${a.name} for me`, `Can I run ${a.name} on Flux?`, `${a.name} please, marketplace preset.`, `How much is ${a.name} and can you deploy it?`]);
  m.push({ role: 'user', content: ask });
  const values = {};
  if (params.length) {
    m.push({ role: 'assistant', content: `${a.name} is a marketplace preset (${a.category}, ${money(a.priceUSD)}/month for ${a.instances || 3} instances). It needs ${params.length === 1 ? 'one value' : `${params.length} values`} from you: ${params.map((p) => `**${p.name}**${p.description ? ` - ${p.description}` : ''}`).join('; ')}. What should I use?` });
    for (const p of params) values[p.name] = p.placeholder && !/^(enter|your|the) /i.test(p.placeholder) ? p.placeholder : `${p.name.toLowerCase().replace(/_/g, '-')}-value`;
    m.push({ role: 'user', content: params.map((p) => `${p.name}: ${values[p.name]}`).join(', ') });
  }
  const build = {
    name, description: `${a.name} (marketplace)`, instances: a.instances || 3,
    components: comps.map((c) => ({ name: c.name, image: c.repotag, ports: c.containerPorts || [], env: [...(c.environmentParameters || []), ...(c.userEnvironmentParameters || []).map((p) => `${p.name}=${values[p.name]}`)], cpu: c.cpu, ram: c.ram, hdd: c.hdd })),
  };
  const c1 = tc('flux_build_spec', build); m.push({ role: 'assistant', content: '', tool_calls: [c1] });
  const spec = { version: 8, name, description: build.description, compose: build.components.map((c, i) => ({ name: c.name, repotag: c.image, ports: comps[i].ports || [], containerPorts: c.ports, domains: (c.ports || []).map(() => ''), environmentParameters: c.env, commands: comps[i].commands || [], containerData: comps[i].containerData || '/data', cpu: c.cpu, ram: c.ram, hdd: c.hdd })), instances: build.instances, expire: 88000 };
  m.push(toolMsg(c1.id, { spec }));
  const c2 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
  const q = quoteFor(spec); m.push(toolMsg(c2.id, q));
  const total = build.components.reduce((t, c) => ({ cpu: t.cpu + c.cpu, ram: t.ram + c.ram, hdd: t.hdd + c.hdd }), { cpu: 0, ram: 0, hdd: 0 });
  m.push({ role: 'assistant', content: `**${a.name}** as **${name}**: ${build.components.length > 1 ? `${build.components.length} components, ` : ''}${total.cpu} cores, ${total.ram >= 1000 ? `${total.ram / 1000} GB` : `${total.ram} MB`} RAM, ${total.hdd} GB storage, ${spec.instances} instances — **${money(q.usdTotal)}** per month (≈ ${q.flux} FLUX). ${pick(['Shall I deploy it?', 'Deploy it now?', 'Want me to go ahead?'])}` });
  if (chance(0.75)) {
    m.push({ role: 'user', content: pick(['Yes', 'yes go ahead', 'Deploy it.', 'ok', 'Sure', 'Do it']) });
    const c3 = tc('flux_deploy_app', { spec, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c3] });
    m.push(toolMsg(c3.id, { status: 'broadcast', txid: Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join(''), name, paidFlux: q.flux }));
    const c4 = tc('flux_wait_for_app', { name }); m.push({ role: 'assistant', content: '', tool_calls: [c4] });
    m.push(toolMsg(c4.id, { running: true, instances: spec.instances, url: `https://${name}.app.runonflux.io` }));
    const port = spec.compose[0].ports[0];
    m.push({ role: 'assistant', content: `Deployed. **${name}** (${a.name}) is running on ${spec.instances} nodes: https://${name}.app.runonflux.io${port && port !== 80 ? ` (port ${port}: https://${name}_${port}.app.runonflux.io)` : ''}. Paid ${q.flux} FLUX for a month.` });
  } else {
    m.push({ role: 'user', content: pick(['Not now.', 'No thanks', 'Let me think about it.']) });
    m.push({ role: 'assistant', content: 'OK, nothing deployed. Ask me any time.' });
  }
  return m;
}
const out = fs.createWriteStream(path.join(D, 'marketplace-deploy.jsonl'));
let n = 0;
while (n < N) { const a = pick(apps); if (!(a.compose || []).length) continue; out.write(`${JSON.stringify({ messages: dialogue(a), tools: TOOLS })}\n`); n += 1; }
out.end();
console.log(`${apps.length} marketplace apps -> ${path.join(D, 'marketplace-facts.md')} (${md.length} chars) and ${n} deploy dialogues in marketplace-deploy.jsonl`);
