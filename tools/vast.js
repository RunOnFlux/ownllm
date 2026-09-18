#!/usr/bin/env node
/**
 * Rent a GPU on vast.ai and run the fine-tune job on it.
 *
 * FluxEdge premium nodes come up cordoned (pods never schedule, the deployment
 * is reaped after ~5 minutes with no error), so this is the working GPU path.
 * The job is finetune/run-edge.sh, exactly as on FluxEdge: it clones the repo,
 * pulls finetune/data.tar.gz, trains, converts to GGUF and serves its log and
 * artifacts over PORT - here published on the instance's mapped 8080.
 *
 *   node tools/vast.js offers [--gpu A100_SXM4] [--max-price 1.5]
 *   node tools/vast.js rent [--offer <id>] [--maxlen 8192] [--epochs 1] [--disk 80]
 *   node tools/vast.js status
 *   node tools/vast.js log [--id <instance>] [--lines 40]
 *   node tools/vast.js fetch <out dir> [--id <instance>]
 *   node tools/vast.js stop [--id <instance>]
 *
 * The API key lives in ~/.vast.key or VAST_API_KEY and is never printed.
 * Every instance bills until destroyed: `status` shows $/h.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const KEY = process.env.VAST_API_KEY || (fs.existsSync(path.join(os.homedir(), '.vast.key')) ? fs.readFileSync(path.join(os.homedir(), '.vast.key'), 'utf8').trim() : '');
if (!KEY) { console.error('no vast.ai key: put it in ~/.vast.key or VAST_API_KEY'); process.exit(1); }
const CLI = path.join(__dirname, '..', 'finetune', '.venv-vast', 'bin', 'vastai');
if (!fs.existsSync(CLI)) { console.error('vastai CLI missing; python3 -m venv finetune/.venv-vast && finetune/.venv-vast/bin/pip install vastai'); process.exit(1); }
const vast = (...a) => execFileSync(CLI, [...a, '--api-key', KEY], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// status_msg carries raw control characters, which JSON.parse rejects
const parse = (s) => JSON.parse(s.replace(/[\x00-\x1f]/g, (c) => (c === '\n' || c === '\t' || c === '\r' ? ' ' : '')));
const port8080 = (d) => ((d.ports || {})['8080/tcp'] || [{}])[0].HostPort;
const base = (d) => `http://${d.public_ipaddr}:${port8080(d)}`;

const instances = () => parse(vast('show', 'instances', '--raw'));
const one = (id) => parse(vast('show', 'instance', String(id), '--raw'));
function pickInstance(id) {
  if (id) return one(id);
  const all = instances();
  if (!all.length) throw new Error('no instances running');
  return all[0];
}

async function main() {
  if (cmd === 'offers') {
    const gpu = opt('gpu', 'A100_SXM4'); const max = Number(opt('max-price', 2));
    const q = `gpu_name=${gpu} gpu_ram>=79 num_gpus=1 reliability>0.98 disk_space>=60 inet_down>=500 verified=true rentable=true dph<${max}`;
    for (const o of parse(vast('search', 'offers', q, '-o', 'dph', '--raw')).slice(0, 10)) {
      console.log(`${String(o.id).padEnd(10)} ${o.gpu_name.padEnd(11)} $${o.dph_total.toFixed(3)}/h  dlperf ${Math.round(o.dlperf)}  rel ${o.reliability2.toFixed(3)}  down ${Math.round(o.inet_down)} Mbps  ${o.geolocation || ''}`);
    }
    return;
  }
  if (cmd === 'rent') {
    let offer = opt('offer', null);
    const gpu = opt('gpu', 'A100_SXM4'); const max = Number(opt('max-price', 2));
    if (!offer) {
      const found = parse(vast('search', 'offers', `gpu_name=${gpu} gpu_ram>=79 num_gpus=1 reliability>0.98 disk_space>=60 inet_down>=500 verified=true rentable=true dph<${max}`, '-o', 'dph', '--raw'))[0];
      if (!found) throw new Error(`no ${gpu} offer under $${max}/h`);
      offer = found.id; console.log(`offer ${offer}: ${found.gpu_name} $${found.dph_total.toFixed(3)}/h`);
    }
    // MAXLEN 8192: with the 15 MCP schemas a full-surface example is > 6144
    // tokens, and train.py drops what does not fit rather than mislabel it.
    const env = [`EPOCHS=${opt('epochs', '1')}`, `MAXLEN=${opt('maxlen', '8192')}`, 'PORT=8080', 'WORK=/work', 'HF_HOME=/work/hf',
      'PIP_EXTRA="--no-deps einops causal-conv1d==1.5.0.post8 mamba-ssm==2.2.4"'];
    const extra = opt('env', null); if (extra) env.push(extra);
    const script = opt('script', 'https://raw.githubusercontent.com/RunOnFlux/ownllm/master/finetune/run-edge.sh');
    const onstart = `export ${env.join(' ')}; mkdir -p /work; (apt-get update -qq && apt-get install -y -qq curl >/dev/null 2>&1; curl -fsSL ${script} -o /run-edge.sh && bash /run-edge.sh) > /work/onstart.log 2>&1 &`;
    const out = vast('create', 'instance', String(offer), '--image', opt('image', 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel'),
      '--disk', opt('disk', '80'), '--ssh', '--direct', '--env', '-p 8080:8080', '--onstart-cmd', onstart, '--raw');
    const id = (out.match(/"new_contract":\s*(\d+)/) || [])[1];
    console.log(`instance ${id} creating; watch with: node tools/vast.js log --id ${id}`);
    return;
  }
  if (cmd === 'status') {
    const all = instances();
    if (!all.length) { console.log('no instances'); return; }
    for (const d of all) console.log(`${d.id} ${d.actual_status} ${d.gpu_name} $${(d.dph_total || 0).toFixed(3)}/h  ${port8080(d) ? base(d) : '(no port yet)'}  ssh ${d.ssh_host}:${d.ssh_port}`);
    return;
  }
  if (cmd === 'log') {
    const d = pickInstance(opt('id', null));
    if (!port8080(d)) { console.log(`${d.id} ${d.actual_status}: no mapped port yet`); return; }
    const txt = await (await fetch(`${base(d)}/log.txt`, { signal: AbortSignal.timeout(30000) })).text();
    console.log(txt.replace(/\r/g, '\n').split('\n').filter((l) => !/Fetching|Loading checkpoint/.test(l)).slice(-Number(opt('lines', 40))).join('\n'));
    return;
  }
  if (cmd === 'fetch') {
    const out = args[0] || 'runs/vast'; const d = pickInstance(opt('id', null));
    fs.mkdirSync(out, { recursive: true });
    const { Readable } = require('node:stream'); const { pipeline } = require('node:stream/promises');
    const get = async (url, dest) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(3600000) });
      if (!r.ok) { console.log(`skip ${url}: ${r.status}`); return; }
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest));   // GGUFs are > 2 GB: stream, never buffer
      console.log(`${dest} ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
    };
    const list = async (url) => [...(await (await fetch(url, { signal: AbortSignal.timeout(30000) })).text()).matchAll(/href="([^"]+)"/g)]
      .map((m) => decodeURIComponent(m[1])).filter((n) => !n.startsWith('?') && n !== '../');
    for (const n of await list(`${base(d)}/`)) {
      if (n.endsWith('/')) {
        fs.mkdirSync(path.join(out, n), { recursive: true });
        for (const f of await list(`${base(d)}/${n}`)) if (!f.endsWith('/')) await get(`${base(d)}/${n}${f}`, path.join(out, n, f));
      } else await get(`${base(d)}/${n}`, path.join(out, n));
    }
    return;
  }
  if (cmd === 'stop') {
    const d = pickInstance(opt('id', null));
    console.log(vast('destroy', 'instance', String(d.id), '--raw').trim().slice(0, 200));
    return;
  }
  console.error('commands: offers | rent | status | log | fetch <dir> | stop');
  process.exit(1);
}
main().catch((e) => { console.error(e.message.slice(0, 300)); process.exit(1); });
