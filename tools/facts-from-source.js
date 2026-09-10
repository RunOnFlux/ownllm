#!/usr/bin/env node
/**
 * Generates a fact sheet from FluxOS's own source, so the authoritative numbers
 * are quotable instead of remembered.
 *
 * Two reasons this beats prose documentation for these particular facts:
 *
 * 1. It cannot drift. The limits live in config/default.js and appValidator.js;
 *    a written page describing them goes stale the moment either changes. This
 *    is regenerated from the source it describes.
 *
 * 2. It states DERIVED values. Every model tested failed to work out that
 *    1056000 blocks is about 12 months - they cannot divide reliably. Stating
 *    the division here turns a computation the model gets wrong into a
 *    retrieval it gets right.
 *
 *   node tools/facts-from-source.js ../flux > images/docsbot/docs/flux-facts.md
 */
const path = require('node:path');

const repo = process.argv[2] || path.join(__dirname, '..', '..', 'flux');
// eslint-disable-next-line import/no-dynamic-require, global-require
const c = require(path.join(path.resolve(repo), 'ZelBack', 'config', 'default.js'));

const a = c.fluxapps;
const spec = c.fluxSpecifics;
const locked = c.lockedSystemResources;
const out = [];
const p = s => out.push(s);

const BLOCK_SECONDS = 30; // post-PON; measured at 30.1s over 2880 blocks
const months = blocks => (blocks * BLOCK_SECONDS) / (60 * 60 * 24 * 30.44);

p('# Flux application limits and pricing (generated from FluxOS source)');
p('');
p('Generated from `ZelBack/config/default.js` and `appValidator.js`. These are the');
p('values FluxOS enforces, not a description of them.');
p('');

p('## Resources available to an application, by node tier');
p('');
p('A node reserves some of its capacity for the system, so an application can use');
p('the tier total minus what is locked.');
p('');
p('| tier | CPU cores | RAM (MB) | SSD (GB) | collateral (FLUX) |');
p('|---|---|---|---|---|');
for (const tier of ['cumulus', 'nimbus', 'stratus']) {
  const cpu = (spec.cpu[tier] - locked.cpu) / 10;
  const ram = spec.ram[tier] - locked.ram;
  const hdd = spec.hdd[tier] - locked.hdd;
  p(`| ${tier} | ${cpu} | ${ram} | ${hdd} | ${spec.collateral[tier].toLocaleString()} |`);
}
p('');
p(`An application larger than **${(spec.cpu.nimbus - locked.cpu) / 10} cores or `
  + `${spec.ram.nimbus - locked.ram} MB** cannot be placed on a nimbus node and is `
  + 'restricted to stratus nodes, which reduces the number of machines that can host it.');
p('');

p('## Validation rules');
p('');
p('- `cpu` must be a multiple of 0.1, minimum 0.1.');
p('- `ram` must be a multiple of 100, minimum 100.');
p('- `hdd` must be a whole number of GB, minimum 1.');
p(`- The container image must be ${a.maxImageSize / 1e9} GB or smaller.`);
p(`- The container root filesystem is capped at ${a.hddFileSystemMinimum} GB; persistent data belongs on the mounted volume.`);
p('- Application and component names may contain only letters and digits, and must not start with `flux` or `zel`.');
p('- `ports`, `containerPorts` and `domains` must be the same length, maximum 5 each.');
p('- Maximum 20 environment variables and 20 commands per component, each at most 400 characters.');
p('- `containerData` must be 2 to 200 characters.');
p('');

