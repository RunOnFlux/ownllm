#!/usr/bin/env node
/**
 * Deploy-agent training dialogues, correct by construction.
 *
 * Every tool call in the output is produced by code from a sampled scenario
 * (app preset, resources, instances, region, term), so the arguments and the
 * order - build, quote, show, wait for yes, deploy, wait - are right by
 * definition. The teacher model is used for one thing only: paraphrasing the
 * user's lines so the model sees natural language, and each paraphrase is
 * checked to still contain every number and name of the original. Assistant
 * prose is templated with variation; it is short on purpose, because the
 * behaviour being taught is the protocol, not eloquence.
 *
 *   TEACHER_BASE=http://localhost:8799/v1 TEACHER_MODEL=gpt-oss:20b TEACHER_KEY=sk-flux-... \
 *   node finetune/gen-deploy.js --n 2000 --out finetune/data/deploy.jsonl [--concurrency 12] [--no-teacher]
 *
 * Output: JSONL of {"messages": [...], "tools": [...]} in OpenAI chat format,
 * one complete conversation per line. Mixed flows, in rough proportion to
 * what the chat row will see: estimates, deploys with confirmation, changes
 * of mind, vague asks that need a question back, unit traps, management,
 * and off-topic lines answered without tools.
 */
const fs = require('node:fs');
const path = require('node:path');
const TOOLS = require('./tools-compact');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const N = Number(opt('n', 500));
const OUT = opt('out', path.join(__dirname, 'data', 'deploy.jsonl'));
const CONC = Number(opt('concurrency', 8));
const NO_TEACHER = args.includes('--no-teacher');
const SEED = Number(opt('seed', 7));
const TEACHER = { base: (process.env.TEACHER_BASE || 'http://localhost:8799/v1').replace(/\/$/, ''), model: process.env.TEACHER_MODEL || 'gpt-oss:20b', key: process.env.TEACHER_KEY || '' };

// Deterministic PRNG so a dataset can be regenerated.
let seed = SEED;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const SYSTEM = 'You are Flux AI, the assistant inside Flux Cloud. You help people run apps on the Flux decentralized cloud with the tools. '
  + 'Prices are USD per month. Get a quote with flux_quote_app and show it before any deployment; call flux_deploy_app with confirm=true only after the user has agreed to that quote. '
  + 'The user is signed in: never ask for keys, wallets or addresses. Be brief.';

// --- presets ----------------------------------------------------------------
const PRESETS = [
  { key: 'nginx', names: ['nginx', 'a web server', 'an nginx web server', 'a static site with nginx'], image: 'nginx:latest', ports: [80], cpu: 0.5, ram: 500, hdd: 5, appname: ['mysite', 'webdemo', 'landing', 'nginxdemo', 'staticweb'] },
  { key: 'wordpress', names: ['WordPress', 'a WordPress site', 'a blog on WordPress'], image: 'wordpress:latest', ports: [80], cpu: 1, ram: 2000, hdd: 20, appname: ['myblog', 'wpsite', 'companyblog', 'wordpressdemo'] },
  { key: 'minecraft', names: ['a Minecraft server', 'a Minecraft server for {players} players', 'a Minecraft server for my friends ({players} people)'], image: 'itzg/minecraft-server:latest', ports: [25565], env: ['EULA=TRUE'], cpu: 2, ram: 4000, hdd: 20, appname: ['mcserver', 'craftworld', 'blockparty', 'ourminecraft'], sized: true },
  { key: 'postgres', names: ['a PostgreSQL database', 'Postgres', 'a postgres 16 database'], image: 'postgres:16', ports: [5432], env: ['POSTGRES_PASSWORD=changeme'], cpu: 1, ram: 2000, hdd: 40, appname: ['pgmain', 'appdb', 'postgresdemo'] },
  { key: 'redis', names: ['Redis', 'a Redis cache'], image: 'redis:7', ports: [6379], cpu: 0.5, ram: 1000, hdd: 5, appname: ['cache', 'redisdemo', 'sessioncache'] },
  { key: 'uptime', names: ['Uptime Kuma', 'an uptime monitor (Uptime Kuma)'], image: 'louislam/uptime-kuma:1', ports: [3001], cpu: 0.5, ram: 500, hdd: 5, appname: ['uptime', 'statuspage', 'monitor1'] },
  { key: 'nextcloud', names: ['Nextcloud', 'a Nextcloud instance', 'my own cloud storage with Nextcloud'], image: 'nextcloud:latest', ports: [80], cpu: 2, ram: 4000, hdd: 100, appname: ['mycloud', 'nextclouddemo', 'familycloud'] },
  { key: 'custom', names: ['my app ({image})', 'the image {image}', 'my Docker image {image}', 'a container from {image}'], image: null, ports: [8080], cpu: 1, ram: 1000, hdd: 10, appname: ['myapp', 'backend1', 'apiserver', 'demoapp', 'service2'] },
  { key: 'teamspeak', names: ['a TeamSpeak server', 'TeamSpeak'], image: 'teamspeak:latest', ports: [9987, 10011, 30033], env: ['TS3SERVER_LICENSE=accept'], cpu: 0.5, ram: 500, hdd: 5, appname: ['voice', 'tsserver', 'teamspeakdemo'] },
  { key: 'ghost', names: ['Ghost', 'a Ghost blog'], image: 'ghost:5', ports: [2368], cpu: 1, ram: 1000, hdd: 10, appname: ['ghostblog', 'newsletter', 'myghost'] },
];
const CUSTOM_IMAGES = ['ghcr.io/acme/api:1.4.2', 'docker.io/janedoe/shop:latest', 'myorg/backend:2.0', 'registry.example.com/team/app:prod', 'node:22-alpine', 'python:3.12-slim'];
const REGIONS = [['Europe', 'acEU'], ['the EU', 'acEU'], ['North America', 'acNA'], ['the US', 'acNA'], ['Asia', 'acAS'], ['Australia', 'acOC'], ['South America', 'acSA']];
const PRICING = { cpuCore: 0.9, ramGB: 0.75, hddGB: 0.12, minimum: 0.99, fluxUsd: 0.21, discount: 0.1 };

