#!/usr/bin/env node
/**
 * Mint an API key for the hub. Keys are stateless: "sk-flux-<name>-<sig>"
 * where sig is HMAC-SHA256(HUB_SECRET, name), so nothing is stored anywhere
 * and every hub instance verifies the same key. Hand a key out per user or
 * per application; revoke a name by adding it to the hub's REVOKED env.
 *
 *   node tools/hub-key.js <name> [<name> ...]
 *   node tools/hub-key.js <name> --origins a.com,b.com [--models fluxai:tiny] [--days 365]
 *       a SCOPED key ("sk-fluxs-..."): usable only from those origins, only for
 *       those models, only until it expires. Safe(r) to ship in a browser
 *       bundle - a browser cannot forge Origin - but any server-side caller
 *       can set the header, so it limits casual misuse rather than replacing a
 *       backend proxy.
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
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : null; };
const ORIGINS = (opt('origins') || '').split(',').map(x => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
const MODELS = (opt('models') || '').split(',').map(x => x.trim()).filter(Boolean);
const DAYS = Number(opt('days') || 0);
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

const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 24);

for (const name of names) {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) { console.error(`bad name "${name}": a-z, 0-9, -, max 32, must start alphanumeric`); process.exit(1); }
  if (!ORIGINS.length && !MODELS.length && !DAYS) {
    console.log(`sk-flux-${name}-${sign(name)}`);
    continue;
  }
  // Scoped key: the limits travel inside the signed payload, so the hub needs
  // no storage to enforce them and no redeploy to issue one.
  const claims = { n: name };
  if (ORIGINS.length) claims.o = ORIGINS;
  if (MODELS.length) claims.m = MODELS;
  if (DAYS) claims.e = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  console.log(`sk-fluxs-${payload}-${sign(payload)}`);
  console.error(`  scope: origins=${(claims.o || ['any']).join(' ')} models=${(claims.m || ['any']).join(' ')} expires=${claims.e ? new Date(claims.e * 1000).toISOString().slice(0, 10) : 'never'}`);
}
