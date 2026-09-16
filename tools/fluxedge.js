#!/usr/bin/env node
/**
 * Drive a FluxEdge training job from the command line.
 *
 * FluxEdge's REST API (https://edge.runonflux.com/api/v1, bearer key) rents a
 * machine, deploys a Kubernetes manifest on it and mints an HTTPS ingress per
 * declared port. There is no shell and no working log endpoint, so the job
 * itself serves its log and artifacts over that ingress (finetune/run-edge.sh),
 * and this tool polls it.
 *
 *   FLUXEDGE_API_KEY=... node tools/fluxedge.js machines [--min-vram 24]
 *   node tools/fluxedge.js rent --hash <machine hash>            # or --gpu "RTX 4090" --max-price 0.5
 *   node tools/fluxedge.js deploy --rental <id> [--yaml finetune/fluxedge-train.yaml] [--env QLORA=1 --env BASES="..."]
 *   node tools/fluxedge.js status                                 # rentals, deployments, endpoints, balance
 *   node tools/fluxedge.js log <endpoint>                         # tail the job log
 *   node tools/fluxedge.js fetch <endpoint> <out dir>             # download GGUFs, Modelfiles, adapters
 *   node tools/fluxedge.js stop [--deployment <id>] [--rental <id>] | stop-all
 *
 * The key is read from FLUXEDGE_API_KEY or ~/.fluxedge.key; it is never
 * printed. Every rental bills until stopped: `status` shows spend per hour.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const API = process.env.FLUXEDGE_ENDPOINT || 'https://edge.runonflux.com/api/v1';
const KEY = (process.env.FLUXEDGE_API_KEY || (() => { for (const p of [path.join(os.homedir(), '.fluxedge.key'), '/tmp/fluxedge.key']) { try { return fs.readFileSync(p, 'utf8').trim(); } catch { /* next */ } } return ''; })());
if (!KEY) { console.error('FLUXEDGE_API_KEY (or ~/.fluxedge.key) required'); process.exit(1); }
const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const opts = (n) => { const out = []; for (;;) { const i = args.indexOf(`--${n}`); if (i < 0) return out; out.push(args.splice(i, 2)[1]); } };

async function api(method, route, body, query) {
  const url = new URL(`${API}${route}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${route}: ${res.status} ${text.slice(0, 300)}`);
  return json;
}
const list = (d, key) => Array.isArray(d) ? d : ((d && (d[key] || d.data)) || []);
const VRAM = { H200: 141, H100: 80, A100: 80, A6000: 48, A40: 48, L40S: 48, L40: 48, 5090: 32, A30: 24, 4090: 24, 3090: 24, A10: 24, 4080: 16, 4070: 12 };
const vramOf = (g) => { for (const [k, v] of Object.entries(VRAM)) if (g.includes(k)) return v; return 0; };

