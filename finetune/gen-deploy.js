#!/usr/bin/env node
/**
 * Deploy-agent training dialogues, v2. Correct by construction, varied by design.
 *
 * Every tool call is produced by code from a sampled scenario, so arguments
 * and order are right by definition. What v2 adds over v1 (gen-deploy-v1.js),
 * each answering a measured failure of the first model:
 *
 *   - surfaces: each dialogue samples a system prompt and a tool schema
 *     (compact, MCP-derived core, full, shuffled, reworded) from surfaces.js
 *     and emits arguments in THAT schema's shape - v1 stopped calling tools
 *     when either changed;
 *   - sizing from a description ("Minecraft for 20 players", "small postgres
 *     for testing", "production WordPress") using the live catalog medians -
 *     v1 returned nothing for the vague case;
 *   - randomised pricing per dialogue and assistant lines that restate the
 *     tool's figures exactly - v1 once said $1.15 for an $8.55 quote;
 *   - error flows (name taken, name starts with flux, ram not a multiple of
 *     100, insufficient balance, image not found) and how to recover;
 *   - confirmation hardening: "yes" before any quote quotes first; a spec
 *     changed after the quote is re-quoted; unclear replies get a question;
 *   - multi-turn follow-ups after a deploy: status, logs, restart, cancel.
 *
 * The teacher only paraphrases user lines (numbers and names must survive).
 *
 *   TEACHER_BASE=http://localhost:8799/v1 TEACHER_MODEL=gpt-oss:20b TEACHER_KEY=... \
 *   node finetune/gen-deploy.js --n 4000 --concurrency 12 --out finetune/data/deploy-v2.jsonl [--no-teacher]
 */
const fs = require('node:fs');
const path = require('node:path');
const surfaces = require('./surfaces');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const N = Number(opt('n', 500));
const OUT = opt('out', path.join(__dirname, 'data', 'deploy-v2.jsonl'));
const CONC = Number(opt('concurrency', 8));
const NO_TEACHER = args.includes('--no-teacher');
let seed = Number(opt('seed', 42));
const TEACHER = { base: (process.env.TEACHER_BASE || 'http://localhost:8799/v1').replace(/\/$/, ''), model: process.env.TEACHER_MODEL || 'gpt-oss:20b', key: process.env.TEACHER_KEY || '' };
const SIZING = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sizing.json'), 'utf8')); } catch { return {}; } })();

const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const roundRam = (mb) => Math.max(100, Math.round(mb / 100) * 100);
const roundCpu = (c) => Math.max(0.1, Math.round(c * 10) / 10);
const money = (n) => `$${Number(n).toFixed(2)}`;

// --- apps and how to size them from a description --------------------------------
const cat = (img, dflt) => { const s = SIZING[img]; return s ? { cpu: s.cpu, ram: s.ram, hdd: s.hdd } : dflt; };
const PRESETS = [
  { key: 'nginx', names: ['nginx', 'a web server', 'an nginx web server', 'a static site with nginx', 'a landing page'], image: 'nginx:latest', ports: [80], size: { cpu: 0.5, ram: 500, hdd: 5 }, appname: ['mysite', 'webdemo', 'landing', 'nginxdemo', 'staticweb'] },
  { key: 'wordpress', names: ['WordPress', 'a WordPress site', 'a blog on WordPress', 'a WordPress shop with WooCommerce'], image: 'wordpress:latest', ports: [80], size: cat('runonflux/wp-nginx', { cpu: 1, ram: 1000, hdd: 20 }), appname: ['myblog', 'wpsite', 'companyblog', 'wordpressdemo'] },
  { key: 'minecraft', names: ['a Minecraft server', 'a Minecraft server for {players} players', 'Minecraft for my friends ({players} people)', 'a modded Minecraft server for {players}'], image: 'itzg/minecraft-server:latest', ports: [25565], env: ['EULA=TRUE'], size: cat('itzg/minecraft-server', { cpu: 2, ram: 8000, hdd: 50 }), appname: ['mcserver', 'craftworld', 'blockparty', 'ourminecraft'], players: true },
  { key: 'palworld', names: ['a Palworld server', 'a Palworld server for {players} players', 'Palworld for our group of {players}'], image: 'thijsvanloef/palworld-server-docker:latest', ports: [8211, 27015], size: cat('thijsvanloef/palworld-server-docker', { cpu: 4, ram: 12000, hdd: 35 }), appname: ['palserver', 'palsworld', 'palcamp'], players: true },
  { key: 'postgres', names: ['a PostgreSQL database', 'Postgres', 'a postgres 16 database', 'a Postgres for my app'], image: 'postgres:16', ports: [5432], env: ['POSTGRES_PASSWORD=changeme'], size: { cpu: 1, ram: 2000, hdd: 40 }, appname: ['pgmain', 'appdb', 'postgresdemo'] },
  { key: 'mysql', names: ['MySQL', 'a MySQL database', 'MariaDB'], image: 'mysql:8', ports: [3306], env: ['MYSQL_ROOT_PASSWORD=changeme'], size: cat('mysql', { cpu: 0.7, ram: 1000, hdd: 3 }), appname: ['mysqldb', 'shopdb', 'maindb'] },
  { key: 'redis', names: ['Redis', 'a Redis cache'], image: 'redis:7', ports: [6379], size: { cpu: 0.5, ram: 1000, hdd: 5 }, appname: ['cache', 'redisdemo', 'sessioncache'] },
  { key: 'uptime', names: ['Uptime Kuma', 'an uptime monitor (Uptime Kuma)', 'a status page'], image: 'louislam/uptime-kuma:1', ports: [3001], size: { cpu: 0.5, ram: 500, hdd: 5 }, appname: ['uptime', 'statuspage', 'monitor1'] },
  { key: 'nextcloud', names: ['Nextcloud', 'a Nextcloud instance', 'my own cloud storage with Nextcloud'], image: 'nextcloud:latest', ports: [80], size: { cpu: 2, ram: 4000, hdd: 100 }, appname: ['mycloud', 'nextclouddemo', 'familycloud'] },
  { key: 'n8n', names: ['n8n', 'an n8n automation server', 'n8n for my workflows'], image: 'n8nio/n8n:latest', ports: [5678], size: { cpu: 1, ram: 1000, hdd: 10 }, appname: ['automations', 'n8ndemo', 'flows'] },
  { key: 'ghost', names: ['Ghost', 'a Ghost blog'], image: 'ghost:5', ports: [2368], size: { cpu: 1, ram: 1000, hdd: 10 }, appname: ['ghostblog', 'newsletter', 'myghost'] },
  { key: 'teamspeak', names: ['a TeamSpeak server', 'TeamSpeak'], image: 'teamspeak:latest', ports: [9987, 10011, 30033], env: ['TS3SERVER_LICENSE=accept'], size: { cpu: 0.5, ram: 500, hdd: 5 }, appname: ['voice', 'tsserver', 'teamspeakdemo'] },
  { key: 'presearch', names: ['a Presearch node', 'Presearch'], image: 'presearch/node:latest', ports: [], size: cat('presearch/node', { cpu: 0.3, ram: 300, hdd: 2 }), appname: ['presearch1', 'searchnode'] },
  { key: 'custom', names: ['my app ({image})', 'the image {image}', 'my Docker image {image}', 'a container from {image}', '{image}'], image: null, ports: [8080], size: { cpu: 1, ram: 1000, hdd: 10 }, appname: ['myapp', 'backend1', 'apiserver', 'demoapp', 'service2'] },
];
const CUSTOM_IMAGES = ['ghcr.io/acme/api:1.4.2', 'docker.io/janedoe/shop:latest', 'myorg/backend:2.0', 'registry.example.com/team/app:prod', 'node:22-alpine', 'python:3.12-slim', 'ghcr.io/example/bot:v3'];
const REGIONS = [['Europe', 'acEU'], ['the EU', 'acEU'], ['North America', 'acNA'], ['the US', 'acNA'], ['Asia', 'acAS'], ['Australia', 'acOC'], ['South America', 'acSA']];

