#!/usr/bin/env node
/**
 * Retrieval hit rate (research/cpu-native-models.md, experiment E5).
 *
 * Asks a docs bot the questions below and checks whether the source the
 * answer *should* cite appears among the streamed `sources` (the bot's top-K
 * after hybrid retrieval). This isolates the embedder + retrieval from the
 * chat model: the same corpus indexed with two embedders can be compared by
 * this number alone. Run it against two bots and diff the tables.
 *
 *   node tools/eval-retrieval.js http://<host>:<docsbot port> [--rank]
 *
 * --rank also prints the rank of the first matching source.
 */
const HOST = process.argv[2];
if (!HOST) { console.error('usage: node tools/eval-retrieval.js http://host:port'); process.exit(1); }
const base = HOST.startsWith('http') ? HOST : `http://${HOST}`;
// --only <regex>: run the subset of questions whose text matches.
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg >= 0 ? new RegExp(process.argv[onlyArg + 1], 'i') : null;

// expect: regex over "<tier> <source path> <heading>" of a hit.
const CASES = [
  { q: 'How much RAM can an application use on a NIMBUS node?', expect: /flux-facts\.md.*by node tier|app-spec-v8.*Resource limits/i },
  { q: 'What is the maximum size of a container image?', expect: /flux-facts\.md|app-spec-v8\.md/i },
  { q: 'How many instances can an application have?', expect: /flux-facts\.md|app-spec-v8\.md/i },
  { q: 'What is the maximum expire value for an application, in blocks?', expect: /flux-facts\.md|app-spec-v8\.md/i },
  { q: 'What is the collateral required to run a Stratus node?', expect: /fluxnodes|flux-facts\.md.*collateral|whitepaper/i },
  { q: 'What is SSP Wallet and how does its two-factor security work?', expect: /ssp-docs|sspwallet\.io|ssp-wallet/i },
  { q: 'How do I deploy an application on Flux?', expect: /flux-docs\/docs\/fluxcloud|cloud\.runonflux|runonflux\.com/i },
  { q: 'What is FluxEdge?', expect: /fluxedge/i },
  { q: 'How do I run a Flux node on ArcaneOS?', expect: /arcaneos/i },
  { q: 'What is Zelcore?', expect: /zelcore/i },
];

async function sources(q) {
  const res = await fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q }), signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  const decoder = new TextDecoder();
  let buf = '';
  // The sources line comes first. The rest of the stream is drained rather
  // than cancelled: a burst of cancelled streams coincided with the rig's
  // chat server exiting, and draining costs a few seconds per question.
  let first = null;
  for await (const piece of res.body) {
    buf += decoder.decode(piece, { stream: true });
    const nl = buf.indexOf('\n');
    if (!first && nl >= 0) first = JSON.parse(buf.slice(0, nl));
  }
  return (first && first.sources) || [];
}

(async () => {
  let hits = 0;
  let rankSum = 0;
  console.log(`retrieval hit rate against ${base}\n`);
  for (const c of CASES.filter(c => !ONLY || ONLY.test(c.q))) {
    const t = Date.now();
    let srcs;
    // Public mode rate-limits to 6 questions per minute per IP; wait it out
    // rather than count a 429 as a miss.
    for (let attempt = 0; ; attempt += 1) {
      try { srcs = await sources(c.q); break; } catch (err) {
        if (/^429/.test(err.message) && attempt < 3) { await new Promise(r => { setTimeout(r, 61000); }); continue; }
        console.log(`  ERROR  ${c.q}  (${err.message})`); srcs = null; break;
      }
    }
    if (!srcs) continue;
    const rank = srcs.findIndex(s => c.expect.test(`${s.tier} ${s.source} ${s.heading || ''}`)) + 1;
    if (rank) { hits += 1; rankSum += rank; }
    console.log(`  ${rank ? `HIT@${rank}` : 'MISS '}  ${c.q}  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    if (!rank) srcs.slice(0, 4).forEach(s => console.log(`          got ${s.tier.padEnd(10)} ${s.source.slice(0, 90)}`));
  }
  console.log(`\n${hits}/${CASES.filter(c => !ONLY || ONLY.test(c.q)).length} hit${hits ? `, mean rank of hits ${(rankSum / hits).toFixed(2)}` : ''}`);
})();
