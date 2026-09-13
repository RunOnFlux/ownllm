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
// Read from images/gate/VERSION, the same file CI tags the image with, so a
// generated spec can never point at a version that was never published.
const GATE_VERSION = fs.readFileSync(path.join(__dirname, '..', 'images', 'gate', 'VERSION'), 'utf8').trim();
/**
 * The real key only ever lands in the .plaintext.json (gitignored) that feeds
 * the encrypter - never in the envelope that goes on chain.
 *
 * An existing key is REUSED. Minting a new one on every run silently
 * desynchronises the files from an app that is already deployed: the running
 * instances keep the key they were built with, and every request signed with
 * the newly generated one comes back 401 with nothing to explain why. Pass
 * --rotate-key to deliberately mint a new one, and redeploy after you do.
 */
function existingApiKey(specsDir, basename) {
  try {
    const prior = JSON.parse(fs.readFileSync(path.join(specsDir, `${basename}.plaintext.json`), 'utf8'));
    for (const component of prior.compose || []) {
      const entry = (component.environmentParameters || []).find(e => e.startsWith('API_KEY='));
      if (entry) return entry.slice('API_KEY='.length);
    }
  } catch {
    // no prior spec, or it predates the gate - fall through and mint one
  }
  return null;
}
// API-only: drop the UI entirely. Every instance becomes stateless and
// identical, which is what makes horizontal scaling and node migration a
// non-event - there is no dataset to keep in sync.
const API_ONLY = argv.includes('--api-only');
const ALLOWED_ORIGINS = arg('allowed-origins', '*');
if (`ALLOWED_ORIGINS=${ALLOWED_ORIGINS}`.length > 400) throw new Error('--allowed-origins exceeds the 400-char env limit');
// Adds the grounded docs bot alongside the raw model API, on the next port.
const DOCSBOT = argv.includes('--docsbot');
// The router is a standalone app in front of the bot, not a component of it.
const ROUTER_ONLY = argv.includes('--router');

// Flux rules enforced in appValidator.js: app name is alphanumeric + inner
// hyphens, max 63, and must not start with "flux" or "zel".
if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(APP) || APP.length > 63) {
  throw new Error(`Invalid app name "${APP}"`);
}
if (/^(flux|zel)/i.test(APP)) throw new Error('App name must not start with flux/zel');

/**
 * Thread count for a given core allocation.
 *
 * Measured on granite4:tiny-h, sweeping num_thread on one node:
 *   threads   2     4     6     8    10    12
 *   gen    21.8  25.4  26.5  27.2  26.6  24.0  tok/s
 *   prefill  69   123   167   193   169   162  tok/s
 *
 * Both peak at 8 and fall away after: past that, synchronisation costs more
 * than the extra parallelism returns. Never hand ollama more threads than
 * that, however many cores the app is allocated - 12 threads measured 19%
 * slower at prefill than 8.
 */
const THREAD_PEAK = 8;
const threadsFor = cpu => Math.max(1, Math.min(THREAD_PEAK, Math.round(cpu)));