function minecraftSize(players) {
  if (players <= 5) return { cpu: 1, ram: 2000, hdd: 10 };
  if (players <= 12) return { cpu: 2, ram: 3000, hdd: 20 };
  if (players <= 25) return { cpu: 2, ram: 4000, hdd: 20 };
  if (players <= 50) return { cpu: 4, ram: 8000, hdd: 40 };
  return { cpu: 6, ram: 12000, hdd: 60 };
}
const roundRam = (mb) => Math.max(100, Math.round(mb / 100) * 100);
const roundCpu = (c) => Math.max(0.1, Math.round(c * 10) / 10);

// --- scenario ---------------------------------------------------------------
function scenario() {
  const preset = pick(PRESETS);
  const s = { preset, image: preset.image || pick(CUSTOM_IMAGES), ports: preset.ports, env: preset.env || [] };
  s.name = pick(preset.appname) + (chance(0.4) ? String(ri(1, 99)) : '');
  s.players = preset.sized ? pick([4, 8, 10, 12, 15, 20, 25, 30, 50, 80]) : null;
  s.explicit = chance(0.55);          // user states resources
  s.unitTrap = s.explicit && chance(0.3);
  if (s.explicit) {
    s.cpu = pick([0.5, 1, 1, 2, 2, 3, 4, 6]);
    s.ramGB = pick([0.5, 1, 1, 2, 2, 4, 4, 8, 16]);
    s.hdd = pick([5, 10, 10, 20, 20, 50, 100]);
  } else if (preset.sized) {
    Object.assign(s, minecraftSize(s.players), { ramGB: null });
  } else {
    s.cpu = preset.cpu; s.ram = preset.ram; s.hdd = preset.hdd; s.ramGB = null;
  }
  if (s.ramGB != null) s.ram = roundRam(s.ramGB * 1000);
  s.instances = chance(0.5) ? pick([1, 1, 2, 3, 3, 5]) : 3;
  s.instancesStated = s.instances !== 3 || chance(0.3);
  s.months = chance(0.2) ? pick([0.25, 0.5, 2, 3, 6, 12]) : 1;
  s.region = chance(0.3) ? pick(REGIONS) : null;
  s.flow = pick(['estimate', 'estimate', 'deploy', 'deploy', 'deploy', 'deploy-change', 'vague', 'deploy-skipquote', 'manage', 'offtopic', 'decline']);
  return s;
}

