/**
 * Live network facts, fetched from the Flux API and injected as context.
 *
 * The corpus is a snapshot baked into an image, so it can describe how the
 * network works but never what it is doing right now. "How many nodes are
 * there" has an answer that changes hourly, and a documentation bot that
 * confidently quotes a number from build time is worse than one that admits it
 * does not know.
 *
 * Intent is matched on keywords rather than given to the model as tools. Tool
 * calling costs an extra round trip through the model, and at 5 tok/s on a slow
 * CPU node that is ten seconds spent deciding to make a call that a regular
 * expression can decide instantly and more reliably.
 */
const API = process.env.FLUX_API || 'https://api.runonflux.io';
const TTL_MS = Number(process.env.LIVE_TTL_MS || 120000);

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

const INTENTS = [
  {
    name: 'node count',
    test: q => /\b(how many|number of|count of|total)\b[\s\S]*\bnodes?\b/i.test(q)
      || /\bnetwork (size|capacity)\b/i.test(q),
    async run() {
      const c = await get('daemon/getzelnodecount');
      return `The Flux network currently has ${c.total.toLocaleString()} nodes: `
        + `${(c['basic-enabled'] ?? c.basic ?? 0).toLocaleString()} cumulus, `
        + `${(c['super-enabled'] ?? c.super ?? 0).toLocaleString()} nimbus, `
        + `${(c['bamf-enabled'] ?? c.bamf ?? 0).toLocaleString()} stratus.`;
    },
  },
  {
    name: 'chain height',
    test: q => /\b(block height|current block|chain height|latest block)\b/i.test(q),
    async run() {
      const i = await get('daemon/getinfo');
      return `The Flux chain is at block ${i.blocks.toLocaleString()} (daemon version ${i.version}).`;
    },
  },
  {
    name: 'named application',
    // "is X running", "where is X deployed", "status of app X"
    test: q => /\b(app|application)\b/i.test(q) && /\b(running|deployed|instances?|status|where)\b/i.test(q),
    async run(q) {
      const m = q.match(/\b(?:app|application)\s+(?:called\s+|named\s+)?["']?([a-zA-Z0-9-]{3,63})["']?/i);
      if (!m) return null;
      const name = m[1];
      const locations = await get(`apps/location/${name}`).catch(() => []);
      if (!locations.length) return `The application "${name}" has no running instances on the network right now.`;
      return `The application "${name}" is running on ${locations.length} instance(s): `
        + `${locations.map(l => l.ip.split(':')[0]).join(', ')}.`;
    },
  },
];

/**
 * Returns a block of live facts for the prompt, or '' when the question is not
 * about live state. Failures return '' rather than throwing: a documentation
 * answer is still worth giving when the API is unreachable.
 */
async function liveContext(question) {
  const out = [];
  for (const intent of INTENTS) {
    if (!intent.test(question)) continue;
    try {
      const line = await intent.run(question);
      if (line) out.push(line);
    } catch (err) {
      console.log(`live lookup "${intent.name}" failed: ${err.message}`);
    }
  }
  return out.length ? out.join('\n') : '';
}

module.exports = { liveContext };