const PROFILES = {
  // The router is a proxy that holds no model and no index; it needs enough to
  // hold open a few streaming connections and nothing more. Deployed as its own
  // app so it can scale and be replaced independently of the bot.
  router: { cpu: 0.5, ram: 500, hdd: 1, threads: 1, loaded: 1, ctx: 2048, models: '' },
  small: { cpu: 4, ram: 8000, hdd: 20, threads: 4, models: 'qwen3:4b', loaded: 1, ctx: 16384 },
  // Sized to fit a NIMBUS node too: nimbus offers 7.0 cores / 28000 MB to apps,
  // so the whole app must stay under that. Triples the pool of eligible hosts.
  nimbus: { cpu: 5.5, ram: 24000, hdd: 50, threads: 5, models: 'gpt-oss:20b', loaded: 1, ctx: 16384 },
  // Many-cheap-replicas shape. Generation is memory-bandwidth bound, so 4 cores
  // gives up little on tokens/sec versus 8 - it is prefill that suffers. Buys a
  // far better model than 'small' for a small extra cost, and still fits NIMBUS.
  wide: { cpu: 4, ram: 16000, hdd: 25, threads: 4, models: 'gpt-oss:20b', loaded: 1, ctx: 8192 },
  // Measured on a stratus node, 12.6 app cores: 14.3 tok/s generation and
  // 184.6 tok/s prefill, against 5.9/53.5 for gpt-oss:20b on the same machine.
  // ~1B active params and hybrid-Mamba layers, so it is neither bandwidth nor
  // KV-cache bound the way the dense and MoE transformers are.
  granite: { cpu: 6.4, ram: 8000, hdd: 15, threads: 6, models: 'granite4:tiny-h', loaded: 1, ctx: 16384 },
  // Docs bot: chat model AND embedding model must both stay resident. With
  // loaded: 1 they evict each other on every single query - embed the question,
  // which unloads the chat model, then generate, which unloads the embedder -
  // paying a multi-GB reload twice per request. ram covers both plus runtime.
  // Two models, chosen on measured strengths rather than one compromise:
  // granite4:tiny-h answers documentation questions (153 tok/s prefill, 1.8x
  // gemma3:4b, identical 7/9 grounding score) and gemma3:4b writes the prose
  // (it was the only model that obeyed "no hashtags" and did not leak a
  // "Here is a possible..." preamble). Plus the embedder. loaded: 3 keeps all
  // three in RAM so no request ever pays a reload.
  staff: {
    cpu: 12.0, ram: 28000, hdd: 40, threads: 8, parallel: 3, loaded: 3, ctx: 16384,
    models: 'granite4:tiny-h gemma3:4b granite-embedding:278m',
  },
  // Sized with headroom rather than to the minimum. Flux capacity is cheap and
  // the failure modes of being tight are expensive: a 500 MB docsbot was
  // OOM-killed at 86% indexed after two hours, and would have repeated that
  // forever. 8 engine cores also takes the measured thread peak (8 threads gave
  // 205 tok/s prefill against 174 at 6), which costs the NIMBUS placement pool
  // but buys real speed on a corpus this size.
  docsbot: {
    cpu: 12.0, ram: 24000, hdd: 60, threads: 8, parallel: 3,
    models: 'granite4:tiny-h granite-embedding:278m', loaded: 2, ctx: 16384,
  },
  // Research rig for research/cpu-native-models.md: the ternary engine image
  // (bitnet.cpp, BitNet-b1.58-2B-4T + bitnet-embedding-270m, weights baked in)
  // in place of ollama. ram is sized from the model card's 0.4 GB non-embedding
  // memory plus a 4k context and the embedder, with the same headroom rule as
  // docsbot; hdd is small because nothing is pulled. ctx is 4096 because that
  // is the model's trained maximum - the docs bot's TOP_K/PINNED_DOCS must fit.
  // ram: 6,000 was OOM-killed five minutes into indexing (two llama-servers'
  // compute buffers on top of 1.6 GB of weights); 12,000 leaves the headroom
  // the docsbot profile has, and under enterprise pricing it costs nothing.
  ternary: {
    engine: 'ternary', cpu: 8, ram: 12000, hdd: 5, threads: 8, parallel: 1, loaded: 2, ctx: 4096,
    models: 'bitnet-2b-4t bitnet-embedding-270m',
  },
  standard: { cpu: 8, ram: 26000, hdd: 60, threads: 8, models: 'gpt-oss:20b qwen3:4b', loaded: 2, ctx: 16384 },
  big: { cpu: 12, ram: 40000, hdd: 80, threads: 8, models: 'gpt-oss:20b qwen3-coder:30b qwen3:4b', loaded: 2, ctx: 32768 },
};
const P = PROFILES[PROFILE];
if (!P) throw new Error(`Unknown profile ${PROFILE}. Use: ${Object.keys(PROFILES).join(', ')}`);

// Nothing about the model list is baked into the images: it is the MODELS
// environment parameter, read by the puller and by the gate's readiness check.
// --models overrides the profile default; sizes are only used for the disk
// warning below.
if (arg('models', null)) P.models = arg('models', null).trim();
if (P.engine === 'ternary' && arg('engine', '') === 'tq2' && !arg('models', null)) P.models = 'bitnet-2b-4t-tq2 granite-embedding:278m';

// --cpu overrides the engine's core count. It also moves OLLAMA_NUM_THREAD and
// OMP_NUM_THREADS with it: NanoCPUs is a cgroup quota, so the container still
// sees every host core and would spawn nproc threads that then fight over the
// quota. The two must never drift apart, which is why one flag sets both.
// ram/hdd overrides: a model swap changes the resident set and the blob store
// independently of the profile's core count.
if (arg('ram', null)) P.ram = Number(arg('ram', null));
if (arg('hdd', null)) P.hdd = Number(arg('hdd', null));
if (arg('cpu', null)) {
  P.cpu = Number(arg('cpu', null));
  P.threads = threadsFor(P.cpu);
}

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
    // Cores beyond the 8-thread peak do not speed up one request - measured,
    // 12 threads was 19% slower than 8 - but they do let separate requests run
    // at the same time instead of queueing. That is what the extra cores buy.
    // One slot, not three. Parallel slots divide the context window between
    // them, and this bot sends 3,000+ token prompts - concurrency it does not
    // need was costing context it does.
    'OLLAMA_NUM_PARALLEL=1',
    // -1 never unloads. A reload costs a multi-GB read from the volume, which
    // on a cold node is minutes; there is nothing else competing for this RAM.
    'OLLAMA_KEEP_ALIVE=-1',
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

