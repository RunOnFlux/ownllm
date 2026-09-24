#!/usr/bin/env node
/**
 * marketplace-facts.md from the authoritative catalogue.
 *
 * The previous sheet came from stats.runonflux.io/marketplace/listapps, a stale
 * subset that misses the whole NewGames category and carries a different
 * Minecraft ladder. It listed "data path g:/data" without ever saying what g:
 * means, so a reader, human or model, could see the flag and not know it is the
 * thing that keeps a game world alive when an instance moves node.
 *
 * Reads finetune/data/marketplace.json (tools/fetch-marketplace.js, from
 * api.marketplace.runonflux.io) and writes the facts-tier sheet the docs bot
 * ranks highest. Deterministic: the same catalogue produces the same file.
 *
 *   node finetune/gen-marketplace-facts.js [--out images/docsbot/docs/marketplace-facts.md]
 */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : path.join(__dirname, '..', 'images', 'docsbot', 'docs', 'marketplace-facts.md');
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'marketplace.json'), 'utf8'));

const FLAG = {
  g: 'primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline',
  r: 'replicated across all instances, which all run',
  s: 'set up as a Syncthing folder',
};
const flagOf = (cd) => (/^([rgs]+):/.exec(cd || '') || [])[1] || '';
const fmtRam = (mb) => (mb >= 1000 && mb % 1000 === 0 ? `${mb / 1000} GB` : `${mb} MB`);

const lines = [];
lines.push('# Flux Marketplace apps (from the live marketplace catalogue)');
lines.push('');
lines.push('Generated from api.marketplace.runonflux.io. Each marketplace app is a ready-made specification: pick it, fill in its parameters if it has any, and pay. Prices are USD per month at the preset size and instance count. Deploy these at exactly the listed image, resources, instance count and containerData; the sync flag on containerData is part of the specification, not decoration.');
lines.push('');
lines.push('A containerData starting with `g:` means primary/standby: only one instance runs and the others keep a synchronised copy of that directory, which is why a game server is sold on several instances. Extra instances are standby copies of one world, not extra players.');
lines.push('');

// Ladders first: the same app at several sizes, which is how people ask for them.
const byImage = {};
for (const a of cat) if (a.compose.length === 1) (byImage[a.compose[0].repotag] = byImage[a.compose[0].repotag] || []).push(a);
const ladders = Object.values(byImage).filter((v) => v.length > 2).map((v) => v.sort((x, y) => x.compose[0].ram - y.compose[0].ram));
if (ladders.length) {
  lines.push('## Apps offered at several sizes <https://cloud.runonflux.com/marketplace>');
  lines.push('');
  for (const l of ladders) {
    const c0 = l[0].compose[0];
    lines.push(`**${l[0].name.replace(/\d+(GB|Slots)?$/i, '')}** (image \`${c0.repotag}\`, containerData \`${c0.containerData}\`, ${l[0].instances} instances):`);
    lines.push('');
    lines.push('| template | CPU | RAM | disk | USD/month |');
    lines.push('|---|---|---|---|---|');
    for (const a of l) { const c = a.compose[0]; lines.push(`| ${a.name} | ${+c.cpu.toFixed(1)} | ${fmtRam(c.ram)} | ${c.hdd} GB | ${a.priceUSD != null ? `$${a.priceUSD}` : ''} |`); }
    lines.push('');
  }
}

for (const a of cat) {
  const tot = a.compose.reduce((t, c) => ({ cpu: t.cpu + c.cpu, ram: t.ram + c.ram, hdd: t.hdd + c.hdd }), { cpu: 0, ram: 0, hdd: 0 });
  lines.push(`## ${a.name} <https://cloud.runonflux.com/marketplace>`);
  const locked = (a.lockedValues || []).includes('instances') ? ' (instance count is fixed for this app)' : '';
  lines.push(`${a.name} is a ${a.category} app on the Flux marketplace: ${String(a.description || '').replace(/\s+/g, ' ').trim()} Preset price ${a.priceUSD != null ? `$${a.priceUSD}` : 'as quoted'} per month for ${a.instances} instances${locked}. Total resources ${+tot.cpu.toFixed(1)} cores, ${tot.ram} MB RAM, ${tot.hdd} GB storage across ${a.compose.length} component${a.compose.length === 1 ? '' : 's'}.`);
  for (const c of a.compose) {
    const f = flagOf(c.containerData);
    const ports = (c.containerPorts || []).length ? `; container ports ${c.containerPorts.join(', ')}` : '';
    const params = (c.userEnvironmentParameters || []).filter((u) => u.name);
    const ptxt = params.length ? ` Parameters the user fills in: ${params.map((u) => `${u.name}${u.description ? ` (${u.description})` : ''}${u.optional ? ' [optional]' : ''}`).join('; ')}.` : '';
    lines.push(`- Component ${c.name}: image \`${c.repotag}\`; ${+c.cpu.toFixed(1)} cores, ${c.ram} MB RAM, ${c.hdd} GB${ports}; containerData \`${c.containerData}\`${f ? ` (${f}: ${FLAG[f[0]]})` : ''}.${ptxt}`);
  }
  lines.push('');
}
fs.writeFileSync(OUT, `${lines.join('\n').trim()}\n`);
console.log(`${cat.length} apps, ${ladders.length} ladders -> ${OUT}`);