function playersSize(players, base) {
  const f = players <= 5 ? 0.5 : players <= 12 ? 0.75 : players <= 25 ? 1 : players <= 50 ? 1.6 : 2.5;
  return { cpu: roundCpu(Math.max(1, base.cpu * f)), ram: roundRam(Math.max(2000, base.ram * f)), hdd: Math.max(10, Math.round(base.hdd * Math.min(f, 1.5))) };
}
const TIERS = { tiny: 0.4, small: 0.5, 'for testing': 0.5, 'just to try': 0.4, medium: 1, standard: 1, large: 2, production: 1.5, 'high traffic': 2.5, 'a few thousand visitors a day': 1.5, 'for my whole company': 2 };
function tierSize(word, base) { const f = TIERS[word] || 1; return { cpu: roundCpu(Math.max(0.2, base.cpu * f)), ram: roundRam(Math.max(200, base.ram * f)), hdd: Math.max(2, Math.round(base.hdd * Math.max(f, 0.5))) }; }

// --- scenario ---------------------------------------------------------------
function scenario() {
  const preset = pick(PRESETS);
  const s = { preset, image: preset.image || pick(CUSTOM_IMAGES), ports: preset.ports, env: preset.env || [] };
  s.name = pick(preset.appname) + (chance(0.4) ? String(ri(1, 99)) : '');
  s.surface = surfaces.sample(rnd);
  s.pricing = { cpuCore: +(0.6 + rnd() * 0.6).toFixed(2), ramGB: +(0.4 + rnd() * 0.6).toFixed(2), hddGB: +(0.08 + rnd() * 0.12).toFixed(3), minimum: 0.99, fluxUsd: +(0.1 + rnd() * 0.5).toFixed(3), discount: 0.1 };
  let mode = pick(['explicit', 'explicit', 'default', 'players', 'tier', 'tier']);
  if (mode === 'players' && !preset.players) mode = 'default';
  s.mode = mode;
  if (mode === 'explicit') {
    s.cpu = pick([0.5, 1, 1, 2, 2, 3, 4, 6]); s.ramGB = pick([0.5, 1, 1, 2, 2, 4, 4, 8, 16]); s.hdd = pick([5, 10, 10, 20, 20, 50, 100]);
    s.unitTrap = chance(0.3); s.ram = roundRam(s.ramGB * 1000);
  } else if (mode === 'players') { s.players = pick([4, 8, 10, 12, 15, 20, 25, 30, 50, 80]); Object.assign(s, playersSize(s.players, preset.size)); }
  else if (mode === 'tier') { s.tier = pick(Object.keys(TIERS)); Object.assign(s, tierSize(s.tier, preset.size)); }
  else Object.assign(s, preset.size);
  s.instances = chance(0.5) ? pick([1, 1, 2, 3, 3, 5]) : 3;
  s.instancesStated = s.instances !== 3 || chance(0.3);
  s.months = chance(0.2) ? pick([0.25, 0.5, 2, 3, 6, 12]) : 1;
  s.region = chance(0.3) ? pick(REGIONS) : null;
  s.flow = pick(['estimate', 'estimate', 'deploy', 'deploy', 'deploy', 'deploy-followup', 'deploy-change', 'stale-quote', 'yes-first', 'vague', 'skipquote', 'error', 'error', 'manage', 'offtopic', 'decline', 'unclear']);
  return s;
}

