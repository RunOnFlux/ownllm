#!/usr/bin/env node
/**
 * Scan a generated dataset for domains the assistant states that are not real.
 *
 * Why: the worst failure this model has produced in the live UI was a confident
 * invented domain - it told a user that SSP Wallet "has its own page at
 * sspwallet.online with a QR button". The domain does not exist and neither
 * does the button. A wrong URL is worse than "I do not know", because the user
 * acts on it, and a phishing site is one typo-squat away.
 *
 * So no training row may teach a domain that is not attested. The allowlist
 * below was built by extracting every domain that actually appears in the docs
 * corpus (images/docsbot/docs/corpus.jsonl) plus the example domains the data
 * deliberately uses for user-owned things.
 *
 *   node finetune/audit-domains.js data/deploy-v7.jsonl
 */
const fs = require('node:fs');
const path = require('node:path');

// Attested in the docs corpus.
const REAL = [
  'runonflux.com', 'runonflux.io', 'zelcore.io', 'sspwallet.io', 'sspwallet.com',
  'fluxedge.ai', 'fluxcore.ai', 'fluxai.io', 'fluxai.com', 'fluxai.app',
  'beaverai.app', 'brimley.ai', 'influxtechnologies.com', 'fluxofficial.medium.com',
  'github.com', 'discord.gg', 'discord.com', 't.me', 'linkedin.com', 'addons.mozilla.org', 'chromewebstore.google.com', 'crowdin.com', 'apps.apple.com', 'play.google.com', 'halborn.com',
  'docker.com', 'hub.docker.com', 'docker.io', 'ghcr.io',
  // the public container registries, which appear as the host of a private image
  'azurecr.io', 'pkg.dev', 'amazonaws.com', 'gcr.io', 'quay.io', 'nodejs.org', 'medium.com', 'x.com',
];
// Deliberate placeholders for things the user owns. These are reserved for
// documentation by RFC 2606 or are obviously fictional, so they cannot collide
// with a real site.
const PLACEHOLDER = ['example.com', 'example.org', 'example.net', 'mycompany.com', 'mydomain.org', 'mysite.io', 'acme.co', 'mycorp.com', 'example.co', 'mycompany.io'];

// Domains that appear in the marketplace catalogue itself, e.g. a bootstrap URL
// in an app's environment parameters. These are attested by the same API the
// specifications come from, so quoting them back is quoting the source.
const FROM_CATALOGUE = (() => {
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'marketplace.json'), 'utf8'));
    const out = new Set();
    for (const m of JSON.stringify(cat).matchAll(/\b([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)\b/gi)) {
      const h = m[1].toLowerCase();
      if (/\.(com|io|org|net|ai|app|co|gg|dev|cloud|me|xyz)$/.test(h)) out.add(h);
    }
    return out;
  } catch { return new Set(); }
})();

const ok = (d) => FROM_CATALOGUE.has(d) || REAL.some((r) => d === r || d.endsWith(`.${r}`))
  || PLACEHOLDER.some((r) => d === r || d.endsWith(`.${r}`));

const file = process.argv[2] || 'finetune/data/deploy-v7.jsonl';
const found = new Map();
let rows = 0;
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  rows += 1;
  const r = JSON.parse(line);
  for (const m of r.messages) {
    // Only what the assistant asserts. A user pasting a URL, or a tool result,
    // is data rather than something the model is being taught to say.
    if (m.role !== 'assistant' || !m.content) continue;
    for (const d of m.content.matchAll(/\b([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)\b/gi)) {
      const host = d[1].toLowerCase();
      // skip file names, image tags and version strings
      if (!/\.(com|io|org|net|ai|app|co|gg|dev|xyz|online|cloud|me)$/.test(host)) continue;
      if (ok(host)) continue;
      found.set(host, (found.get(host) || 0) + 1);
    }
  }
}
const bad = [...found.entries()].sort((a, b) => b[1] - a[1]);
console.log(`${rows} rows scanned, ${bad.length} unattested domains`);
for (const [d, n] of bad.slice(0, 40)) console.log(`${String(n).padStart(6)} ${d}`);
process.exit(bad.length ? 1 : 0);