const term = (m) => m === 1 ? 'a month' : m === 0.25 ? 'a week' : m === 0.5 ? 'two weeks' : m === 12 ? 'a year' : `${m} months`;
const resWords = (s) => {
  if (!s.explicit) return '';
  const ram = s.unitTrap && s.ramGB < 1 ? `${s.ramGB * 1024} MB RAM` : s.unitTrap ? `${s.ramGB}G of memory` : `${s.ramGB} GB RAM`;
  const cpu = s.unitTrap ? `${s.cpu} vCPU` : `${s.cpu} ${s.cpu === 1 ? 'core' : 'cores'}`;
  const hdd = s.unitTrap ? `${s.hdd}GB SSD` : `${s.hdd} GB disk`;
  return `${cpu}, ${ram}, ${hdd}`;
};
const appWords = (s) => pick(s.preset.names).replace('{players}', s.players).replace('{image}', s.image);

function userOpening(s) {
  const bits = [];
  const what = appWords(s);
  const res = resWords(s);
  const inst = s.instancesStated ? `${s.instances} ${s.instances === 1 ? 'instance' : 'instances'}` : '';
  const reg = s.region ? `in ${s.region[0]}` : '';
  const t = s.months !== 1 ? `for ${term(s.months)}` : '';
  if (s.flow === 'estimate') bits.push(pick([`How much would ${what} cost`, `Estimate the cost of ${what}`, `What does it cost to run ${what}`, `Price for ${what}`, `Give me a quote for ${what}`]));
  else if (s.flow === 'deploy-skipquote') bits.push(pick([`Deploy ${what} right now, skip the quote`, `Just deploy ${what}, I don't need the price`, `Launch ${what} immediately`]));
  else bits.push(pick([`Deploy ${what}`, `I want to run ${what}`, `Set up ${what}`, `Can you launch ${what}`, `Spin up ${what}`, `Run ${what} for me`]));
  const extras = [res, inst, reg, t].filter(Boolean);
  if (extras.length) bits.push(extras.join(', '));
  if (s.preset.key === 'custom' && chance(0.6)) bits.push(`port ${s.ports[0]}`);
  const end = s.flow === 'estimate' ? '?' : '.';
  const naming = pick([`Call it ${s.name}.`, `App name ${s.name}.`, `Name it ${s.name}.`, `The app name is ${s.name}.`]);
  return `${bits.join(', ')}${end} ${naming}`;
}

// --- tool results (mocked, consistent) ---------------------------------------
function buildArgs(s) {
  const comp = { name: s.preset.key === 'custom' ? 'app' : s.preset.key, image: s.image, ports: s.ports, cpu: roundCpu(s.cpu), ram: roundRam(s.ram), hdd: s.hdd };
  if (s.env.length) comp.env = s.env;
  const a = { name: s.name, description: `${appWords(s).replace(/\bmy\b/g, '')}`.trim(), components: [comp], instances: s.instances };
  if (s.months !== 1) a.months = s.months;
  if (s.region) a.geolocation = [s.region[1]];
  return a;
}
function specFrom(a) {
  const c = a.components[0];
  return { version: 8, name: a.name, description: a.description, compose: [{ name: c.name, repotag: c.image, ports: c.ports, containerPorts: c.ports, domains: c.ports.map(() => ''), environmentParameters: c.env || [], commands: [], containerData: '/data', cpu: c.cpu, ram: c.ram, hdd: c.hdd }], instances: a.instances || 3, expire: Math.round((a.months || 1) * 88000), ...(a.geolocation ? { geolocation: a.geolocation } : {}) };
}
function quoteFor(spec) {
  const c = spec.compose[0]; const months = spec.expire / 88000;
  const perInst = c.cpu * PRICING.cpuCore + (c.ram / 1000) * PRICING.ramGB + c.hdd * PRICING.hddGB;
  const usd = Math.max(PRICING.minimum, perInst * spec.instances) * months;
  return { usdPerMonth: Number((usd / months).toFixed(2)), usdTotal: Number(usd.toFixed(2)), months, instances: spec.instances, flux: Number((usd / PRICING.fluxUsd * (1 - PRICING.discount)).toFixed(2)) };
}
let callN = 0;
const tc = (name, a) => ({ id: `call_${(callN += 1).toString(36)}`, type: 'function', function: { name, arguments: JSON.stringify(a) } });
const toolMsg = (id, obj) => ({ role: 'tool', tool_call_id: id, content: JSON.stringify(obj) });