const term = (m) => m === 1 ? 'a month' : m === 0.25 ? 'a week' : m === 0.5 ? 'two weeks' : m === 12 ? 'a year' : `${m} months`;
const appWords = (s) => pick(s.preset.names).replace('{players}', s.players || 10).replace('{image}', s.image);
function resWords(s) {
  if (s.mode !== 'explicit') return '';
  const ram = s.unitTrap && s.ramGB < 1 ? `${s.ramGB * 1024} MB RAM` : s.unitTrap ? `${s.ramGB}G of memory` : `${s.ramGB} GB RAM`;
  const cpu = s.unitTrap ? `${s.cpu} vCPU` : `${s.cpu} ${s.cpu === 1 ? 'core' : 'cores'}`;
  const hdd = s.unitTrap ? `${s.hdd}GB SSD` : `${s.hdd} GB disk`;
  return `${cpu}, ${ram}, ${hdd}`;
}
function userOpening(s, verb) {
  const what = appWords(s);
  const lead = verb ? `${verb} ${what}` : s.flow === 'estimate' ? pick([`How much would ${what} cost`, `Estimate the cost of ${what}`, `What does it cost to run ${what}`, `Price for ${what}`, `Give me a quote for ${what}`, `how much for ${what}`])
    : s.flow === 'skipquote' ? pick([`Deploy ${what} right now, skip the quote`, `Just deploy ${what}, I don't need the price`, `Launch ${what} immediately`])
    : pick([`Deploy ${what}`, `I want to run ${what}`, `Set up ${what}`, `Can you launch ${what}`, `Spin up ${what}`, `Run ${what} for me`, `deploy ${what} pls`]);
  const bits = [lead];
  const extras = [resWords(s), s.mode === 'tier' ? s.tier : '', s.instancesStated ? `${s.instances} ${s.instances === 1 ? 'instance' : 'instances'}` : '', s.region ? `in ${s.region[0]}` : '', s.months !== 1 ? `for ${term(s.months)}` : ''].filter(Boolean);
  if (extras.length) bits.push(extras.join(', '));
  if (s.preset.key === 'custom' && chance(0.6)) bits.push(`port ${s.ports[0]}`);
  const end = s.flow === 'estimate' ? '?' : '.';
  const naming = chance(0.85) ? ` ${pick([`Call it ${s.name}.`, `App name ${s.name}.`, `Name it ${s.name}.`, `The app name is ${s.name}.`, `name: ${s.name}`])}` : '';
  return `${bits.join(', ')}${end}${naming}`;
}

// --- tool arguments in the surface's shape ---------------------------------------
const isMcp = (s) => s.surface.kind.startsWith('mcp');
function buildArgs(s, name = s.name) {
  const comp = { name: s.preset.key === 'custom' ? 'app' : s.preset.key, image: s.image, cpu: roundCpu(s.cpu), ram: roundRam(s.ram), hdd: s.hdd };
  if (isMcp(s)) { comp.ports = s.ports.map((p) => ({ containerPort: p })); if (s.env.length) comp.env = chance(0.5) ? s.env : Object.fromEntries(s.env.map((e) => e.split('='))); }
  else { comp.ports = s.ports; if (s.env.length) comp.env = s.env; }
  const a = { name, description: appWords(s).replace(/\bmy\b/g, '').trim(), components: [comp], instances: s.instances };
  if (s.months !== 1) a.months = s.months;
  if (s.region) a.geolocation = [s.region[1]];
  return a;
}
function specFrom(a) {
  const c = a.components[0];
  const ports = Array.isArray(c.ports) ? c.ports.map((p) => (typeof p === 'object' ? p.containerPort : p)) : [];
  const env = Array.isArray(c.env) ? c.env : c.env ? Object.entries(c.env).map(([k, v]) => `${k}=${v}`) : [];
  return { version: 8, name: a.name, description: a.description, compose: [{ name: c.name, repotag: c.image, ports: ports.map((p) => 31000 + (p % 9000)), containerPorts: ports, domains: ports.map(() => ''), environmentParameters: env, commands: [], containerData: '/data', cpu: c.cpu, ram: c.ram, hdd: c.hdd }], instances: a.instances || 3, expire: Math.round((a.months || 1) * 88000), ...(a.geolocation ? { geolocation: a.geolocation } : {}) };
}
function quoteFor(spec, P) {
  const months = spec.expire / 88000;
  const perInst = spec.compose.reduce((t, c) => t + c.cpu * P.cpuCore + (c.ram / 1000) * P.ramGB + c.hdd * P.hddGB, 0);
  const usd = Math.max(P.minimum, perInst * spec.instances) * months;
  return { usdPerMonth: +(usd / months).toFixed(2), usdTotal: +usd.toFixed(2), months, instances: spec.instances, flux: +(usd / P.fluxUsd * (1 - P.discount)).toFixed(2), fluxUsd: P.fluxUsd };
}
let callN = 0;
const tc = (name, a) => ({ id: `call_${(callN += 1).toString(36)}${Math.floor(rnd() * 1e4).toString(36)}`, type: 'function', function: { name, arguments: JSON.stringify(a) } });
const toolMsg = (id, obj) => ({ role: 'tool', tool_call_id: id, content: JSON.stringify(obj) });

