#!/usr/bin/env node
/**
 * Restart one component of an app on the node running it, as the app owner.
 * Same login as tools/applog.js; calls /apps/apprestart/<component>_<app>.
 *
 *   node tools/apprestart.js <node-ip[:api-port]> <app> [component]
 *   node tools/apprestart.js 91.226.198.193 ownllmfluxai boot
 *
 * Used when a pool's loader parked after FAILEDINSTALL (the boot component
 * does not retry): fix the cause, then restart boot on the affected nodes.
 */
const fs = require('fs');
const path = require('path');

const MOONSHINE = process.env.MOONSHINE_DIR || path.join(__dirname, '..', '..', 'moonshine-launch');
const keys = require(path.join(MOONSHINE, 'src', 'keys'));
const { FluxNode } = require(path.join(MOONSHINE, 'src', 'fluxnode'));

const [ip, app, component] = process.argv.slice(2);
if (!ip || !app) { console.error('usage: node tools/apprestart.js <node-ip> <app> [component]'); process.exit(1); }
const target = component ? `${component}_${app}` : app;

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) throw new Error('.env not found (needs FLUXID_PRIVATEKEY)');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!env.FLUXID_PRIVATEKEY) throw new Error('.env is missing FLUXID_PRIVATEKEY');
  return env;
}

(async () => {
  const env = loadEnv();
  const owner = keys.identityFromPrivateKey(keys.fromWif(env.FLUXID_PRIVATEKEY));
  const node = new FluxNode(`http://${ip.includes(':') ? ip : `${ip}:16127`}`, { timeout: 60000 });
  await node.login(owner.zelid, (m) => keys.signMessage(m, env.FLUXID_PRIVATEKEY));
  const payload = await node.call('get', `/apps/apprestart/${target}`, { timeout: 120000 });
  console.log(`${ip} ${target}: ${typeof payload === 'string' ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 200)}`);
  if (payload?.status === 'error') process.exit(1);
})().catch((err) => { console.error(`${ip}: ${err.message}`); process.exit(1); });