// The ternary research engine is a different image with a different process
// model: llama-server behind an ollama-compatible shim, weights baked in. Same
// component name and port, so the gate and the docs bot need no change.
const TERNARY = P.engine === 'ternary';
// --engine tq2 swaps the research engine for round two's image: the same
// BitNet weights as TQ2_0 on stock llama.cpp, with the production granite
// embedder so the docs bot's precomputed vectors apply (no re-index).
const TQ2 = TERNARY && arg('engine', '') === 'tq2';
if (TERNARY) {
  engine.description = TQ2
    ? 'Ternary engine, round two: BitNet TQ2_0 on stock llama.cpp + granite embedder, ollama-compatible (internal only)'
    : 'Ternary (1.58-bit) engine: bitnet.cpp llama-server, ollama-compatible (internal only)';
  engine.repotag = `${REGISTRY}/ownllm-ternary${TQ2 ? '-tq2' : ''}:${GATE_VERSION}`;
  engine.environmentParameters = [
    'PORT=11434',
    `THREADS=${P.threads}`,
    `CTX=${P.ctx}`,
  ];
  engine.commands = [];
  // Nothing is written here; a mount is required by the spec, so the smallest.
  engine.containerData = '/data';
}

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

const SPECS_DIR = path.join(__dirname, '..', 'specs');
const KEY_BASENAME = `${APP}-${API_ONLY ? `${PROFILE}-api` : `${PROFILE}-enterprise`}`;
const ROTATE = argv.includes('--rotate-key');
const REUSED = !ROTATE && !arg('api-key', null) && !process.env.OWNLLM_API_KEY
  ? existingApiKey(SPECS_DIR, KEY_BASENAME)
  : null;
const API_KEY = arg('api-key', process.env.OWNLLM_API_KEY || REUSED || crypto.randomBytes(32).toString('base64url'));