// --- assistant prose ------------------------------------------------------------------
function sizeWords(spec) { const c = spec.compose[0]; return `${c.cpu} ${c.cpu === 1 ? 'core' : 'cores'}, ${c.ram >= 1000 ? `${+(c.ram / 1000).toFixed(1)} GB` : `${c.ram} MB`} RAM, ${c.hdd} GB disk`; }
function quoteLine(s, q, spec) {
  const inst = `${spec.instances} ${spec.instances === 1 ? 'instance' : 'instances'}`;
  const t = q.months === 1 ? 'per month' : `for ${term(q.months)} (${money(q.usdPerMonth)} per month)`;
  const head = pick([
    `**${spec.name}**: ${sizeWords(spec)}, ${inst}${s.region ? `, ${s.region[0]}` : ''} — **${money(q.usdTotal)}** ${t}, about ${q.flux} FLUX.`,
    `Quote for **${spec.name}** (${sizeWords(spec)}, ${inst}${s.region ? `, ${s.region[0]}` : ''}): **${money(q.usdTotal)}** ${t} (≈ ${q.flux} FLUX).`,
    `${inst} of ${sizeWords(spec)}${s.region ? ` in ${s.region[0]}` : ''} come to **${money(q.usdTotal)}** ${t}, roughly ${q.flux} FLUX.`,
    `That is **${money(q.usdTotal)}** ${t} (${q.flux} FLUX) for **${spec.name}**: ${sizeWords(spec)}, ${inst}.`]);
  const notes = [];
  if (s.mode === 'explicit' && s.unitTrap && s.ramGB < 1) notes.push(`RAM is rounded to ${spec.compose[0].ram} MB (multiples of 100).`);
  if (s.mode === 'players') notes.push(`Sized for ${s.players} players, in line with what other ${s.preset.key === 'palworld' ? 'Palworld' : 'Minecraft'} servers on Flux use; say if you want more headroom.`);
  else if (s.mode === 'tier') notes.push(`I sized it for "${s.tier}"; tell me if you want it bigger or smaller.`);
  else if (s.mode === 'default') notes.push(`Using the usual size for ${s.preset.names[0].replace(/^(a|an) /, '')}; say if you want more or less.`);
  return `${head}${notes.length ? ` ${pick(notes)}` : ''}`;
}
const askDeploy = () => pick(['Shall I deploy it?', 'Want me to go ahead and deploy?', 'Deploy it now?', 'Should I deploy this?', 'Say yes and I will deploy it.', 'Go ahead?']);
const YES = ['Yes, go ahead.', 'yes', 'Deploy it.', 'Sounds good, do it.', 'OK deploy', 'Yes please', 'go', 'Sure, launch it.', 'Confirmed.', 'Yep.', 'do it', 'ok', 'y'];
const NO = ['No, not now.', 'Hold on, no.', 'Cancel that.', 'no thanks', 'Not yet.', 'nah'];
const UNCLEAR = ['hmm', 'maybe', 'what do you think?', 'is that a lot?', 'interesting', '...'];

