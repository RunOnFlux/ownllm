#!/usr/bin/env node
/**
 * A/B two docs-bot endpoints on the same questions: full answers, sources and
 * timings side by side, written to ab-docsbot.json and printed.
 *
 *   node tools/ab-docsbot.js <labelA=url> <labelB=url> [--origin https://docs.runonflux.com]
 *
 * Both bots see the identical request (same Origin, no history), so the only
 * variable is the model behind /ask. Questions are the ones users actually
 * asked plus the grounding set from eval-quality.js.
 */
const fs = require('fs');
const args = process.argv.slice(2);
const oi = args.indexOf('--origin');
const ORIGIN = oi >= 0 ? args.splice(oi, 2)[1] : 'https://docs.runonflux.com';
const targets = args.filter(a => a.includes('=')).map(a => { const i = a.indexOf('='); return { label: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
if (targets.length < 2) { console.error('usage: node tools/ab-docsbot.js A=http://host:port B=https://... [--origin URL]'); process.exit(1); }

const QUESTIONS = [
  'How do I deploy an application on Flux?',
  'How much does an app cost per month?',
  'Why do I need a Flux node to deploy an app?',
  'How much RAM can an application use on a NIMBUS node?',
  'What is the maximum size of a container image?',
  'How many instances can an application have?',
  'How much does a STRATUS node cost to run per month?',
  'What is FluxEdge?',
  'How do I run a Flux node on ArcaneOS?',
  'Can I deploy from a GitHub repository without a Docker image?',
  'What is the difference between Cumulus, Nimbus and Stratus?',
  'How do I update a running application?',
];

async function ask(url, question) {
  const t0 = Date.now();
  const res = await fetch(`${url}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 200)}`, ms: Date.now() - t0 };
  const dec = new TextDecoder();
  let buf = '', first = null, firstToken = null, text = '';
  for await (const piece of res.body) {
    buf += dec.decode(piece, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let j; try { j = JSON.parse(line); } catch { text += line; continue; }
      if (j.sources && !first) { first = j; continue; }
      if (j.ping) continue;
      const tok = j.token ?? j.text ?? j.delta ?? j.content;
      if (typeof tok === 'string') { if (firstToken === null) firstToken = Date.now() - t0; text += tok; }
      else if (j.done || j.error) { if (j.error) text += `\n[error] ${j.error}`; if (typeof j.answer === 'string') text = j.answer; }
      else text += line;
    }
  }
  if (buf.trim()) text += buf;
  return { text: text.trim(), sources: (first && first.sources) || [], cached: !!(first && first.cached), ms: Date.now() - t0, firstToken };
}

(async () => {
  const out = [];
  for (const q of QUESTIONS) {
    const row = { q };
    for (const t of targets) {
      row[t.label] = await ask(t.url, q);
      const r = row[t.label];
      process.stdout.write(`\n### ${q}\n--- ${t.label} (${r.ms} ms, first token ${r.firstToken ?? '-'} ms${r.cached ? ', cached' : ''})\n${r.error || r.text}\n`);
      if (r.sources && r.sources.length) process.stdout.write(`sources: ${r.sources.map(s => s.url || s.source || s).join(' | ')}\n`);
    }
    out.push(row);
    fs.writeFileSync('ab-docsbot.json', JSON.stringify(out, null, 2));
  }
  console.log('\nwritten ab-docsbot.json');
})();
