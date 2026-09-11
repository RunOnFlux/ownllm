/**
 * Live network facts, fetched from the Flux API and injected as context.
 *
 * The corpus is a snapshot baked into an image, so it describes how the network
 * works but never what it is doing. "How many nodes are there" changes hourly,
 * and confidently quoting a build-time number is worse than not answering.
 *
 * WHICH lookup to run is decided semantically, not by keyword. Each tool has a
 * description, those descriptions are embedded once at boot, and a question is
 * matched against them by cosine similarity - reusing the embedding already
 * computed for retrieval, so the routing decision costs nothing measurable.
 *
 * The alternative was giving the model tools and letting it choose. That is
 * more general, and it costs an extra pass through the model: on the slowest
 * node measured, ten seconds spent deciding to make a call that takes fifty
 * milliseconds. Semantic routing gets most of the generality for none of the
 * latency.
 */
const API = process.env.FLUX_API || 'https://api.runonflux.io';
const TTL_MS = Number(process.env.LIVE_TTL_MS || 120000);
const THRESHOLD = Number(process.env.LIVE_THRESHOLD || 0.55);

const cache = new Map();
async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const res = await fetch(`${API}/${path}`, { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(body.data?.message || 'api error');
  cache.set(path, { at: Date.now(), data: body.data });
  return body.data;
}

// An app name is taken from "app called X", "application named X", a quoted
// token, or a bare "app X" - but the bare form only for a token that cannot be
// ordinary English. "how much RAM can an application use" used to yield "use",
// which then produced a confident "No application named \"use\"" line in the
// prompt. Bare names must be 6+ characters and not a common word.
const COMMON = new Set(['should', 'would', 'could', 'running', 'deployed', 'deploy', 'instances', 'instance',
  'specification', 'specifications', 'registered', 'expire', 'expires', 'require', 'requires', 'update', 'updated',
  'called', 'consists', 'consist', 'contain', 'contains', 'support', 'supports', 'without', 'network', 'storage']);
const appName = (q) => {
  const explicit = q.match(/\b(?:app|application)\s+(?:called|named)\s+["']?([a-zA-Z0-9-]{3,63})["']?/i)
    || q.match(/["']([a-zA-Z0-9-]{3,63})["']/);
  if (explicit) return explicit[1];
  const bare = q.match(/\b(?:app|application)\s+([a-zA-Z0-9-]{6,63})\b/i);
  if (bare && !COMMON.has(bare[1].toLowerCase())) return bare[1];
  return undefined;
};

/**
 * Tools. `describe` is what gets embedded, so it should read like the questions
 * a user would actually ask, not like an endpoint name.
 */
const TOOLS = [
  {
    name: 'node-count',
    describe: 'how many nodes are on the flux network right now, node count, network size, '
      + 'how many cumulus nimbus stratus nodes, total nodes online',
    async run() {
      const c = await get('daemon/getzelnodecount');
      return `Flux currently has ${c.total.toLocaleString()} nodes online: `
        + `${(c['basic-enabled'] ?? 0).toLocaleString()} cumulus, `
        + `${(c['super-enabled'] ?? 0).toLocaleString()} nimbus, `
        + `${(c['bamf-enabled'] ?? 0).toLocaleString()} stratus.`;
    },
  },
  {
    name: 'chain-height',
    describe: 'current block height of the flux blockchain, latest block, how far has the chain synced, daemon version',
    async run() {
      const i = await get('daemon/getinfo');
      return `The Flux chain is at block ${i.blocks.toLocaleString()}, daemon version ${i.version}, ${i.connections} peer connections.`;
    },
  },
  {
    name: 'app-status',
    describe: 'is a particular application running, where is my app deployed, which nodes host an app, '
      + 'app instances, is my deployment live, status of an application',
    async run(q) {
      const name = appName(q);
      if (!name) return null;
      // Not registered at all is most likely a mis-extracted name; say nothing
      // rather than assert an absence the model would then repeat.
      const spec = await get(`apps/appspecifications/${name}`).catch(() => null);
      if (!spec || !spec.name) return null;
      const loc = await get(`apps/location/${name}`).catch(() => []);
      if (!loc.length) return `The application "${name}" is registered but has no running instances right now.`;
      return `"${name}" is running on ${loc.length} instance(s): ${loc.map(l => l.ip.split(':')[0]).join(', ')}.`;
    },
  },
  {
    name: 'app-spec',
    describe: 'how much cpu ram storage does an application use, resources of an app, specification of a deployed app, '
      + 'how many instances is an app configured for, when does an app expire',
    async run(q) {
      const name = appName(q);
      if (!name) return null;
      const a = await get(`apps/appspecifications/${name}`).catch(() => null);
      if (!a || !a.name) return null;
      const totals = (a.compose || []).reduce((t, c) => ({
        cpu: Math.round((t.cpu + c.cpu) * 10) / 10, ram: t.ram + c.ram, hdd: t.hdd + c.hdd,
      }), { cpu: 0, ram: 0, hdd: 0 });
      const encrypted = a.enterprise ? ' Its specification is encrypted, so component details are not public.' : '';
      return `"${a.name}" is registered for ${a.instances} instance(s), expiring after ${a.expire?.toLocaleString()} blocks`
        + `${totals.cpu ? `, using ${totals.cpu} cores, ${totals.ram} MB RAM and ${totals.hdd} GB storage` : ''}.${encrypted}`;
    },
  },
  {
    name: 'network-apps',
    describe: 'how many applications are deployed on flux, total apps running on the network, how many apps are there',
    async run() {
      const all = await get('apps/globalappsspecifications');
      const enterprise = all.filter(a => a.enterprise).length;
      return `There are ${all.length.toLocaleString()} applications registered on Flux, ${enterprise.toLocaleString()} of them enterprise (encrypted specifications).`;
    },
  },
];

let toolVecs = null;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));

/** Embeds the tool descriptions once, using the same embedder as retrieval. */
async function initTools(embed) {
  const vecs = await embed(TOOLS.map(t => t.describe));
  toolVecs = vecs.map(v => ({ vec: v, mag: norm(v) }));
  console.log(`live lookups ready: ${TOOLS.map(t => t.name).join(', ')}`);
}

/**
 * Picks a tool by meaning and runs it. Returns '' when nothing matches, or when
 * the lookup fails - a documentation answer is still worth giving when the API
 * is unreachable.
 */
async function liveContext(question, qvec) {
  if (!toolVecs || !qvec) return '';
  const qm = norm(qvec);
  let best = -1;
  let bestScore = 0;
  toolVecs.forEach((t, i) => {
    const score = dot(qvec, t.vec) / (qm * t.mag || 1);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  if (best < 0 || bestScore < THRESHOLD) return '';
  try {
    const line = await TOOLS[best].run(question);
    if (line) console.log(`live lookup ${TOOLS[best].name} (similarity ${bestScore.toFixed(2)})`);
    return line || '';
  } catch (err) {
    console.log(`live lookup ${TOOLS[best].name} failed: ${err.message}`);
    return '';
  }
}

module.exports = { liveContext, initTools, TOOLS };