function quoteFlow(m, s, name = s.name, verbPrefix = '') {
  const a = buildArgs(s, name); const c1 = tc('flux_build_spec', a);
  m.push({ role: 'assistant', content: verbPrefix, tool_calls: [c1] });
  const spec = specFrom(a); m.push(toolMsg(c1.id, { spec }));
  const c2 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
  const q = quoteFor(spec, s.pricing); m.push(toolMsg(c2.id, q));
  m.push({ role: 'assistant', content: `${quoteLine(s, q, spec)} ${askDeploy()}` });
  return { spec, q };
}
function deployFlow(m, s, spec, q) {
  const c3 = tc('flux_deploy_app', { spec, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c3] });
  const txid = Array.from({ length: 64 }, () => '0123456789abcdef'[ri(0, 15)]).join('');
  m.push(toolMsg(c3.id, { status: 'broadcast', txid, name: spec.name, paidFlux: q.flux }));
  const c4 = tc('flux_wait_for_app', { name: spec.name }); m.push({ role: 'assistant', content: '', tool_calls: [c4] });
  const running = chance(0.85); const port = spec.compose[0].containerPorts[0];
  m.push(toolMsg(c4.id, running ? { running: true, instances: spec.instances, url: `https://${spec.name}.app.runonflux.io` } : { running: false, instances: 0, note: 'not yet scheduled, usually within a few minutes' }));
  m.push({ role: 'assistant', content: running
    ? pick([`Deployed. **${spec.name}** is running on ${spec.instances} ${spec.instances === 1 ? 'node' : 'nodes'}: https://${spec.name}.app.runonflux.io${port && port !== 80 ? ` (port ${port}: https://${spec.name}_${port}.app.runonflux.io)` : ''}. Paid ${q.flux} FLUX.`,
      `**${spec.name}** is live at https://${spec.name}.app.runonflux.io with ${spec.instances} ${spec.instances === 1 ? 'instance' : 'instances'}. ${q.flux} FLUX paid for ${term(q.months)}.`])
    : `Paid and registered (${q.flux} FLUX). **${spec.name}** is not scheduled yet; nodes usually pick it up within a few minutes. Ask me to check again or open Applications in Flux Cloud.` });
  return running;
}
function followup(m, s, spec) {
  const kind = pick(['status', 'logs', 'restart', 'cancel', 'thanks']);
  const name = spec.name;
  if (kind === 'thanks') { m.push({ role: 'user', content: pick(['Thanks!', 'great, thank you', 'perfect']) }); m.push({ role: 'assistant', content: pick(['You are welcome.', 'Any time. Ask me for logs or status whenever you need.', 'Glad to help.']) }); return; }
  if (kind === 'status') {
    m.push({ role: 'user', content: pick([`Is ${name} running now?`, 'is it up yet?', 'status?']) });
    const c = tc('flux_get_app', { name }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
    m.push(toolMsg(c.id, { name, running: spec.instances, instances: spec.instances, url: `https://${name}.app.runonflux.io` }));
    m.push({ role: 'assistant', content: `Yes: **${name}** is running on ${spec.instances} of ${spec.instances} nodes at https://${name}.app.runonflux.io.` });
  } else if (kind === 'logs') {
    m.push({ role: 'user', content: pick(['Show me its logs', `logs of ${name}`, 'anything in the logs?']) });
    const c = tc('flux_get_app_logs', { name, lines: 100 }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
    m.push(toolMsg(c.id, { lines: ['starting', `listening on port ${spec.compose[0].containerPorts[0]}`, 'ready'] }));
    m.push({ role: 'assistant', content: `Healthy: it started and is listening on port ${spec.compose[0].containerPorts[0]}.` });
  } else if (kind === 'restart') {
    m.push({ role: 'user', content: pick([`Restart ${name}`, 'restart it please', 'redeploy it with the latest image']) });
    const action = /redeploy|latest/i.test(m[m.length - 1].content) ? 'redeploy' : 'restart';
    const c = tc('flux_control_app', { name, action }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
    m.push(toolMsg(c.id, { ok: true, action, name }));
    m.push({ role: 'assistant', content: action === 'redeploy' ? `**${name}** is being redeployed with a fresh pull of the image; back within a minute or two.` : `**${name}** restarted.` });
  } else {
    m.push({ role: 'user', content: pick([`Actually cancel ${name}`, 'cancel it, I changed my mind', `remove ${name}`]) });
    m.push({ role: 'assistant', content: `Cancelling **${name}** ends it early and the remaining term is not refunded. Cancel it?` });
    m.push({ role: 'user', content: pick(YES) });
    const c = tc('flux_cancel_app', { name, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
    m.push(toolMsg(c.id, { ok: true, name, expiresInMinutes: 60 }));
    m.push({ role: 'assistant', content: `Done. **${name}** will stop within about an hour.` });
  }
}

// --- flows -------------------------------------------------------------------------
function build(s) {
  callN = 0;
  const m = [{ role: 'system', content: s.surface.system }];
  const F = s.flow;
  if (F === 'vague' && s.preset.key !== 'custom' && chance(0.5)) {
    // app known, size unknown, "how much would that be" - size it, do not ask
    s.mode = 'default'; Object.assign(s, s.preset.size);
    m.push({ role: 'user', content: pick([`${appWords(s)}, how much would that be per month?`, `what would ${appWords(s)} cost me?`, `I'd like ${appWords(s)} but I have no idea what size it needs. Price?`]) });
    const { spec, q } = quoteFlow(m, s, s.name);
    if (chance(0.5)) { m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s, spec, q); }
    return m;
  }
  if (F === 'vague') {
    const what = pick(['an app', 'something for my community', 'a game server', 'a database', 'a server', 'my project', 'something']);
    m.push({ role: 'user', content: pick([`I want to deploy ${what}.`, `Can you run ${what} on Flux?`, `Host ${what} for me`, `How much for ${what}?`, 'deploy']) });
    m.push({ role: 'assistant', content: pick([
      'Happy to. Which app or Docker image (WordPress, Minecraft, Postgres, your own image...)? I can size it from a description like "Minecraft for 20 players" and quote it.',
      'Sure. Tell me the image or app to run; size is optional - describe the load and I will pick a sensible one and quote it. Instances default to 3.',
      'Which app or image, and roughly what for? Give me that and I will size it, quote it, and deploy once you agree.']) });
    const s2 = { ...scenario(), flow: 'deploy', surface: s.surface, pricing: s.pricing };
    m.push({ role: 'user', content: userOpening(s2, pick(['OK:', 'Alright,', 'Let us do', 'Fine -'])) });
    const { spec, q } = quoteFlow(m, s2);
    if (chance(0.6)) { m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s2, spec, q); }
    return m;
  }
  if (F === 'offtopic') {
    const QA = [['hello', 'Hi! Tell me what you want to run - an app, a game server, a database - and I will size it, quote it and deploy it on Flux.'], ['Hi there!', 'Hello! What would you like to deploy on Flux?'], ['What can you do?', 'I deploy and manage apps on Flux Cloud: quote a price for any Docker image or common app, deploy it after you agree, then show status and logs, restart or cancel it.'], ['Who are you?', 'I am Flux AI, the assistant in Flux Cloud. I quote, deploy and manage apps on the Flux decentralized cloud for you.'], ['Thanks!', 'You are welcome. Anything else to deploy?'], ['What is Flux?', 'Flux is a decentralized cloud: thousands of independently run nodes host Docker apps, paid monthly in FLUX from $0.99. Tell me what to run and I will quote it.'], ['Can you write me a poem?', 'Deployments are my thing rather than poetry, but I can have a WordPress site for your poems running in a minute if you like.'], ['What is 17 times 23?', '391. Anything to deploy?'], ['Do I need to run a node to deploy?', 'No. Deploying an app does not require running a FluxNode; you pay per month for the resources your app declares. Tell me what to run and I will quote it.'], ['Can I pay with a credit card?', 'Flux Cloud prices are in USD and paid in FLUX from your signed-in account; I take care of the payment when you approve a quote.']];
    const [q, a] = pick(QA); m.push({ role: 'user', content: q }); m.push({ role: 'assistant', content: a }); return m;
  }
  if (F === 'manage') {
    const name = pick(['mysite', 'craftworld', 'appdb', 'wpsite', 'backend1', 'palserver']);
    const kind = pick(['list', 'logs', 'logs', 'restart', 'cancel', 'status', 'network']);
    if (kind === 'list') {
      m.push({ role: 'user', content: pick(['What apps do I have running?', 'Show my apps', 'List my deployments', 'Which apps are mine?', 'my apps']) });
      const c = tc('flux_list_my_apps', {}); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const apps = [{ name: 'mysite', instances: 3, expiresInDays: ri(2, 28) }, { name: 'appdb', instances: 1, expiresInDays: ri(2, 28) }];
      m.push(toolMsg(c.id, { apps }));
      m.push({ role: 'assistant', content: `You have ${apps.length} apps: ${apps.map((a) => `**${a.name}** (${a.instances} ${a.instances === 1 ? 'instance' : 'instances'}, expires in ${a.expiresInDays} days)`).join(' and ')}.` });
    } else if (kind === 'logs') {
      m.push({ role: 'user', content: pick([`Show me the logs of ${name}`, `${name} logs please`, `Why is ${name} not reachable? Check its logs.`, `${name} is down, what happened?`]) });
      const c = tc('flux_get_app_logs', { name, lines: 50 }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const kindL = pick(['crash', 'ok', 'oom', 'dbconn']);
      const lines = { crash: ['Error: listen EADDRINUSE: address already in use :::8080', 'exited with code 1'], ok: ['Server listening on port 80', 'GET / 200 12ms', 'GET /health 200 1ms'], oom: ['Killed', 'fatal: out of memory', 'exited with code 137'], dbconn: ['ECONNREFUSED 127.0.0.1:5432', 'could not connect to database, retrying in 5s'] }[kindL];
      m.push(toolMsg(c.id, { lines }));
      const say = { crash: `**${name}** crashes at start: "address already in use :::8080" - two processes in the container bind the same port, or the start command runs twice. Fix the image or its command and I can redeploy it.`,
        ok: `**${name}** looks healthy: listening on port 80 and serving requests (last: GET /health 200). If it is unreachable from outside, check that the port is published in the spec and use https://${name}.app.runonflux.io.`,
        oom: `**${name}** was killed for running out of memory (exit 137). Give it more RAM: tell me the new size and I will quote the update.`,
        dbconn: `**${name}** cannot reach its database at 127.0.0.1:5432. In a multi-component app use the component's name as the host, not localhost, and make sure the database component is running.` }[kindL];
      m.push({ role: 'assistant', content: say });
    } else if (kind === 'restart') {
      m.push({ role: 'user', content: pick([`Restart ${name}`, `Please restart ${name}, it hung`, `Redeploy ${name} with the latest image`]) });
      const action = /redeploy|latest/i.test(m[1].content) ? 'redeploy' : 'restart';
      const c = tc('flux_control_app', { name, action }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      m.push(toolMsg(c.id, { ok: true, action, name }));
      m.push({ role: 'assistant', content: action === 'redeploy' ? `**${name}** is being redeployed: the image is pulled again and the containers recreated. Back within a minute or two.` : `**${name}** has been restarted on its nodes.` });
    } else if (kind === 'cancel') {
      m.push({ role: 'user', content: pick([`Cancel ${name}`, `Delete ${name}, I don't need it anymore`, `Stop paying for ${name}`]) });
      m.push({ role: 'assistant', content: `Cancelling **${name}** ends it early; the remaining term is not refunded. Do you want me to cancel it?` });
      if (chance(0.7)) { m.push({ role: 'user', content: pick(YES) }); const c = tc('flux_cancel_app', { name, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c] }); m.push(toolMsg(c.id, { ok: true, name, expiresInMinutes: 60 })); m.push({ role: 'assistant', content: `Done. **${name}** will expire within about an hour and stop running.` }); }
      else { m.push({ role: 'user', content: pick(NO) }); m.push({ role: 'assistant', content: `OK, **${name}** stays as it is.` }); }
    } else if (kind === 'status') {
      m.push({ role: 'user', content: pick([`Is ${name} running?`, `Status of ${name}?`, `How is ${name} doing?`]) });
      const c = tc('flux_get_app', { name }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const n = ri(0, 3); m.push(toolMsg(c.id, { name, running: n, instances: 3, expiresInDays: ri(1, 29), url: `https://${name}.app.runonflux.io` }));
      m.push({ role: 'assistant', content: n ? `**${name}** is running on ${n} of 3 nodes at https://${name}.app.runonflux.io.` : `**${name}** is registered but not running on any node right now. It may be re-scheduling; if it stays down, check its logs.` });
    } else {
      m.push({ role: 'user', content: pick(['How many nodes does Flux have right now?', 'What is the FLUX price?', 'Network status?']) });
      const c = tc('flux_get_network_info', {}); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const info = { nodes: { cumulus: ri(3000, 5000), nimbus: ri(1000, 2000), stratus: ri(400, 900) }, height: ri(2950000, 2970000), fluxUsd: s.pricing.fluxUsd };
      m.push(toolMsg(c.id, info));
      m.push({ role: 'assistant', content: `${info.nodes.cumulus + info.nodes.nimbus + info.nodes.stratus} nodes online (${info.nodes.cumulus} Cumulus, ${info.nodes.nimbus} Nimbus, ${info.nodes.stratus} Stratus), block ${info.height}, FLUX at $${info.fluxUsd}.` });
    }
    return m;
  }
  // everything else starts with an opening request
  m.push({ role: 'user', content: userOpening(s) });
  if (F === 'yes-first') {
    m[1].content = `${m[1].content} ${pick(['Yes, deploy it right away.', 'Go ahead and deploy, I agree already.', 'confirm and deploy'])}`;
    const { spec, q } = quoteFlow(m, s, s.name, pick(['I will show you the price first; deploying spends FLUX, so the quote comes before the deploy.', 'Quote first - it takes a second - then I deploy on your yes.']));
    m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s, spec, q); return m;
  }
  if (F === 'skipquote') {
    const { spec, q } = quoteFlow(m, s, s.name, pick(['I always get the quote first - deployment spends FLUX, so you should see the price before I do it.', 'Quote first, always; it only takes a second.']));
    m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s, spec, q); return m;
  }
  if (F === 'error') {
    const kind = pick(['name-taken', 'name-flux', 'ram-step', 'balance', 'image']);
    if (kind === 'name-flux') { s.name = pick(['fluxsite', 'flux-blog', 'zelnode1', 'fluxapp2']); m[1].content = userOpening(s); }
    if (kind === 'ram-step') { s.mode = 'explicit'; s.cpu = 1; s.ramGB = 1.25; s.hdd = 10; s.unitTrap = false; s.ram = 1250; m[1].content = userOpening(s).replace(/1\.25 GB RAM/, '1250 MB RAM'); }
    const a = buildArgs(s); const c1 = tc('flux_build_spec', a); m.push({ role: 'assistant', content: '', tool_calls: [c1] });
    if (kind === 'name-flux') {
      m.push(toolMsg(c1.id, { error: `invalid name "${s.name}": app names must not start with flux or zel` }));
      const alt = s.name.replace(/^(flux-?|zel)/i, 'my');
      m.push({ role: 'assistant', content: `App names cannot start with "flux" or "zel" (reserved). I can use **${alt}** instead - OK?` });
      m.push({ role: 'user', content: pick(['ok', 'fine', 'yes use that', 'sure']) });
      s.name = alt; const { spec, q } = quoteFlow(m, s, alt); if (chance(0.7)) { m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s, spec, q); }
      return m;
    }
    if (kind === 'ram-step') {
      m.push(toolMsg(c1.id, { error: 'ram must be a multiple of 100 MB (got 1250)' }));
      s.ram = 1300; const a2 = buildArgs(s); const spec = specFrom(a2); const c2 = tc('flux_build_spec', a2); m.push({ role: 'assistant', content: 'RAM has to be a multiple of 100 MB; rounding 1250 up to 1300.', tool_calls: [c2] });
      m.push(toolMsg(c2.id, { spec })); const c3 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c3] });
      const q = quoteFor(spec, s.pricing); m.push(toolMsg(c3.id, q)); m.push({ role: 'assistant', content: `${quoteLine(s, q, spec)} ${askDeploy()}` });
      return m;
    }
    const spec = specFrom(a); m.push(toolMsg(c1.id, { spec }));
    const c2 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
    const q = quoteFor(spec, s.pricing); m.push(toolMsg(c2.id, q)); m.push({ role: 'assistant', content: `${quoteLine(s, q, spec)} ${askDeploy()}` });
    m.push({ role: 'user', content: pick(YES) });
    const c3 = tc('flux_deploy_app', { spec, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c3] });
    if (kind === 'name-taken') {
      m.push(toolMsg(c3.id, { error: `an application named "${spec.name}" is already registered` }));
      const alt = `${spec.name}${ri(2, 99)}`;
      m.push({ role: 'assistant', content: `The name **${spec.name}** is already taken on the network. Shall I use **${alt}**? Same spec and price.` });
      m.push({ role: 'user', content: pick(YES) });
      const spec2 = { ...spec, name: alt }; deployFlow(m, s, spec2, quoteFor(spec2, s.pricing));
    } else if (kind === 'balance') {
      m.push(toolMsg(c3.id, { error: `insufficient balance: ${q.flux} FLUX required, ${(q.flux * 0.4).toFixed(2)} FLUX available` }));
      m.push({ role: 'assistant', content: `Not deployed: the payment address has ${(q.flux * 0.4).toFixed(2)} FLUX and this needs ${q.flux} FLUX. Top up in Flux Cloud, or tell me to shrink it (fewer instances or a shorter term) and I will re-quote.` });
    } else {
      m.push(toolMsg(c3.id, { error: `image ${spec.compose[0].repotag} not found or not pullable (registry returned 404)` }));
      m.push({ role: 'assistant', content: `Not deployed: the image **${spec.compose[0].repotag}** could not be pulled (404 from the registry). Check the tag exists and is public - or, for a private registry, deploy it as an enterprise app with registry credentials. Give me the corrected image and I will re-quote.` });
    }
    return m;
  }
  // estimate / deploy / deploy-followup / deploy-change / stale-quote / decline / unclear
  const { spec, q } = quoteFlow(m, s);
  if (F === 'estimate') return m;
  if (F === 'decline') { m.push({ role: 'user', content: pick(NO) }); m.push({ role: 'assistant', content: pick(['Understood, nothing deployed. Tell me if you want a different size or price.', 'OK, I have not deployed anything. Come back whenever you are ready.', 'No problem. Nothing was charged.']) }); return m; }
  if (F === 'unclear') {
    m.push({ role: 'user', content: pick(UNCLEAR) });
    m.push({ role: 'assistant', content: pick([`For ${sizeWords(spec)} times ${spec.instances} that is the going rate on Flux; a single instance would be about a third. Do you want me to deploy it as quoted, change it, or leave it?`, 'Nothing is deployed yet. Say "deploy" to go ahead with this quote, or tell me what to change.']) });
    if (chance(0.6)) { m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s, spec, q); } else { m.push({ role: 'user', content: pick(NO) }); m.push({ role: 'assistant', content: 'OK, nothing deployed.' }); }
    return m;
  }
  if (F === 'deploy-change' || F === 'stale-quote') {
    const line = pick(['That is too much, can you make it cheaper?', 'Too expensive. Use 1 instance instead.', 'Can we halve the RAM?', 'Drop it to a single instance.', 'Cheaper please, smaller disk.', 'Make it 2 instances and double the disk.', 'Actually 4 cores.']);
    m.push({ role: 'user', content: F === 'stale-quote' ? `${line} ${pick(['And deploy.', 'Then deploy it.', 'deploy'])}` : line });
    const s2 = { ...s, mode: 'explicit', unitTrap: false, ramGB: null };
    if (/1 instance|single/i.test(line)) s2.instances = 1; else if (/RAM/i.test(line)) s2.ram = roundRam(s.ram / 2); else if (/smaller disk/i.test(line)) s2.hdd = Math.max(1, Math.round(s.hdd / 2)); else if (/2 instances/i.test(line)) { s2.instances = 2; s2.hdd = s.hdd * 2; } else if (/4 cores/i.test(line)) s2.cpu = 4; else s2.instances = 1;
    const prefix = F === 'stale-quote' ? pick(['The spec changed, so I re-quote before deploying.', 'New size means a new quote first.']) : '';
    const r2 = quoteFlow(m, s2, s.name, prefix);
    const last = m[m.length - 1];
    last.content = `${last.content} That is ${money(Math.abs(q.usdTotal - r2.q.usdTotal))} ${r2.q.usdTotal < q.usdTotal ? 'less' : 'more'} than before.`;
    if (chance(0.6)) { m.push({ role: 'user', content: pick(YES) }); deployFlow(m, s2, r2.spec, r2.q); }
    return m;
  }
  // deploy / deploy-followup
  m.push({ role: 'user', content: pick(YES) });
  const running = deployFlow(m, s, spec, q);
  if (F === 'deploy-followup' && running) followup(m, s, spec);
  return m;
}