const gate = {
  name: 'gate',
  description: 'Bearer-token proxy in front of the OpenAI-compatible API',
  repotag: `${REGISTRY}/ownllm-gate:${GATE_VERSION}`,
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

const router = {
  name: 'router',
  description: 'Load-aware router: sends each request to the least busy instance',
  repotag: `${REGISTRY}/ownllm-router:${GATE_VERSION}`,
  ports: [PORT],
  containerPorts: [8080],
  domains: [''],
  environmentParameters: [
    `ALLOWED_ORIGINS=${ALLOWED_ORIGINS}`,
    `TARGET_APP=${arg('target', 'ownllmdocs')}`,
    `TARGET_PORT=${arg('target-port', '33001')}`,
    'FLUX_API=https://api.runonflux.io',
    'DISCOVER_MS=60000',
    'PROBE_MS=20000',
  ],
  commands: [],
  containerData: '/tmp',
  repoauth: '',
  cpu: 0.5,
  ram: 500,
  hdd: 1,
};

const docsbot = {
  name: 'docsbot',
  description: 'Grounded documentation bot: retrieval over baked-in docs, with citations',
  repotag: `${REGISTRY}/ownllm-docsbot:${GATE_VERSION}`,
  ports: [PORT + 1],
  containerPorts: [8080],
  domains: [''],
  environmentParameters: [
    `UPSTREAM=${ENGINE_URL}`,
    `API_KEY=${API_KEY}`,
    `CHAT_MODEL=${TERNARY ? (TQ2 ? 'bitnet-2b-4t-tq2' : 'bitnet-2b-4t') : 'granite4:tiny-h'}`,
    `EMBED_MODEL=${TERNARY && !TQ2 ? 'bitnet-embedding-270m' : 'granite-embedding:278m'}`,
    // Always in front of the retrieved chunks, so the prompt prefix is
    // identical between requests and the KV cache covers it.
    // flux-facts.md first: it is generated from config/default.js, so unlike a
    // hand-written page it cannot drift from the code it describes, and it
    // states derived values (1,056,000 blocks is 12 months) that the model
    // cannot reliably compute for itself.
    // Only the generated sheet. app-spec-v8.md is hand-written and covers the
    // same ground, so pinning both put ~470 redundant tokens in front of every
    // prompt - on a slow node that is seven seconds of prefill for nothing.
    'PINNED_DOCS=flux-facts.md',
    // Fewer, because prefill dominates. Six chunks is ~1,800 tokens; on the
    // slowest node measured that is 25 seconds before a word is generated.
    'TOP_K=4',
    // Public mode: the widget runs on your website, where any key would be
    // readable in page source. /ask is open and rate limited per IP; the model
    // API on the gate still requires the key.
    'PUBLIC_ASK=true',
    'RATE_PER_MIN=6',
    // Hostnames the widget may be embedded on; * for a rig, real sites for
    // production. Enforced by the router (what browsers talk to) and here.
    `ALLOWED_ORIGINS=${ALLOWED_ORIGINS}`,
    // Live network lookups. The corpus is a snapshot, so node counts and app
    // status come from the API instead of from build-time text.
    'FLUX_API=https://api.runonflux.io',
    'LIVE_TTL_MS=120000',
  ],
  commands: [],
  // The index lives in memory, rebuilt at boot from documents baked into the
  // image. Nothing to persist, so this mount is only here because Flux
  // requires one.
  containerData: '/tmp',
  repoauth: '',
  cpu: 0.3,
  // The index lives in memory: 26,879 chunks x 768 dimensions is ~83 MB of
  // vectors alone, plus BM25 term maps, chunk text and V8 heap overhead. At
  // 500 MB the container was OOM-killed at 86% indexed, losing two hours of
  // embedding and starting over - forever, since it never reached the end.
  ram: 4000,
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
    // WEBUI_SECRET_KEY is deliberately absent: Open WebUI generates one on
    // first boot and persists it in its data dir. Setting it here would put a
    // session-signing secret into a non-enterprise spec, which is public on
    // chain - anyone could forge a session.
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
  compose: ROUTER_ONLY
    ? [router]
    : API_ONLY
    ? (DOCSBOT ? [engine, boot, gate, docsbot] : [engine, boot, gate]).filter(c => !(TERNARY && c === boot))
    : (ENTERPRISE ? [engine, boot, gate, webui] : [engine, boot, webui]).filter(c => !(TERNARY && c === boot)),
  instances: INSTANCES,
  contacts: [],
  geolocation: [],
  expire: EXPIRE,
  nodes: [],
  staticip: false,
  datacenter: false,
  // A truthy value here means the compose is encrypted. The blob is produced by
  // Flux Home (see README); this generator emits the plaintext to feed it.
  // The router holds no secret - it proxies a public endpoint - so it needs no
  // encrypted specification and can be a plain application.
  enterprise: ROUTER_ONLY ? false : (ENTERPRISE || API_ONLY || DOCSBOT ? '<PASTE_ENCRYPTED_BLOB>' : false),
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
  // Floating point: 0.5 + 6.0 + 0.3 + 0.1 lands on 6.899999999999999. Flux
  // validates cpu in units of 0.1, so work in tenths and convert back.
  tc = Math.round((tc + c.cpu) * 10) / 10; tr += c.ram; th += c.hdd;
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
const out = path.join(__dirname, '..', 'specs', (ENTERPRISE || API_ONLY)
  ? `${APP}-${suffix}.register.json`
  : `${APP}-${suffix}.json`);
fs.writeFileSync(out, `${JSON.stringify(envelope, null, 2)}\n`);
console.log(`wrote ${out}${(ENTERPRISE || API_ONLY) ? '  (tools/register.js only - compose is empty, the UI will reject it)' : ''}`);

// For deploying through Flux Home rather than tools/register.js: the UI wants
// the compose in cleartext and does the encrypting itself when you turn on the
// enterprise toggle. Same secret exposure as the plaintext file, so gitignored.
if (ENTERPRISE || API_ONLY) {
  const uiSpec = { ...spec, enterprise: false };
  const uiOut = path.join(__dirname, '..', 'specs', `${APP}-${suffix}.ui.json`);
  fs.writeFileSync(uiOut, `${JSON.stringify(uiSpec, null, 2)}\n`);
  console.log(`wrote ${uiOut}\n        ^ THIS is the file to import into Flux Home. Turn ON the enterprise toggle.`);
}

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
  console.log(`  published :${PORT} (authenticated model API)${DOCSBOT ? `  :${PORT + 1} (grounded docs bot)` : ''}`);
  console.log('  state     none - every instance identical, nothing to sync');
} else {
  console.log(`  published ${ENTERPRISE ? `:${PORT} (authenticated API)  :${PORT + 1} (Open WebUI)` : `:${PORT} (Open WebUI)`}`);
  console.log(`  webui     ${WEBUI_MOUNT}${INSTANCES > 1 ? '  <- masterSlave, one active instance' : ''}`);
}
if (ENTERPRISE || API_ONLY) {
  console.log(`  api key   ${API_KEY}`);
  console.log(`            ${REUSED ? 'reused from the existing spec - deployed instances keep working' : 'NEWLY MINTED - anything already deployed still uses its old key'}`);
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