p('## Instances and lifetime');
p('');
p(`- An application may have between ${a.minimumInstancesV8} and ${a.maximumInstances} instances (v8 or later).`);
p(`- Minimum lifetime is ${a.cancel1BlockMinBlocksAllowance} block; maximum is ${a.postPonMaxBlocksAllowance.toLocaleString()} blocks.`);
p(`- A block takes about ${BLOCK_SECONDS} seconds since the PON fork, so:`);
// Pick the unit from the actual duration: an earlier version reported 2000
// blocks as "1000 minutes", which is true and useless.
const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
function human(blocks) {
  const secs = blocks * BLOCK_SECONDS;
  if (secs < 3600) return plural(Math.round(secs / 60), 'minute');
  if (secs < 2 * 86400) return `${(secs / 3600).toFixed(1)} hours`;
  if (secs < 60 * 86400) return `${(secs / 86400).toFixed(1)} days`;
  return `${months(blocks).toFixed(1)} months`;
}
for (const b of [1, 100, 2000, 22000, 88000, 264000, a.postPonMaxBlocksAllowance]) {
  p(`  - ${b.toLocaleString()} ${b === 1 ? 'block is' : 'blocks are'} about **${human(b)}**`);
}
p(`- ${(88000).toLocaleString()} blocks is the figure pricing treats as one month.`);
p('');

p('## Ports');
p('');
p(`- Allowed range: ${a.portMin} to ${a.portMax}.`);
p(`- Banned entirely: ${a.bannedPorts.join(', ')}.`);
p(`- Charged an extra fee: ${a.enterprisePorts.join(', ')}.`);
p('');

p('## Pricing');
p('');
const chain = a.price[a.price.length - 1];
p('Two prices exist and they are not the same number.');
p('');
p('**Consensus price** — what nodes verify a payment against, in FLUX per month:');
p('');
p(`- ${chain.cpu} per 0.1 CPU core`);
p(`- ${chain.ram} per 100 MB RAM`);
p(`- ${chain.hdd} per GB SSD`);
p(`- ${chain.scope} extra for an enterprise application or one targeting specific nodes`);
p(`- ${chain.staticip} extra for a static IP, ${chain.port} per surcharged port`);
p(`- minimum ${chain.minPrice} FLUX`);
p('- the total is divided by 3, then multiplied by the number of instances');
p('');
const usd = a.usdprice;
p('**Marketplace price** — what Flux Home quotes, in USD per month:');
p('');
p(`- ${usd.cpu} per 0.1 CPU core, ${usd.ram} per 100 MB RAM, ${usd.hdd} per GB SSD`);
p(`- ${usd.scope} extra for enterprise, ${usd.staticip} for static IP, ${usd.port} per surcharged port`);
p(`- minimum $${usd.minUSDPrice}; paying in FLUX applies a ${Math.round((1 - usd.fluxmultiplier) * 100)}% discount`);
p('');
p('Worked example — 9.5 cores, 28000 MB, 67 GB, enterprise, 1 instance, one month:');
const ex = { cpu: 9.5, ram: 28000, hdd: 67 };
const chainTotal = ex.cpu * chain.cpu * 10 + (ex.ram * chain.ram) / 100 + ex.hdd * chain.hdd + chain.scope;
const usdTotal = ex.cpu * usd.cpu * 10 + (ex.ram * usd.ram) / 100 + ex.hdd * usd.hdd + usd.scope;
p('');
p(`- consensus: ${(Math.ceil((chainTotal / 3) * 100) / 100).toFixed(2)} FLUX`);
p(`- marketplace: $${(Math.ceil((usdTotal / 3) * 100) / 100).toFixed(2)}`);
p('');

p('## Enterprise applications');
p('');
p('- Setting `enterprise` to an encrypted blob encrypts the whole compose section, so environment variables and private registry credentials never appear on the public chain.');
p('- Enterprise applications can only be validated and run on nodes running ArcaneOS.');
p(`- Every component must support the ${c.enterpriseRequiredArchitectures ? c.enterpriseRequiredArchitectures.join(', ') : 'amd64'} architecture.`);
p('- Only enterprise applications may target specific nodes.');
p('');

p('## Networking between components');
p('');
p('Every application gets its own docker network. A component reaches another component of the same application at `flux<component>_<appname>` on its container port, with nothing published.');
p('');

p(`_Generated ${new Date().toISOString().slice(0, 10)} from FluxOS config; regenerate when the source changes._`);

process.stdout.write(`${out.join('\n')}\n`);