// --- teacher paraphrase of user lines -----------------------------------------------
async function paraphrase(text) {
  if (NO_TEACHER || !TEACHER.key) return text;
  const res = await fetch(`${TEACHER.base}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEACHER.key}` },
    body: JSON.stringify({ model: TEACHER.model, temperature: 0.9, max_tokens: 400, reasoning_effort: 'low', messages: [
      { role: 'system', content: 'Rewrite the user message in a different natural way, as a real person typing into a chat box would: casual or terse or polite, sometimes with a typo or lowercase. Keep EVERY number, unit, app name, image name and region exactly as given. Output only the rewritten message.' },
      { role: 'user', content: text }] }),
    signal: AbortSignal.timeout(300000),
  }).catch(() => null);
  if (!res || !res.ok) return text;
  const j = await res.json().catch(() => null);
  const out = (j?.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
  const tokens = (text.match(/\d+(?:\.\d+)?|[a-z0-9./:_-]*[:/][a-z0-9./:_-]+|\b[a-z]+\d+\b/gi) || []);
  if (!out || out.length > text.length * 2.5 || tokens.some((t) => !out.includes(t))) return text;
  return out;
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const outStream = fs.createWriteStream(OUT);
  const stats = { flows: {}, surfaces: {} };
  let done = 0; let para = 0;
  const jobs = Array.from({ length: N }, (_, i) => i);
  async function worker() {
    while (jobs.length) {
      jobs.pop();
      const s = scenario();
      const messages = build(s);
      stats.flows[s.flow] = (stats.flows[s.flow] || 0) + 1; stats.surfaces[s.surface.kind] = (stats.surfaces[s.surface.kind] || 0) + 1;
      for (const msg of messages) if (msg.role === 'user' && chance(0.6) && msg.content.length > 12) { const p = await paraphrase(msg.content); if (p !== msg.content) { para += 1; msg.content = p; } }
      outStream.write(`${JSON.stringify({ messages, tools: s.surface.tools })}\n`);
      done += 1; if (done % 100 === 0) process.stderr.write(`${done}/${N} (${para} paraphrased)\n`);
    }
  }
  await Promise.all(Array.from({ length: NO_TEACHER ? 1 : CONC }, worker));
  outStream.end();
  console.log(`wrote ${done} dialogues to ${OUT} (${para} user lines paraphrased)\n${JSON.stringify(stats)}`);
})();