// --- assistant prose -------------------------------------------------------------
const money = (n) => `$${n.toFixed(2)}`;
function quoteLine(s, q, spec) {
  const c = spec.compose[0];
  const size = `${c.cpu} ${c.cpu === 1 ? 'core' : 'cores'}, ${c.ram >= 1000 ? `${c.ram / 1000} GB` : `${c.ram} MB`} RAM, ${c.hdd} GB disk`;
  const inst = `${spec.instances} ${spec.instances === 1 ? 'instance' : 'instances'}`;
  const t = q.months === 1 ? 'per month' : `for ${term(q.months)} (${money(q.usdPerMonth)}/month)`;
  const head = pick([`**${spec.name}**: ${size}, ${inst}${spec.geolocation ? `, ${s.region[0]}` : ''} — **${money(q.usdTotal)}** ${t}, about ${q.flux} FLUX.`,
    `Quote for **${spec.name}** (${size}, ${inst}${spec.geolocation ? `, ${s.region[0]}` : ''}): **${money(q.usdTotal)}** ${t} (≈ ${q.flux} FLUX).`,
    `${inst} of ${size}${spec.geolocation ? ` in ${s.region[0]}` : ''} come to **${money(q.usdTotal)}** ${t}, roughly ${q.flux} FLUX.`]);
  const notes = [];
  if (s.unitTrap && s.ramGB < 1) notes.push(`RAM is rounded to ${c.ram} MB (multiples of 100).`);
  if (!s.explicit && s.preset.sized) notes.push(`Sized for ${s.players} players.`);
  else if (!s.explicit) notes.push(`Using the usual size for ${s.preset.names[0].replace(/^(a|an) /, '')}; say if you want more or less.`);
  return `${head}${notes.length ? ` ${notes.join(' ')}` : ''}`;
}
const askDeploy = () => pick(['Shall I deploy it?', 'Want me to go ahead and deploy?', 'Deploy it now?', 'Should I deploy this?', 'Say yes and I will deploy it.']);
const yesLines = ['Yes, go ahead.', 'yes', 'Deploy it.', 'Sounds good, do it.', 'OK deploy', 'Yes please', 'go', 'Sure, launch it.', 'Confirmed.', 'Yep.'];
const noLines = ['No, not now.', 'Hold on, no.', 'Cancel that.', 'no thanks', 'Not yet.'];
const cheaperLines = ['That is too much, can you make it cheaper?', 'Too expensive. Use 1 instance instead.', 'Can we halve the RAM?', 'Drop it to a single instance.', 'Cheaper please, smaller disk.'];

// --- flows ----------------------------------------------------------------------
function flowDeploy(s, skipQuote) {
  const m = [{ role: 'system', content: SYSTEM }, { role: 'user', content: userOpening(s) }];
  const a = buildArgs(s); const c1 = tc('flux_build_spec', a);
  m.push({ role: 'assistant', content: skipQuote ? pick(['I will get the quote first - deployment spends FLUX, so you should see the price before I do it.', 'Quote first, always; it only takes a second.']) : '', tool_calls: [c1] });
  const spec = specFrom(a); m.push(toolMsg(c1.id, { spec }));
  const c2 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
  const q = quoteFor(spec); m.push(toolMsg(c2.id, q));
  m.push({ role: 'assistant', content: `${quoteLine(s, q, spec)} ${askDeploy()}` });
  return { m, spec, q, a };
}
function afterYes(m, s, spec, q) {
  m.push({ role: 'user', content: pick(yesLines) });
  const c3 = tc('flux_deploy_app', { spec, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c3] });
  const txid = Array.from({ length: 64 }, () => '0123456789abcdef'[ri(0, 15)]).join('');
  m.push(toolMsg(c3.id, { status: 'broadcast', txid, name: spec.name, paidFlux: q.flux }));
  const c4 = tc('flux_wait_for_app', { name: spec.name }); m.push({ role: 'assistant', content: '', tool_calls: [c4] });
  const running = chance(0.85);
  m.push(toolMsg(c4.id, running ? { running: true, instances: spec.instances, url: `https://${spec.name}.app.runonflux.io` } : { running: false, instances: 0, note: 'not yet scheduled, usually within a few minutes' }));
  m.push({ role: 'assistant', content: running
    ? pick([`Deployed. **${spec.name}** is running on ${spec.instances} ${spec.instances === 1 ? 'node' : 'nodes'}: https://${spec.name}.app.runonflux.io${spec.compose[0].ports[0] !== 80 ? ` (port ${spec.compose[0].ports[0]} at https://${spec.name}_${spec.compose[0].ports[0]}.app.runonflux.io)` : ''}. Paid ${q.flux} FLUX.`,
      `**${spec.name}** is live at https://${spec.name}.app.runonflux.io with ${spec.instances} ${spec.instances === 1 ? 'instance' : 'instances'}. ${q.flux} FLUX was paid for ${term(q.months)}.`])
    : `Paid and registered (${q.flux} FLUX). **${spec.name}** is not scheduled yet; nodes usually pick it up within a few minutes. Ask me to check again or open Applications in Flux Cloud.` });
}

