#!/usr/bin/env node
/**
 * Documentation questions whose answer has to be COMPUTED from the context.
 *
 * v3 scored 7/9 on grounding and lost both points on one case: "if I deploy for
 * the maximum expire, how many months is that?" - 1,056,000 blocks / 88,000 per
 * month = 12, and the model answered 35. Every other grounded fact it reads
 * correctly; what it cannot do is combine two figures and divide.
 *
 * So: docs-shaped rows (same instruction block and citation style as
 * gen-docs.js, no tools) where the answer is arithmetic over two or three
 * figures in the context. The numbers are randomised per row, so the model
 * learns to read-and-compute rather than to memorise 12; and one row in six is
 * a question the context cannot answer, which keeps the refusal behaviour that
 * strict grounding also measures.
 *
 *   node finetune/gen-docs-math.js [--n 800] [--out finetune/data/docs-math.jsonl]
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const N = Number(opt('n', 800));
const OUT = opt('out', path.join(__dirname, 'data', 'docs-math.jsonl'));
let seed = Number(opt('seed', 11));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;
const money = (n) => `$${n.toFixed(2)}`;

const INSTRUCTION = 'You answer strictly from the DOCUMENTATION below. Cite the sources you used as [1], [2]. '
  + 'Answer the question that was asked, concisely, in plain prose or as a numbered list of at most eight short steps (1., 2., ...). '
  + 'Put citations like [1] at the end of a sentence; never use [1] as a step number. State figures as the documentation gives them; '
  + 'do not explain how a figure is derived unless asked. Stop after the last sentence of the answer - no list of sources, no headings, '
  + 'no links, and do not mention "the documentation". If the documentation does not contain the answer, reply exactly: '
  + '"Not covered in the documentation." Never guess and never use outside knowledge.';

const row = (docs, q, a) => ({ messages: [
  { role: 'user', content: `${INSTRUCTION}\n\nRETRIEVED DOCUMENTATION:\n${docs.map((d, i) => `[${i + 1}]\n${d}`).join('\n\n')}\n\nQUESTION: ${q}` },
  { role: 'assistant', content: a },
] });

/** Each builder returns {docs, q, a}. Numbers differ every time. */
const BUILDERS = [
  // blocks -> months: the exact shape v3 failed
  () => {
    const perMonth = pick([80000, 84000, 88000, 90000, 96000]);
    const months = pick([3, 6, 9, 12, 18, 24]);
    const max = perMonth * months;
    const secs = pick([30, 45, 60, 120]);
    const docs = [
      `Application lifetime\nMinimum expire is 1 block. Maximum expire is ${max.toLocaleString('en-US').replace(/,/g, '')} blocks.\nSince the PON fork a block takes about ${secs} seconds, so ${perMonth} blocks is one month.`,
      `Renewals\nAn application can be renewed at any time before it expires. The new term is added to whatever is left of the current one.`,
    ];
    return { docs, q: pick(['If I deploy for the maximum allowed expire, roughly how many months is that?', 'What is the longest I can register an app for, in months?', 'The maximum expire in months is what?']),
      a: `The maximum expire is ${max} blocks, and ${perMonth} blocks is one month, so that is about ${months} months [1].` };
  },
  // blocks -> days/hours
  () => {
    const secs = pick([30, 45, 60]);
    const blocks = pick([2880, 5760, 20000, 44000, 88000]);
    const days = +(blocks * secs / 86400).toFixed(1);
    const docs = [`Block timing\nSince the PON fork a block takes about ${secs} seconds.\nAn application's term is measured in blocks and is set by the expire field.`];
    return { docs, q: `How long is an expire of ${blocks} blocks in days?`,
      a: `At about ${secs} seconds per block, ${blocks} blocks is roughly ${days} days [1].` };
  },
  // price composition
  () => {
    const cpuR = +(0.5 + rnd()).toFixed(2); const ramR = +(0.4 + rnd() * 0.6).toFixed(2); const hddR = +(0.05 + rnd() * 0.15).toFixed(3);
    const cores = pick([0.5, 1, 2, 4]); const ramGB = pick([1, 2, 4, 8]); const hdd = pick([10, 20, 50, 100]);
    const inst = pick([1, 2, 3, 5]);
    const per = +(cores * cpuR + ramGB * ramR + hdd * hddR).toFixed(2);
    const total = +(per * inst).toFixed(2);
    const docs = [
      `Pricing\nPrices are per instance and per month: ${money(cpuR)} per CPU core, ${money(ramR)} per GB of RAM, ${money(hddR)} per GB of SSD. The minimum price for any application is $0.99 per month.`,
      `Instances\nThe price is multiplied by the number of instances. An application may have between 1 and 100 instances.`,
    ];
    return { docs, q: `What does an app with ${cores} ${cores === 1 ? 'core' : 'cores'}, ${ramGB} GB RAM and ${hdd} GB of storage cost per month on ${inst} ${inst === 1 ? 'instance' : 'instances'}?`,
      a: `That is ${money(per)} per instance per month, so ${money(total)} per month for ${inst} ${inst === 1 ? 'instance' : 'instances'} [1][2].` };
  },
  // total resources across instances
  () => {
    const cores = pick([0.5, 1, 2, 3]); const ram = pick([500, 1000, 2000, 4000]); const hdd = pick([5, 10, 20, 50]);
    const inst = pick([2, 3, 5, 10]);
    const docs = [
      `Instances\nEvery instance of an application runs the same specification on a different node. Resources in the specification are per instance.`,
      `Limits\nMaximum per application: 15 CPU cores, 59000 MB RAM, 820 GB SSD.`,
    ];
    return { docs, q: `If I run ${inst} instances of an app that asks for ${cores} ${cores === 1 ? 'core' : 'cores'}, ${ram} MB RAM and ${hdd} GB of disk, how much is that in total across the network?`,
      a: `Resources are per instance, so ${inst} instances use ${+(cores * inst).toFixed(1)} ${cores * inst === 1 ? 'core' : 'cores'}, ${ram * inst} MB of RAM and ${hdd * inst} GB of disk in total [1].` };
  },
  // unit conversion
  () => {
    const mb = pick([2500, 5000, 8000, 16000, 28000, 59000]);
    const docs = [`Node tiers\nA NIMBUS node offers applications 7.0 cores and ${mb} MB.\nA CUMULUS node offers applications 3.0 cores and 5000 MB.`];
    return { docs, q: `How many GB of RAM does a NIMBUS node give an application?`,
      a: `A NIMBUS node offers ${mb} MB, which is ${+(mb / 1000).toFixed(1)} GB [1].` };
  },
  // does it fit: comparison against a limit
  () => {
    const maxCores = pick([12, 15, 20]); const maxRam = pick([49000, 59000, 64000]);
    const wantCores = pick([2, 8, 14, 16, 18]); const wantRamGB = pick([8, 32, 48, 64, 72]);
    const okCores = wantCores <= maxCores; const okRam = wantRamGB * 1000 <= maxRam;
    const docs = [`Application limits\nMaximum per application: ${maxCores} CPU cores, ${maxRam} MB RAM, 820 GB SSD.`,
      `Components\nThe limits apply to the sum of all components in the application.`];
    const verdict = okCores && okRam ? `Yes: ${wantCores} cores and ${wantRamGB} GB (${wantRamGB * 1000} MB) are both within the maximum of ${maxCores} cores and ${maxRam} MB [1].`
      : !okCores && !okRam ? `No: the maximum is ${maxCores} cores and ${maxRam} MB, so ${wantCores} cores and ${wantRamGB * 1000} MB both exceed it [1].`
        : !okCores ? `No: ${wantCores} cores is over the maximum of ${maxCores} cores, although ${wantRamGB * 1000} MB of RAM is within the ${maxRam} MB limit [1].`
          : `No: ${wantRamGB * 1000} MB is over the ${maxRam} MB limit, although ${wantCores} cores is within the ${maxCores}-core maximum [1].`;
    return { docs, q: `Can one application ask for ${wantCores} cores and ${wantRamGB} GB of RAM?`, a: verdict };
  },
  // headroom: how much is left
  () => {
    const maxRam = pick([49000, 59000, 64000]); const used = pick([12000, 20000, 33000, 41000]);
    const docs = [`Application limits\nMaximum per application: 15 CPU cores, ${maxRam} MB RAM, 820 GB SSD.`,
      `Components\nThe limits apply to the sum of all components in the application.`];
    return { docs, q: `My components already use ${used} MB of RAM. How much more can I add?`,
      a: `The maximum is ${maxRam} MB for the whole application, so you have ${maxRam - used} MB left [1][2].` };
  },
  // discount / FLUX conversion
  () => {
    const usd = pick([4.5, 9.9, 18.75, 33.6]); const rate = +(0.08 + rnd() * 0.4).toFixed(3); const disc = pick([5, 10, 15]);
    const flux = +(usd / rate * (1 - disc / 100)).toFixed(2);
    const docs = [`Payment\nApplications are priced in USD and paid in FLUX at the market rate, currently $${rate} per FLUX.\nPaying in FLUX gives a ${disc}% discount on the USD price.`];
    return { docs, q: `How much FLUX do I pay for an app that costs ${money(usd)} per month?`,
      a: `With the ${disc}% discount that is ${money(+(usd * (1 - disc / 100)).toFixed(2))}, which at $${rate} per FLUX is about ${flux} FLUX [1].` };
  },
  // multi-component sum
  () => {
    const a = { cpu: pick([0.5, 1, 2]), ram: pick([500, 1000, 2000]), hdd: pick([5, 10, 20]) };
    const b = { cpu: pick([0.5, 1, 2]), ram: pick([500, 1000, 2000]), hdd: pick([5, 10, 20]) };
    const docs = [`Multi-component applications\nAn application may have several components. Each declares its own cpu, ram and hdd, and the application uses the sum of them.`,
      `Limits\nMaximum per application: 15 CPU cores, 59000 MB RAM, 820 GB SSD.`];
    return { docs, q: `My app has a web component with ${a.cpu} cores, ${a.ram} MB and ${a.hdd} GB, and a database with ${b.cpu} cores, ${b.ram} MB and ${b.hdd} GB. What does the application use in total?`,
      a: `Together they use ${+(a.cpu + b.cpu).toFixed(1)} ${a.cpu + b.cpu === 1 ? 'core' : 'cores'}, ${a.ram + b.ram} MB of RAM and ${a.hdd + b.hdd} GB of disk, which is within the per-application maximum [1][2].` };
  },
  // rounding rule
  () => {
    const want = pick([1250, 1450, 2750, 3330]);
    const up = Math.ceil(want / 100) * 100;
    const docs = [`Specification rules\nThe ram field is in MB and must be a multiple of 100. The cpu field is in cores and moves in steps of 0.1. The hdd field is in whole GB.`];
    return { docs, q: `I want ${want} MB of RAM. Is that allowed?`,
      a: `No: ram must be a multiple of 100 MB, so ${want} is not valid - use ${up} MB [1].` };
  },
  // refusals: the context is adjacent but silent
  () => {
    const docs = [`Application limits\nMaximum per application: 15 CPU cores, 59000 MB RAM, 820 GB SSD.\nA NIMBUS node offers applications 7.0 cores and 28000 MB.`,
      `Instances\nAn application may have between 1 and 100 instances.`];
    return { docs, q: pick(['How many GPU cores does a NIMBUS node give an application?', 'What does it cost to run a STRATUS node per month?', 'How much bandwidth does an application get?', 'What is the hourly price of a CUMULUS node?', 'How many IPv6 addresses does an app get?']),
      a: 'Not covered in the documentation.' };
  },
];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const out = fs.createWriteStream(OUT);
const counts = {};
for (let i = 0; i < N; i += 1) {
  // one in six is a refusal, the rest are computed answers
  const b = chance(1 / 6) ? BUILDERS[BUILDERS.length - 1] : BUILDERS[Math.floor(rnd() * (BUILDERS.length - 1))];
  const { docs, q, a } = b();
  counts[b === BUILDERS[BUILDERS.length - 1] ? 'refusal' : 'computed'] = (counts[b === BUILDERS[BUILDERS.length - 1] ? 'refusal' : 'computed'] || 0) + 1;
  out.write(`${JSON.stringify(row(docs, q, a))}\n`);
}
out.end();
console.log(`wrote ${N} computed-answer docs rows to ${OUT} ${JSON.stringify(counts)}`);
