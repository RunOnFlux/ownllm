#!/usr/bin/env node
/**
 * Pull the live Flux marketplace catalogue into finetune/data/marketplace.json.
 *
 * Why this exists: the fine-tune had been inventing marketplace specifications
 * from plausible-sounding memory, and they were wrong in ways that break a real
 * deployment. Palworld was trained as runonflux/palworld-server-flux at 4 cores
 * and 16 GB on one instance; the marketplace actually runs
 * thijsvanloef/palworld-server-docker at 2.5 cores and 6300 MB on THREE
 * instances with containerData "g:/palworld/Pal/Saved".
 *
 * That last part is the one that matters. Every game in the marketplace uses
 * the g: primary/standby flag so the save directory is replicated and the world
 * survives an instance migrating to a different node. A game deployed as a
 * single instance with a plain containerData path loses its world the first
 * time the network reschedules it.
 *
 *   node tools/fetch-marketplace.js [--out finetune/data/marketplace.json]
 */
const fs = require('node:fs');
const path = require('node:path');

// The authoritative catalogue, the one fluxcloud-web itself reads. An older
// endpoint at stats.runonflux.io/marketplace/listapps also answers, but it is a
// stale subset: it misses the whole NewGames category and carries a different
// Minecraft ladder.
const BASE = process.env.MARKETPLACE_API || 'https://api.marketplace.runonflux.io/api/v1/marketplace';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('out', path.join(__dirname, '..', 'finetune', 'data', 'marketplace.json'));

(async () => {
  const get = async (p) => {
    const r = await fetch(`${BASE}/${p}`, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error(`marketplace ${p}: HTTP ${r.status}`);
    return (await r.json()).data || [];
  };
  const [raw, cats] = await Promise.all([get('apps'), get('categories')]);
  if (!raw.length) throw new Error('marketplace API returned no apps');
  const catName = Object.fromEntries(cats.map((c) => [c.uuid, c.name]));
  // Disabled rows are historical, and a name repeats once per subscription term
  // (the same app at 1, 3, 6 and 12 months). Only enabled+visible rows are what
  // the marketplace is actually offering, and those are unique by name.
  const apps = raw.filter((a) => a.enabled && a.visible);

  // Keep only what a specification needs, so the file stays readable and a diff
  // shows a real change rather than a churned timestamp.
  const slim = apps.map((a) => ({
    name: a.name,
    displayName: a.displayName || a.name,
    category: catName[a.category] || a.category,
    description: a.description,
    priceUSD: a.price ?? a.priceUSD ?? null,
    multiplier: a.multiplier ?? null,
    instances: a.instances,
    lockedValues: a.lockedValues || [],
    expire: a.expire,
    geolocationOptions: (a.geolocationOptions || []).map((g) => (typeof g === 'string' ? g : g.value)),
    enabled: a.enabled,
    visible: a.visible,
    compose: (a.compose || []).map((c) => ({
      name: c.name,
      description: c.description,
      repotag: c.repotag,
      ports: c.ports || [],
      containerPorts: c.containerPorts || [],
      environmentParameters: c.environmentParameters || [],
      commands: c.commands || [],
      containerData: c.containerData,
      // the prompts the marketplace shows the user before deploying; without
      // these the model fills a spec that will not start
      userEnvironmentParameters: (c.userEnvironmentParameters || []).map((u) => ({
        name: u.name, description: u.description || '', placeholder: u.placeholder || '', optional: !!u.optional,
      })),
      cpu: c.cpu,
      ram: c.ram,
      hdd: c.hdd,
    })),
  })).filter((a) => a.compose.length).sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(slim, null, 1)}\n`);

  const sync = slim.flatMap((a) => a.compose.filter((c) => /^[a-z]+:/.test(c.containerData)).map((c) => `${a.name}/${c.name} ${c.containerData}`));
  const byCat = {};
  for (const a of slim) byCat[a.category] = (byCat[a.category] || 0) + 1;
  console.log(`${slim.length} enabled and visible apps -> ${OUT}`);
  console.log(Object.entries(byCat).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`${sync.length} components carry a sync flag:`);
  for (const s of sync) console.log(`  ${s}`);
})();
