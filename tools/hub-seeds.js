#!/usr/bin/env node
/**
 * Print FluxOS API endpoints (ip:port) of nodes currently running the given
 * apps, for the hub's --seeds. One hub instance landed on a node whose
 * containers cannot resolve api.runonflux.io at all; every Flux node answers
 * /apps/location on its own API port, by IP, so a handful of them seeded into
 * FLUX_API lets that instance discover the pools anyway. Instances move, but
 * the list only has to contain one that still exists.
 *
 *   node tools/hub-seeds.js ownllmpoolsmall ownllmpoolmid ownllmpoolgptoss [--max 12]
 */
const args = process.argv.slice(2);
const mi = args.indexOf('--max');
const MAX = mi >= 0 ? Number(args.splice(mi, 2)[1]) : 12;
const apps = args.filter(a => !a.startsWith('--'));
if (!apps.length) { console.error('usage: node tools/hub-seeds.js <app> [<app>...] [--max N]'); process.exit(1); }
(async () => {
  const seen = new Set();
  for (const app of apps) {
    const res = await fetch(`https://api.runonflux.io/apps/location/${app}`, { signal: AbortSignal.timeout(20000) });
    const { data = [] } = await res.json();
    for (const i of data) seen.add(i.ip.includes(':') ? i.ip : `${i.ip}:16127`);
  }
  const list = [...seen].sort(() => Math.random() - 0.5).slice(0, MAX).map(e => `http://${e}`);
  console.log(list.join(','));
})().catch(err => { console.error(err.message); process.exit(1); });
