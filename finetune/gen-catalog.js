#!/usr/bin/env node
/**
 * What actually runs on Flux, from the live global app catalog.
 *
 * Aggregates the 1,500+ registered app specifications into a facts sheet
 * (catalog-facts.md): how many apps, which images are most common, and the
 * typical size (median cores, RAM, storage, instances) per image family, so
 * the assistant sizes a "Minecraft server" or a "Palworld server" the way
 * people on the network actually do rather than by guesswork. Also writes
 * sizing.json, which gen-deploy.js can use as its presets' defaults.
 *
 * Nothing per-owner or per-app-name is kept: this is aggregate knowledge.
 *
 *   node finetune/gen-catalog.js [--src finetune/data/sources/catalog.json]
 */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const SRC = opt('src', path.join(__dirname, 'data', 'sources', 'catalog.json'));
const D = path.join(__dirname, 'data');
const apps = JSON.parse(fs.readFileSync(SRC, 'utf8')).data;
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const fam = new Map();
for (const app of apps) {
  for (const c of app.compose || []) {
    const image = (c.repotag || '').split(':')[0].replace(/^docker\.io\//, '');
    if (!image) continue;
    if (!fam.has(image)) fam.set(image, { image, n: 0, cpu: [], ram: [], hdd: [], inst: [], ports: new Map(), multi: 0 });
    const f = fam.get(image); f.n += 1; f.cpu.push(c.cpu); f.ram.push(c.ram); f.hdd.push(c.hdd); f.inst.push(app.instances);
    for (const p of c.containerPorts || []) f.ports.set(p, (f.ports.get(p) || 0) + 1);
    if ((app.compose || []).length > 1) f.multi += 1;
  }
}
const families = [...fam.values()].filter((f) => f.n >= 3).sort((a, b) => b.n - a.n);
const nComp = apps.reduce((t, a) => t + (a.compose || []).length, 0);
const instDist = {};
for (const a of apps) instDist[a.instances] = (instDist[a.instances] || 0) + 1;
const geo = apps.filter((a) => (a.geolocation || []).length).length;
let md = '# What runs on Flux (aggregate of the live application catalog)\n\n'
  + `The Flux network currently hosts about ${apps.length} registered applications with ${nComp} containers in total. `
  + `Most apps run ${median(apps.map((a) => a.instances))} instances (${Object.entries(instDist).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${v} apps with ${k}`).join(', ')}); ${geo} pin a geolocation. `
  + `${apps.filter((a) => a.enterprise).length} are enterprise apps with encrypted specifications.\n\n`
  + '## Most common images and their typical sizes <https://cloud.runonflux.com/apps/globalapps>\n'
  + 'Typical means the median of what people deploy; a single instance can be smaller or larger.\n';
for (const f of families.slice(0, 40)) {
  const ports = [...f.ports.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p).join(', ');
  md += `- ${f.image}: ${f.n} deployments; typically ${median(f.cpu)} cores, ${median(f.ram)} MB RAM, ${median(f.hdd)} GB storage, ${median(f.inst)} instances${ports ? `, container port ${ports}` : ''}${f.multi > f.n / 2 ? ' (usually part of a multi-component app)' : ''}.\n`;
}
fs.writeFileSync(path.join(D, 'catalog-facts.md'), md);
const sizing = Object.fromEntries(families.map((f) => [f.image, { deployments: f.n, cpu: median(f.cpu), ram: median(f.ram), hdd: median(f.hdd), instances: median(f.inst), ports: [...f.ports.keys()].slice(0, 3) }]));
fs.writeFileSync(path.join(D, 'sizing.json'), JSON.stringify(sizing, null, 1));
console.log(`${apps.length} apps, ${families.length} image families with >=3 deployments -> catalog-facts.md (${md.length} chars), sizing.json`);
console.log(families.slice(0, 8).map((f) => `${f.image} n=${f.n} ${median(f.cpu)}c/${median(f.ram)}MB/${median(f.hdd)}GB x${median(f.inst)}`).join('\n'));