function build(s) {
  callN = 0;
  if (s.flow === 'estimate') {
    const { m } = flowDeploy(s, false);
    return m;
  }
  if (s.flow === 'deploy' || s.flow === 'deploy-skipquote') {
    const { m, spec, q } = flowDeploy(s, s.flow === 'deploy-skipquote');
    afterYes(m, s, spec, q);
    return m;
  }
  if (s.flow === 'decline') {
    const { m } = flowDeploy(s, false);
    m.push({ role: 'user', content: pick(noLines) });
    m.push({ role: 'assistant', content: pick(['Understood, nothing deployed. Tell me if you want a different size or price.', 'OK, I have not deployed anything. Come back whenever you are ready.', 'No problem. Nothing was charged.']) });
    return m;
  }
  if (s.flow === 'deploy-change') {
    const { m, spec, q } = flowDeploy(s, false);
    const line = pick(cheaperLines); m.push({ role: 'user', content: line });
    const a2 = buildArgs(s);
    if (/1 instance|single instance/i.test(line)) a2.instances = 1; else if (/RAM/i.test(line)) a2.components[0].ram = roundRam(a2.components[0].ram / 2); else if (/disk/i.test(line)) a2.components[0].hdd = Math.max(1, Math.round(a2.components[0].hdd / 2)); else { a2.instances = 1; }
    const c1 = tc('flux_build_spec', a2); m.push({ role: 'assistant', content: '', tool_calls: [c1] });
    const spec2 = specFrom(a2); m.push(toolMsg(c1.id, { spec: spec2 }));
    const c2 = tc('flux_quote_app', { spec: spec2 }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
    const q2 = quoteFor(spec2); m.push(toolMsg(c2.id, q2));
    const s2 = { ...s, instances: spec2.instances, explicit: true, unitTrap: false };
    m.push({ role: 'assistant', content: `${quoteLine(s2, q2, spec2)} That is ${money(q.usdTotal - q2.usdTotal)} less. ${askDeploy()}` });
    if (chance(0.6)) afterYes(m, s2, spec2, q2);
    return m;
  }
  if (s.flow === 'vague') {
    const what = pick(['an app', 'something for my community', 'a game server', 'a database', 'a server', 'my project']);
    const m = [{ role: 'system', content: SYSTEM }, { role: 'user', content: pick([`I want to deploy ${what}.`, `Can you run ${what} on Flux?`, `Host ${what} for me`, `How much for ${what}?`]) }];
    m.push({ role: 'assistant', content: pick([
      `Happy to. Which Docker image (or which app: WordPress, Minecraft, Postgres...), and roughly what size - cores, RAM, disk - or tell me the workload and I will suggest one.`,
      `Sure. I need two things: the image or app you want to run, and a size (or describe the load, e.g. "Minecraft for 20 players", and I will size it). Instances default to 3.`,
      `Tell me which app or Docker image, and how big: cores, RAM and disk, or just describe what it is for and I will pick a sensible size and quote it.`]) });
    if (chance(0.7)) {
      const s2 = { ...scenario(), flow: 'deploy' };
      m.push({ role: 'user', content: userOpening(s2).replace(/^(Deploy|I want to run|Set up|Can you launch|Spin up|Run)/, pick(['OK:', 'Alright,', 'Let us do'])) });
      const a = buildArgs(s2); const c1 = tc('flux_build_spec', a); m.push({ role: 'assistant', content: '', tool_calls: [c1] });
      const spec = specFrom(a); m.push(toolMsg(c1.id, { spec }));
      const c2 = tc('flux_quote_app', { spec }); m.push({ role: 'assistant', content: '', tool_calls: [c2] });
      const q = quoteFor(spec); m.push(toolMsg(c2.id, q));
      m.push({ role: 'assistant', content: `${quoteLine(s2, q, spec)} ${askDeploy()}` });
      if (chance(0.5)) afterYes(m, s2, spec, q);
    }
    return m;
  }
  if (s.flow === 'manage') {
    const name = pick(['mysite', 'craftworld', 'appdb', 'wpsite', 'backend1']);
    const kind = pick(['list', 'logs', 'restart', 'cancel', 'status', 'network']);
    const m = [{ role: 'system', content: SYSTEM }];
    if (kind === 'list') {
      m.push({ role: 'user', content: pick(['What apps do I have running?', 'Show my apps', 'List my deployments', 'Which apps are mine?']) });
      const c = tc('flux_list_my_apps', {}); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const apps = [{ name: 'mysite', instances: 3, expiresInDays: ri(2, 28) }, { name: 'appdb', instances: 1, expiresInDays: ri(2, 28) }];
      m.push(toolMsg(c.id, { apps }));
      m.push({ role: 'assistant', content: `You have ${apps.length} apps: ${apps.map(a => `**${a.name}** (${a.instances} ${a.instances === 1 ? 'instance' : 'instances'}, expires in ${a.expiresInDays} days)`).join(' and ')}.` });
    } else if (kind === 'logs') {
      m.push({ role: 'user', content: pick([`Show me the logs of ${name}`, `${name} logs please`, `What is ${name} printing?`, `Why is ${name} not reachable? Check its logs.`]) });
      const c = tc('flux_get_app_logs', { name, lines: 50 }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const crash = chance(0.5);
      m.push(toolMsg(c.id, { lines: crash ? ['Error: listen EADDRINUSE: address already in use :::8080', 'node:internal/errors:496', '    throw error;', 'exited with code 1'] : ['Server listening on port 80', 'GET / 200 12ms', 'GET /health 200 1ms'] }));
      m.push({ role: 'assistant', content: crash ? `**${name}** is crashing at start: "address already in use :::8080" - two processes in the container bind the same port, or the image's start command runs twice. Fix the image or its command and I can redeploy it.` : `**${name}** looks healthy: it is listening on port 80 and serving requests (last: GET /health 200). If it is unreachable from outside, check the port is published in the app spec and that you are using https://${name}.app.runonflux.io.` });
    } else if (kind === 'restart') {
      m.push({ role: 'user', content: pick([`Restart ${name}`, `Please restart ${name}, it hung`, `Redeploy ${name} with the latest image`]) });
      const action = /redeploy|latest/i.test(m[1].content) ? 'redeploy' : 'restart';
      const c = tc('flux_control_app', { name, action }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      m.push(toolMsg(c.id, { ok: true, action, name }));
      m.push({ role: 'assistant', content: action === 'redeploy' ? `**${name}** is being redeployed: the image is pulled again and the containers recreated. It should be back within a minute or two.` : `**${name}** has been restarted on its nodes.` });
    } else if (kind === 'cancel') {
      m.push({ role: 'user', content: pick([`Cancel ${name}`, `Delete ${name}, I don't need it anymore`, `Stop paying for ${name}`]) });
      m.push({ role: 'assistant', content: `Cancelling **${name}** ends it early; the remaining term is not refunded. Do you want me to cancel it?` });
      if (chance(0.7)) {
        m.push({ role: 'user', content: pick(yesLines) });
        const c = tc('flux_cancel_app', { name, confirm: true }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
        m.push(toolMsg(c.id, { ok: true, name, expiresInMinutes: 60 }));
        m.push({ role: 'assistant', content: `Done. **${name}** will expire within about an hour and stop running.` });
      } else {
        m.push({ role: 'user', content: pick(noLines) });
        m.push({ role: 'assistant', content: `OK, **${name}** stays as it is.` });
      }
    } else if (kind === 'status') {
      m.push({ role: 'user', content: pick([`Is ${name} running?`, `Status of ${name}?`, `How is ${name} doing?`]) });
      const c = tc('flux_get_app', { name }); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const n = ri(0, 3);
      m.push(toolMsg(c.id, { name, running: n, instances: 3, expiresInDays: ri(1, 29), url: `https://${name}.app.runonflux.io` }));
      m.push({ role: 'assistant', content: n ? `**${name}** is running on ${n} of 3 nodes at https://${name}.app.runonflux.io.` : `**${name}** is registered but not running on any node right now. It may be re-scheduling; if it stays down, check its logs.` });
    } else {
      m.push({ role: 'user', content: pick(['How many nodes does Flux have right now?', 'What is the FLUX price?', 'Network status?']) });
      const c = tc('flux_get_network_info', {}); m.push({ role: 'assistant', content: '', tool_calls: [c] });
      const info = { nodes: { cumulus: ri(3000, 5000), nimbus: ri(1000, 2000), stratus: ri(400, 900) }, height: ri(2950000, 2960000), fluxUsd: 0.21 };
      m.push(toolMsg(c.id, info));
      m.push({ role: 'assistant', content: `${info.nodes.cumulus + info.nodes.nimbus + info.nodes.stratus} nodes online (${info.nodes.cumulus} Cumulus, ${info.nodes.nimbus} Nimbus, ${info.nodes.stratus} Stratus), block ${info.height}, FLUX at $${info.fluxUsd}.` });
    }
    return m;
  }
  // offtopic / small talk: no tools
  const m = [{ role: 'system', content: SYSTEM }];
  const q = pick(['hello', 'Hi there!', 'What can you do?', 'Who are you?', 'Thanks!', 'What is Flux?', 'Can you write me a poem?', 'What is 17 times 23?']);
  m.push({ role: 'user', content: q });
  const A = {
    hello: 'Hi! Tell me what you want to run - an app, a game server, a database - and I will size it, quote it and deploy it on Flux.',
    'Hi there!': 'Hello! What would you like to deploy on Flux?',
    'What can you do?': 'I deploy and manage apps on Flux Cloud: quote a price for any Docker image or common app, deploy it after you agree, and then show status, logs, restart or cancel it.',
    'Who are you?': 'I am Flux AI, the assistant in Flux Cloud. I can quote, deploy and manage apps on the Flux decentralized cloud for you.',
    'Thanks!': 'You are welcome. Anything else to deploy?',
    'What is Flux?': 'Flux is a decentralized cloud: thousands of independently run nodes host Docker apps, paid monthly in FLUX from $0.99. Tell me what to run and I will quote it.',
    'Can you write me a poem?': 'I am here for deployments rather than poetry, but I can get a WordPress site up for your poems in a minute if you like.',
    'What is 17 times 23?': '391. Anything to deploy?',
  };
  m.push({ role: 'assistant', content: A[q] });
  return m;
}

// --- teacher paraphrase of user lines ----------------------------------------------
async function paraphrase(text) {
  if (NO_TEACHER || !TEACHER.key) return text;
  const res = await fetch(`${TEACHER.base}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEACHER.key}` },
    body: JSON.stringify({ model: TEACHER.model, temperature: 0.9, max_tokens: 400, reasoning_effort: 'low', messages: [
      { role: 'system', content: 'Rewrite the user message in a different natural way, as a real person typing into a chat box would: casual or terse or polite, sometimes with a typo. Keep EVERY number, unit, app name, image name and region exactly as given. Output only the rewritten message.' },
      { role: 'user', content: text }] }),
    signal: AbortSignal.timeout(300000),
  }).catch(() => null);
  if (!res || !res.ok) return text;
  const j = await res.json().catch(() => null);
  const out = (j?.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
  // Every number and every app/image token must survive, or keep the original.
  const tokens = (text.match(/\d+(?:\.\d+)?|[a-z0-9./:_-]*[:/][a-z0-9./:_-]+|\b[a-z]+\d+\b/gi) || []);
  if (!out || out.length > text.length * 2.5 || tokens.some(t => !out.includes(t))) return text;
  return out;
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const outStream = fs.createWriteStream(OUT);
  const stats = {};
  let done = 0; let para = 0;
  const jobs = Array.from({ length: N }, (_, i) => i);
  async function worker() {
    while (jobs.length) {
      jobs.pop();
      const s = scenario();
      const messages = build(s);
      stats[s.flow] = (stats[s.flow] || 0) + 1;
      for (const msg of messages) {
        if (msg.role === 'user' && chance(0.7)) { const p = await paraphrase(msg.content); if (p !== msg.content) { para += 1; msg.content = p; } }
      }
      outStream.write(`${JSON.stringify({ messages, tools: TOOLS })}\n`);
      done += 1;
      if (done % 50 === 0) process.stderr.write(`${done}/${N} (${para} paraphrased)\n`);
    }
  }
  await Promise.all(Array.from({ length: NO_TEACHER ? 1 : CONC }, worker));
  outStream.end();
  console.log(`wrote ${done} dialogues to ${OUT} (${para} user lines paraphrased)\nflows: ${JSON.stringify(stats)}`);
})();
