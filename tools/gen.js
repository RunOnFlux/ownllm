#!/usr/bin/env node
/**
 * Generates Flux v8 app specifications for a self-hosted Ollama + Open WebUI
 * LLM endpoint.
 *
 * The app name is baked into the internal docker DNS names (flux<component>_<appname>),
 * so it must be substituted everywhere at once - that is the whole reason this
 * generator exists. Never hand-edit "name" in the produced JSON.
 *
 *   node tools/gen.js                          # default: name=ownllm, profile=standard
 *   node tools/gen.js --name myllm --profile big
 *   node tools/gen.js --models "qwen3-coder:30b"      # override the model list
 *
 * Profiles:
 *   small     4 cpu / 8000 MB  / 20 GB   qwen3:4b                      (~2.6 GB models)
 *   standard  8 cpu / 26000 MB / 60 GB   gpt-oss:20b + qwen3:4b        (~16 GB models)
 *   big      12 cpu / 40000 MB / 80 GB   + qwen3-coder:30b             (~34 GB models)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i > -1 && argv[i + 1] ? argv[i + 1] : d;
};

const APP = arg('name', 'ownllm');
const PROFILE = arg('profile', 'standard');
const OWNER = arg('owner', '196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH');
const PORT = Number(arg('port', 33000));
const EXPIRE = Number(arg('expire', 88000)); // 88000 blocks = 1 month post-PON (30s blocks)
const INSTANCES = Number(arg('instances', 1));
// Enterprise mode: adds the auth gate, encrypts the whole compose on chain, and
// is what makes instances > 1 actually scale (see README).
const ENTERPRISE = argv.includes('--enterprise');
// Where the gate image is published. A public image needs no repoauth: the
// gate holds no secret, the API key arrives at runtime from the encrypted env.
const REGISTRY = arg('registry', 'ghcr.io/runonflux');
// The real key only ever lands in the .plaintext.json (gitignored) that feeds
// the encrypter - never in the envelope that goes on chain.
const API_KEY = arg('api-key', process.env.OWNLLM_API_KEY || crypto.randomBytes(32).toString('base64url'));
// API-only: drop the UI entirely. Every instance becomes stateless and
// identical, which is what makes horizontal scaling and node migration a
// non-event - there is no dataset to keep in sync.
const API_ONLY = argv.includes('--api-only');

// Flux rules enforced in appValidator.js: app name is alphanumeric + inner
// hyphens, max 63, and must not start with "flux" or "zel".
if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(APP) || APP.length > 63) {
  throw new Error(`Invalid app name "${APP}"`);
}
if (/^(flux|zel)/i.test(APP)) throw new Error('App name must not start with flux/zel');

const PROFILES = {
  small: { cpu: 4, ram: 8000, hdd: 20, threads: 4, models: 'qwen3:4b', loaded: 1, ctx: 16384 },
  // Sized to fit a NIMBUS node too: nimbus offers 7.0 cores / 28000 MB to apps,
  // so the whole app must stay under that. Triples the pool of eligible hosts.
  nimbus: { cpu: 5.5, ram: 24000, hdd: 50, threads: 5, models: 'gpt-oss:20b', loaded: 1, ctx: 16384 },
  // Many-cheap-replicas shape. Generation is memory-bandwidth bound, so 4 cores
  // gives up little on tokens/sec versus 8 - it is prefill that suffers. Buys a
  // far better model than 'small' for a small extra cost, and still fits NIMBUS.
  wide: { cpu: 4, ram: 16000, hdd: 25, threads: 4, models: 'gpt-oss:20b', loaded: 1, ctx: 8192 },
  standard: { cpu: 8, ram: 26000, hdd: 60, threads: 8, models: 'gpt-oss:20b qwen3:4b', loaded: 2, ctx: 16384 },
  big: { cpu: 12, ram: 40000, hdd: 80, threads: 12, models: 'gpt-oss:20b qwen3-coder:30b qwen3:4b', loaded: 2, ctx: 32768 },
};
const P = PROFILES[PROFILE];
if (!P) throw new Error(`Unknown profile ${PROFILE}. Use: ${Object.keys(PROFILES).join(', ')}`);

// Nothing about the model list is baked into the images: it is the MODELS
// environment parameter, read by the puller and by the gate's readiness check.
// --models overrides the profile default; sizes are only used for the disk
// warning below.
if (arg('models', null)) P.models = arg('models', null).trim();

const MODEL_SIZES_GB = {
  'qwen3:4b': 2.6, 'qwen3:8b': 5.2, 'gpt-oss:20b': 13, 'qwen3-coder:30b': 18, 'qwen3:30b-a3b': 18,
};
// Resident size once loaded, weights plus runtime. `ram` is a hard cgroup limit
// with only 2 GB of swap (dockerService.js:963), so overshooting it is an
// OOM-kill, not a slowdown - this is the check that matters most.
const MODEL_RAM_GB = {
  'qwen3:4b': 4, 'qwen3:8b': 6, 'gpt-oss:20b': 14, 'qwen3-coder:30b': 19, 'qwen3:30b-a3b': 19,
};

// Internal DNS name of a component's container on fluxDockerNetwork_<app>
const dns = (component) => `flux${component}_${APP}`;
const ENGINE_URL = `http://${dns('engine')}:11434`;

// Pull loop: idempotent (ollama pull is a no-op for an already-present digest),
// waits for the engine, then parks so FluxOS does not see the container exit.
// Each command string must stay under 400 chars (appValidator.js).
const bootCmd = 'apk add -q --no-cache curl; U=' + ENGINE_URL
  + '; until curl -sf $U/api/tags >/dev/null 2>&1; do sleep 5; done'
  + '; for m in $MODELS; do echo "pulling $m"; curl -s $U/api/pull -d \'{"model":"\'$m\'"}\' >/dev/null; echo "done $m"; done'
  + '; while :; do sleep 3600; done';

const engine = {
  name: 'engine',
  description: 'Ollama model server (internal only, no published port)',
  repotag: 'ollama/ollama:latest',
  ports: [],
  containerPorts: [],
  domains: [],
  environmentParameters: [
    'OLLAMA_HOST=0.0.0.0:11434',
    'OLLAMA_MODELS=/models',
    // NanoCPUs is a cgroup quota - the container still sees every host core and
    // would otherwise spawn nproc threads and thrash. Pin to the cpu we bought.
    `OLLAMA_NUM_THREAD=${P.threads}`,
    `OMP_NUM_THREADS=${P.threads}`,
    `OLLAMA_CONTEXT_LENGTH=${P.ctx}`,
    `OLLAMA_MAX_LOADED_MODELS=${P.loaded}`,
    'OLLAMA_NUM_PARALLEL=1',
    'OLLAMA_KEEP_ALIVE=30m',
    'OLLAMA_FLASH_ATTENTION=1',
    'OLLAMA_KV_CACHE_TYPE=q8_0',
  ],
  // Image ENTRYPOINT is /bin/ollama and Flux only sets Cmd, so this is argv.
  commands: ['serve'],
  // Primary mount, no sync flag: node-local disk. Never r:/g:/s: here - the
  // model blobs are 10+ GB and syncthing would thrash.
  containerData: '/models',
  repoauth: '',
  cpu: P.cpu,
  ram: P.ram,
  hdd: P.hdd,
};

const boot = {
  name: 'boot',
  description: 'One-shot model puller, then idles',
  repotag: 'alpine:3.20',
  ports: [],
  containerPorts: [],
  domains: [],
  environmentParameters: [`MODELS=${P.models}`],
  // alpine has no ENTRYPOINT, so Cmd is the whole command line.
  commands: ['/bin/sh', '-c', bootCmd],
  containerData: '/tmp',
  repoauth: '',
  cpu: 0.1,
  ram: 100,
  hdd: 1,
};

// With more than one instance the UI's sqlite state has to be one dataset or a
// login/API key made on one node is invalid on the next. 'g:' is the masterSlave
// mount: exactly one instance runs the component, the rest hold synced copies
// stopped as hot standbys (advancedWorkflows.js:2513). It also earns a 20%
// discount on the Flux Home quote.
const WEBUI_MOUNT = INSTANCES > 1 ? 'g:/app/backend/data' : '/app/backend/data';

const gate = {
  name: 'gate',
  description: 'Bearer-token proxy in front of the OpenAI-compatible API',
  repotag: `${REGISTRY}/ownllm-gate:1.0.0`,
  ports: [PORT],
  containerPorts: [8080],
  domains: [''],
  environmentParameters: [
    `UPSTREAM=${ENGINE_URL}`,
    `API_KEY=${API_KEY}`,
    // The gate reports 503 until every one of these is pulled, so FDM keeps a
    // freshly-migrated instance out of rotation while it downloads.
    `MODELS=${P.models}`,
  ],
  commands: [],
  // Stateless: the shared key comes from the spec, so every instance answers
  // identically and the API scales horizontally.
  containerData: '/data',
  repoauth: '', // public image; set only if you publish the gate privately
  cpu: 0.5,
  ram: 500,
  hdd: 2,
};

const webui = {
  name: 'webui',
  description: 'Open WebUI - browser UI plus authenticated OpenAI-compatible API',
  repotag: 'ghcr.io/open-webui/open-webui:main',
  ports: [ENTERPRISE && !API_ONLY ? PORT + 1 : PORT],
  containerPorts: [8080],
  domains: [''],
  environmentParameters: [
    `OLLAMA_BASE_URL=${ENGINE_URL}`,
    'WEBUI_AUTH=true',
    'ENABLE_API_KEY=true',
    // Leave signup on for the first boot to create the admin account, then set
    // to false and push a spec update.
    'ENABLE_SIGNUP=true',
    'WEBUI_SECRET_KEY=<CHANGE_ME_RANDOM_64_HEX>',
    'ENABLE_OPENAI_API=false',
  ],
  commands: [],
  containerData: WEBUI_MOUNT,
  repoauth: '',
  cpu: 1,
  ram: 1500,
  hdd: 5,
};

const spec = {
  version: 8,
  name: APP,
  description: 'Self-hosted CPU LLM endpoint (Ollama + Open WebUI) on Flux',
  owner: OWNER,
  compose: API_ONLY
    ? [engine, boot, gate]
    : (ENTERPRISE ? [engine, boot, gate, webui] : [engine, boot, webui]),
  instances: INSTANCES,
  contacts: [],
  geolocation: [],
  expire: EXPIRE,
  nodes: [],
  staticip: false,
  datacenter: false,
  // A truthy value here means the compose is encrypted. The blob is produced by
  // Flux Home (see README); this generator emits the plaintext to feed it.
  enterprise: ENTERPRISE || API_ONLY ? '<PASTE_ENCRYPTED_BLOB>' : false,
};

// --- sanity checks against the rules in appValidator.js -------------------
const MAX = { cpu: 15, ram: 59000, hdd: 820 };
let tc = 0; let tr = 0; let th = 0;
spec.compose.forEach((c) => {
  if ((c.cpu * 10) % 1 !== 0 || c.cpu < 0.1) throw new Error(`${c.name}: cpu must be a multiple of 0.1`);
  if (c.ram % 100 !== 0 || c.ram < 100) throw new Error(`${c.name}: ram must be a multiple of 100`);
  if (c.hdd % 1 !== 0 || c.hdd < 1) throw new Error(`${c.name}: hdd must be a whole number of GB`);
  if (c.ports.length !== c.containerPorts.length || c.ports.length !== c.domains.length) {
    throw new Error(`${c.name}: ports/containerPorts/domains lengths must match`);
  }
  if (c.containerData.length < 2 || c.containerData.length > 200) throw new Error(`${c.name}: containerData length`);
  if (c.environmentParameters.length > 20) throw new Error(`${c.name}: max 20 env vars`);
  if (c.commands.length > 20) throw new Error(`${c.name}: max 20 commands`);
  c.commands.concat(c.environmentParameters).forEach((s) => {
    if (s.length > 400) throw new Error(`${c.name}: string over 400 chars: ${s.slice(0, 60)}...`);
  });
  if (!/^[a-zA-Z0-9]+$/.test(c.name)) throw new Error(`${c.name}: component names are alphanumeric only`);
  if (/^(flux|zel)/.test(c.name)) throw new Error(`${c.name}: must not start with flux/zel`);
  tc += c.cpu; tr += c.ram; th += c.hdd;
});
if (INSTANCES < 1 || INSTANCES > 100) {
  throw new Error(`instances must be 1-100 (appValidator.js:826); got ${INSTANCES}`);
}
if (tc > MAX.cpu || tr > MAX.ram || th > MAX.hdd) {
  throw new Error(`Over stratus capacity: ${tc} cpu / ${tr} MB / ${th} GB (max ${MAX.cpu}/${MAX.ram}/${MAX.hdd})`);
}

// The gate answers 503 until every model in ITS list is present, so if the two
// lists ever drift the app health-checks itself out of FDM's rotation forever.
const bootModels = boot.environmentParameters.find((e) => e.startsWith('MODELS='));
const gateModels = spec.compose.find((c) => c.name === 'gate')?.environmentParameters
  .find((e) => e.startsWith('MODELS='));
if (gateModels && bootModels !== gateModels) {
  throw new Error(`MODELS mismatch: puller has "${bootModels}", gate expects "${gateModels}"`);
}

// Models are pulled into the engine's volume; overflowing it fails the pull.
const wanted = P.models.split(/\s+/).filter(Boolean);
const known = wanted.filter((m) => MODEL_SIZES_GB[m]);
const needGb = known.reduce((a, m) => a + MODEL_SIZES_GB[m], 0);
if (needGb > engine.hdd * 0.85) {
  console.warn(`WARNING: ${wanted.join(' ')} needs ~${needGb.toFixed(1)} GB but engine.hdd is ${engine.hdd} GB.`);
  console.warn('         Raise hdd in the profile or the pull will fail part-way.');
}
// Only the largest `loaded` models are resident at once, plus ~1 GB for the
// server and the KV cache at this context length.
const residentGb = wanted
  .map((m) => MODEL_RAM_GB[m])
  .filter(Boolean)
  .sort((a, b) => b - a)
  .slice(0, P.loaded)
  .reduce((a, b) => a + b, 0);
if (residentGb && residentGb + 1 > engine.ram / 1000) {
  console.warn(`WARNING: ${P.loaded} resident model(s) need ~${(residentGb + 1).toFixed(0)} GB but engine.ram is ${engine.ram / 1000} GB.`);
  console.warn('         ram is a hard limit with 2 GB swap - the container will be OOM-killed, not slowed.');
}

const unknown = wanted.filter((m) => !MODEL_SIZES_GB[m]);
if (unknown.length) {
  console.warn(`NOTE: no size on file for ${unknown.join(', ')} - check it fits in ${engine.hdd} GB and RAM.`);
}

// --- consensus-enforced price (messageVerifier.js, chain price segment) ---
const CHAIN = { cpu: 0.03, ram: 0.01, hdd: 0.004, scope: 0.8, staticip: 0.4, minPrice: 0.01 };
let t = tc * CHAIN.cpu * 10 + (tr * CHAIN.ram) / 100 + th * CHAIN.hdd;
if (spec.enterprise || spec.nodes.length) t += CHAIN.scope;
if (spec.staticip) t += CHAIN.staticip;
let price = Math.ceil((t / 3) * 100) / 100;
const extra = spec.instances - 1;
if (extra > 0) {
  price = price < 0.5 && extra > 2
    ? price + extra * 0.5
    : (Math.ceil(price * extra * 100) + Math.ceil(price * 100)) / 100;
}
price = Math.ceil(price * (spec.expire / 88000) * 100) / 100;
if (price < CHAIN.minPrice) price = CHAIN.minPrice;

// The envelope must not carry the compose in cleartext: it holds API_KEY, and
// this is the file that gets committed. Emptying it also matches exactly what
// reaches the chain - registryManager.js:1946 does the same before broadcast.
const envelope = (ENTERPRISE || API_ONLY)
  ? { ...spec, contacts: [], compose: [] }
  : spec;

const suffix = API_ONLY ? `${PROFILE}-api` : (ENTERPRISE ? `${PROFILE}-enterprise` : PROFILE);
const out = path.join(__dirname, '..', 'specs', `${APP}-${suffix}.json`);
fs.writeFileSync(out, `${JSON.stringify(envelope, null, 2)}\n`);
console.log(`wrote ${out}`);

if (ENTERPRISE || API_ONLY) {
  // What goes INSIDE the encrypted blob, and the only file that holds API_KEY
  // in cleartext - .gitignore excludes it. tools/encrypt-enterprise.js reads it
  // and writes the resulting ciphertext into the envelope's "enterprise" field.
  const plaintext = { contacts: spec.contacts, compose: spec.compose };
  const ptOut = path.join(__dirname, '..', 'specs', `${APP}-${suffix}.plaintext.json`);
  fs.writeFileSync(ptOut, `${JSON.stringify(plaintext, null, 2)}\n`);
  console.log(`wrote ${ptOut}  (encrypt this into the "enterprise" field)`);
}

console.log(`  profile   ${PROFILE}${ENTERPRISE ? ' + enterprise gate' : ''}  ->  ${tc} cpu / ${tr} MB RAM / ${th} GB SSD, ${spec.instances} instance(s)`);
console.log(`  models    ${P.models}`);
console.log(`  engine    reachable in-app at ${ENGINE_URL}`);
if (API_ONLY) {
  console.log(`  published :${PORT} (authenticated API, no UI)`);
  console.log('  state     none - every instance identical, nothing to sync');
} else {
  console.log(`  published ${ENTERPRISE ? `:${PORT} (authenticated API)  :${PORT + 1} (Open WebUI)` : `:${PORT} (Open WebUI)`}`);
  console.log(`  webui     ${WEBUI_MOUNT}${INSTANCES > 1 ? '  <- masterSlave, one active instance' : ''}`);
}
if (ENTERPRISE || API_ONLY) {
  console.log(`  api key   ${API_KEY}`);
  console.log('            (stored only in the .plaintext.json, which .gitignore excludes)');
}
console.log(`  routing   https://${APP}.app.runonflux.io -> FDM, health-checked across ${spec.instances} instance(s)`);
console.log(`  expire    ${spec.expire} blocks (~${(spec.expire * 30 / 86400).toFixed(1)} days at 30s blocks)`);
console.log(`  fits on   ${tc <= 7 && tr <= 28000 ? 'NIMBUS and STRATUS' : 'STRATUS only'}`);
console.log(`  consensus price (resources counted): ${price.toFixed(2)} FLUX`);
if (ENTERPRISE || API_ONLY) {
  // registryManager.js:1946 empties compose before the message is broadcast, so
  // the on-chain payment check in messageVerifier.js:736 sees no resources at
  // all - only the enterprise scope surcharge. Verified against mainnet: all
  // 234 v8 enterprise apps carry compose: [] in their public specification.
  let entPrice = Math.ceil((CHAIN.scope / 3) * 100) / 100;
  const ex = spec.instances - 1;
  if (ex > 0) entPrice = (Math.ceil(entPrice * ex * 100) + Math.ceil(entPrice * 100)) / 100;
  entPrice = Math.ceil(entPrice * (spec.expire / 88000) * 100) / 100;
  console.log(`  consensus price (as actually broadcast): ${Math.max(entPrice, CHAIN.minPrice).toFixed(2)} FLUX`);
}
