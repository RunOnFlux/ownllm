#!/usr/bin/env node
/**
 * Read a component's container log from the node running it, as the app
 * owner. The owner signs a login phrase on that node (same as tools/deploy.js)
 * and calls /apps/applog/<container>/<lines>.
 *
 *   node tools/applog.js <node-ip[:api-port]> <app> [component] [lines]
 *   (the api port is 16127 unless the host runs several nodes; the
 *   /apps/location listing shows the right one)
 *   node tools/applog.js 80.72.20.162 ownllmhub hub 200
 *
 * Needs .env with FLUXID_PRIVATEKEY (owner identity); FLUX_PRIVATEKEY is not
 * used. Container names follow FluxOS: flux<component>_<app>, or flux<app>
 * for a single-component app.
 */
const fs = require('fs');
const path = require('path');

const MOONSHINE = process.env.MOONSHINE_DIR || path.join(__dirname, '..', '..', 'moonshine-launch');
const keys = require(path.join(MOONSHINE, 'src', 'keys'));
const { FluxNode } = require(path.join(MOONSHINE, 'src', 'fluxnode'));

const [ip, app, component, linesArg] = process.argv.slice(2);
if (!ip || !app) { console.error('usage: node tools/applog.js <node-ip> <app> [component] [lines]'); process.exit(1); }
const lines = Number(linesArg || 200);
const container = component ? `flux${component}_${app}` : `flux${app}`;

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
  const payload = await node.call('get', `/apps/applog/${container}/${lines}`, { timeout: 60000 });
  if (payload?.status !== 'success') { console.error(JSON.stringify(payload).slice(0, 400)); process.exit(1); }
  const data = payload.data;
  process.stdout.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  process.stdout.write('\n');
})().catch((err) => { console.error(err.message); process.exit(1); });
