#!/usr/bin/env node
/**
 * Read the Flux AI conversation metrics (images/metrics) as the admin.
 *
 *   node tools/metrics-report.js [--days 7]                 aggregates
 *   node tools/metrics-report.js --export [--days 30] [--rating down] > conv.jsonl
 *
 * The admin key is read from specs/ownllmmetrics-metrics.plaintext.json, never
 * printed. METRICS_URL overrides the address (default the app's FDM domain).
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const URL_BASE = (process.env.METRICS_URL || 'https://ownllmmetrics.app.runonflux.io').replace(/\/$/, '');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'specs', 'ownllmmetrics-metrics.plaintext.json'), 'utf8'));
const env = Object.fromEntries(spec.compose[0].environmentParameters.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]));
const headers = { Authorization: `Bearer ${env.ADMIN_KEY}` };
const days = opt('days', '7');

(async () => {
  if (args.includes('--export')) {
    const q = new URLSearchParams({ days, ...(opt('rating') ? { rating: opt('rating') } : {}) });
    const res = await fetch(`${URL_BASE}/admin/export?${q}`, { headers });
    if (!res.ok) throw new Error(`export: HTTP ${res.status}`);
    process.stdout.write(await res.text());
    return;
  }
  const res = await fetch(`${URL_BASE}/admin/report?days=${days}`, { headers });
  if (!res.ok) throw new Error(`report: HTTP ${res.status}`);
  const r = await res.json();
  console.log(`last ${r.days} days: ${r.conversations} conversations, ${r.turns} turns (${r.streamedTurns} streamed)`);
  console.log(`latency p50 ${r.latencyMs.p50} ms, p90 ${r.latencyMs.p90} ms, max ${r.latencyMs.max} ms`);
  console.log(`ratings: ${JSON.stringify(r.ratings)}   outcomes: ${JSON.stringify(r.outcomes)}`);
  console.log('tools:', JSON.stringify(r.tools));
  console.log('harness:', JSON.stringify(r.harness));
  if (r.ratedDown.length) {
    console.log(`\nrated down (${r.ratedDown.length}):`);
    for (const d of r.ratedDown) console.log(`  ${new Date(d.ts).toISOString()} ${d.conversation}${d.comment ? ` - ${d.comment}` : ''}`);
  }
})().catch((err) => { console.error(err.message); process.exit(1); });