(async () => {
  if (cmd === 'machines') {
    const min = Number(opt('min-vram', 16));
    const items = list(await api('GET', '/computers', null, { limit: 200 }), 'computers');
    const rows = items.map((c) => { const gs = (c.gpus || []).filter((g) => g && g.includes('NVIDIA')); return gs.length ? { vram: Math.max(...gs.map(vramOf)), gpu: gs[0], n: gs.length, price: c.price_per_hour, ram: c.memory, disk: c.storage, region: c.region, hash: c.hash } : null; }).filter((r) => r && r.vram >= min).sort((a, b) => b.vram - a.vram || a.price - b.price);
    for (const r of rows) console.log(`${String(r.vram).padStart(3)} GB  $${String(r.price).padEnd(6)} RAM ${String(r.ram).padStart(6)} MB  disk ${String(r.disk).padStart(5)} GB  ${r.n}x ${r.gpu.padEnd(32)} ${(r.region || '').padEnd(22)} ${r.hash}`);
    if (!rows.length) console.log('no machines with that much VRAM right now');
    return;
  }
  if (cmd === 'rent') {
    const hash = opt('hash', null);
    const body = hash ? { hash, nb_gpu: 1, nb_computers: 1, premium: 'none' } : { gpu: opt('gpu', 'RTX 4090'), nb_gpu: 1, nb_computers: 1, max_price_per_hour: Number(opt('max-price', 0.6)), min_memory: Number(opt('min-memory', 32)), min_storage: Number(opt('min-storage', 100)), premium: 'none' };
    const r = await api('POST', '/rental/start', body);
    console.log(JSON.stringify(r, null, 1));
    return;
  }
  if (cmd === 'deploy') {
    const rental = Number(opt('rental', 0)); if (!rental) throw new Error('--rental <id> required');
    let yaml = fs.readFileSync(opt('yaml', path.join(__dirname, '..', 'finetune', 'fluxedge-train.yaml')), 'utf8');
    // --env NAME=value overrides an env entry of the same name in the manifest
    for (const kv of opts('env')) {
      const [k, ...rest] = kv.split('='); const v = rest.join('=');
      const re = new RegExp(`(- name: ${k}\\n\\s+value: )"[^"]*"`);
      if (!re.test(yaml)) throw new Error(`env ${k} not found in manifest`);
      yaml = yaml.replace(re, `$1"${v.replace(/"/g, '\\"')}"`);
    }
    const name = opt('name', `fluxai-train-${Date.now().toString(36)}`);
    const r = await api('POST', '/deployment/start', { name, rental_ids: [rental], yaml: Buffer.from(yaml).toString('base64') });
    console.log(JSON.stringify(r, null, 1));
    return;
  }
  if (cmd === 'status') {
    const bal = await api('GET', '/balance');
    console.log(`balance $${bal.balance}, spending $${bal.spending_per_hour}/h`);
    const rentals = list(await api('GET', '/rentals', null, { status: 'active', limit: 100 }), 'rentals');
    for (const r of rentals) console.log(`rental ${r.rental_id}: ${r.status || ''} ${(r.gpus || []).join(',')} $${r.price_per_hour}/h since ${r.start_time || r.created_at || '?'}`);
    const deps = list(await api('GET', '/deployments', null, { limit: 100 }), 'deployments');
    for (const d of deps) console.log(`deployment ${d.deployment_id}: ${d.status} ${d.name || ''} endpoint=${d.endpoint || '-'} rental=${d.rental_id || (d.rental_ids || []).join(',')}`);
    if (!rentals.length && !deps.length) console.log('nothing running');
    return;
  }
  if (cmd === 'log') {
    const ep = args[0]; if (!ep) throw new Error('endpoint required');
    const res = await fetch(`${ep.replace(/\/$/, '')}/log.txt`, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    console.log(text.split('\n').slice(-Number(opt('lines', 40))).join('\n'));
    return;
  }
  if (cmd === 'fetch') {
    const ep = args[0].replace(/\/$/, ''); const out = args[1] || 'runs/fluxedge'; fs.mkdirSync(out, { recursive: true });
    const idx = await (await fetch(`${ep}/`, { signal: AbortSignal.timeout(30000) })).text();
    const names = [...idx.matchAll(/href="([^"]+)"/g)].map((m) => decodeURIComponent(m[1])).filter((n) => !n.startsWith('?') && n !== '../');
    for (const n of names) {
      if (n.endsWith('/')) {
        const sub = await (await fetch(`${ep}/${n}`, { signal: AbortSignal.timeout(30000) })).text();
        fs.mkdirSync(path.join(out, n), { recursive: true });
        for (const f of [...sub.matchAll(/href="([^"]+)"/g)].map((m) => decodeURIComponent(m[1])).filter((x) => !x.endsWith('/') && !x.startsWith('?'))) await download(`${ep}/${n}${f}`, path.join(out, n, f));
      } else await download(`${ep}/${n}`, path.join(out, n));
    }
    console.log(`fetched into ${out}`);
    return;
  }
  if (cmd === 'stop' || cmd === 'stop-all') {
    if (cmd === 'stop-all') { console.log(JSON.stringify(await api('DELETE', '/deployment/stopAll').catch((e) => e.message))); console.log(JSON.stringify(await api('DELETE', '/rental/stopAll').catch((e) => e.message))); return; }
    const dep = opt('deployment', null); const rental = opt('rental', null);
    if (dep) console.log(JSON.stringify(await api('DELETE', '/deployment/stop', { deployment_id: Number(dep) })));
    if (rental) console.log(JSON.stringify(await api('DELETE', '/rental/stop', { rental_id: Number(rental) })));
    if (!dep && !rental) throw new Error('--deployment <id> and/or --rental <id>');
    return;
  }
  console.error('commands: machines | rent | deploy | status | log <endpoint> | fetch <endpoint> <dir> | stop | stop-all');
  process.exit(1);
})().catch((err) => { console.error(err.message); process.exit(1); });

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(1800000) });
  if (!res.ok) { console.log(`skip ${url}: ${res.status}`); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`${dest} ${(buf.length / 1048576).toFixed(1)} MB`);
}
