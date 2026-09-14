#!/usr/bin/env node
/**
 * Mint an API key for the hub. Keys are stateless: "sk-flux-<name>-<sig>"
 * where sig is HMAC-SHA256(HUB_SECRET, name), so nothing is stored anywhere
 * and every hub instance verifies the same key. Hand a key out per user or
 * per application; revoke a name by adding it to the hub's REVOKED env.
 *
 *   node tools/hub-key.js <name> [<name> ...]
 *   HUB_SECRET=... node tools/hub-key.js alice
 *
 * Without HUB_SECRET in the environment the secret is read from the hub's
 * plaintext spec (specs/<app>-hub.plaintext.json, --app to pick the app).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const ai = args.indexOf('--app');
const APP = ai >= 0 ? args.splice(ai, 2)[1] : 'ownllmhub';
const names = args.filter(a => !a.startsWith('--'));
if (!names.length) { console.error('usage: node tools/hub-key.js <name> [...]   (name: a-z, 0-9, -; max 32)'); process.exit(1); }

let secret = process.env.HUB_SECRET;
if (!secret) {
  const file = path.join(__dirname, '..', 'specs', `${APP}-hub.plaintext.json`);
  try {
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const c of spec.compose || []) {
      const e = (c.environmentParameters || []).find(v => v.startsWith('HUB_SECRET='));
      if (e) secret = e.slice('HUB_SECRET='.length);
    }
  } catch { /* fall through */ }
  if (!secret) { console.error(`no HUB_SECRET in the environment and none in ${file}`); process.exit(1); }
}

for (const name of names) {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) { console.error(`bad name "${name}": a-z, 0-9, -, max 32, must start alphanumeric`); process.exit(1); }
  const sig = crypto.createHmac('sha256', secret).update(name).digest('base64url').slice(0, 24);
  console.log(`sk-flux-${name}-${sig}`);
}
