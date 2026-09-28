// The decision layer around the model. A 1B-active model follows a rule it was
// trained on most of the time; code follows it every time. So the decisions
// that must always hold live here, not in the weights:
//
//   enrichTool()  - tools answer with the decision already made: the marketplace
//                   size that fits what the user asked for, the warnings a quote
//                   carries. The model relays tool results well; it is poor at
//                   deriving them.
//   checkReply()  - every final reply is checked before the user sees it. A
//                   failed check goes back to the model once with the reason;
//                   what still fails is repaired in code (warning appended,
//                   runaway repetition cut).
//
// Runs in the hub (images/hub/server.js, HARNESS_MODELS) on every turn of the
// Flux AI models, and in tools/deploy-agent-eval.js --harness. The hub is
// stateless per request, so everything here derives from the messages the
// client sends: tool results are enriched in place on the way in, the reply is
// checked and repaired on the way out.

// The marketplace catalogue: a snapshot shipped next to this file (refresh with
// tools/fetch-marketplace.js --out images/hub/marketplace.json).
let CATALOGUE = (() => {
  for (const p of ['./marketplace.json', '../../finetune/data/marketplace.json']) {
    try { return require(p); } catch { /* next */ }
  }
  return [];
})();
function setCatalogue(list) { if (Array.isArray(list) && list.length) CATALOGUE = list; }

// --- what the user asked for ---------------------------------------------------------
// "about 9gb", "9 GB of ram", "16 players", "for 10 friends", "32 slots".
function wantedSize(text) {
  const t = String(text || '').toLowerCase();
  const gb = t.match(/(\d+(?:\.\d+)?)\s*(?:gb|gig|g\b)/);
  const players = t.match(/(\d+)\s*(?:players?|slots?|people|friends|users)/);
  return { gb: gb ? Number(gb[1]) : null, players: players ? Number(players[1]) : null, bedrock: /bedrock|pocket|console|xbox|playstation|switch/.test(t) };
}

const slim = (x) => ({ name: x.name, ...(x.template ? { template: x.template, tier: x.tier } : {}), category: x.category, priceUSD: x.priceUSD, instances: x.instances,
  compose: x.compose.map((c) => ({ name: c.name, repotag: c.repotag, ports: c.ports, containerPorts: c.containerPorts,
    environmentParameters: c.environmentParameters, containerData: c.containerData, cpu: c.cpu, ram: c.ram, hdd: c.hdd,
    ...(c.userEnvironmentParameters && c.userEnvironmentParameters.length ? { userEnvironmentParameters: c.userEnvironmentParameters } : {}) })) });
const ramOf = (x) => x.compose.reduce((s, c) => s + (Number(c.ram) || 0), 0);
const slotsOf = (x) => { const m = x.name.match(/(\d+)\s*slots?/i); return m ? Number(m[1]) : null; };

// Pick the one catalogue entry that fits: the smallest size at or above what was
// asked for, from the paid (Games) ladder when one exists, Java unless the user
// said Bedrock. Returns null when the request names no size.
function pickSize(matches, want) {
  if (!matches.length || (!want.gb && !want.players)) return null;
  let pool = matches.filter((x) => want.bedrock === /bedrock/i.test(x.name));
  if (!pool.length) pool = matches;
  const games = pool.filter((x) => x.category === 'Games');
  if (games.length) pool = games;
  if (want.players) {
    const slotted = pool.filter((x) => slotsOf(x)).sort((a, b) => slotsOf(a) - slotsOf(b));
    if (slotted.length) return slotted.find((x) => slotsOf(x) >= want.players) || slotted[slotted.length - 1];
  }
  if (want.gb) {
    const byRam = [...pool].sort((a, b) => ramOf(a) - ramOf(b));
    return byRam.find((x) => ramOf(x) >= want.gb * 1000 * 0.95) || byRam[byRam.length - 1];
  }
  return null;
}

// Every size a template result offers, each shaped like a catalogue entry so
// pickSize can compare them. The marketplace sells games two ways: one listing
// per size (Minecraft9GB, 3 instances; in the shipped snapshot) and one listing
// with tiers inside it (MinecraftServer: "Minecraft 8GB" at $4.99 on 2
// instances), which is how the web app's flux_get_template returns them. A tier
// is the template's compose with that tier's resources and environment.
function sizeOptions(listed) {
  const byName = new Map(CATALOGUE.map((x) => [String(x.name).toLowerCase(), x]));
  const out = [];
  for (const t of listed) {
    if (!t || typeof t !== 'object') continue;
    const tiers = Array.isArray(t.tiers) ? t.tiers : [];
    if (tiers.length && Array.isArray(t.compose)) {
      for (const tier of tiers) {
        out.push({
          name: `${t.name} ${tier.name}`.trim(), template: t.name, tier: tier.name, category: t.category,
          priceUSD: tier.priceUSD ?? tier.price ?? t.priceUSD, instances: tier.instances ?? t.instances,
          compose: t.compose.map((c) => {
            const tc = (tier.components || []).find((k) => k.name === c.name) || {};
            return { ...c, cpu: tc.cpu ?? c.cpu, ram: tc.ram ?? c.ram, hdd: tc.hdd ?? c.hdd,
              environmentParameters: tc.environmentParameters && tc.environmentParameters.length ? tc.environmentParameters : c.environmentParameters };
          }),
        });
      }
      continue;
    }
    const full = byName.get(String(t.name || t.slug || '').toLowerCase()) || (Array.isArray(t.compose) ? t : null);
    if (full) out.push(full);
  }
  return out;
}

// --- tool results with the decision made --------------------------------------------------
function componentsOf(args) {
  const sp = args.spec || args;
  const comps = sp.components || (typeof sp.compose === 'string' ? JSON.parse(sp.compose) : sp.compose) || [];
  return Array.isArray(comps) ? comps : [];
}

// Each warning is a sentence written for the user, with a key so it is given
// once per conversation: v10 repeated the 30-instances warning on every later
// edit of the same app, which reads as nagging. How to use them is said once,
// in the result's instruction field, never inside the warning text - the model
// copied "tell the user this" into its reply as "one thing to get across to the
// user yourself".
function quoteWarnings(args, userText) {
  const sp = args.spec || args;
  const n = Number(sp.instances ?? args.instances);
  const comps = componentsOf(args);
  const stateful = comps.some((c) => c.containerData || /minecraft|palworld|valheim|rust|terraria|ark|factorio|postgres|mysql|mariadb|mongo|redis/i.test(`${c.image || c.repotag || ''}`));
  const w = [];
  if (n >= 5) {
    w.push({ key: `many:${n}`, text: `${n} instances means ${n} separate running copies of the app, each with its own data - for a game server, ${n} separate worlds rather than one bigger server. More instances add redundancy, not capacity, so check that ${n} copies is what you want.` });
  }
  if (n === 1) {
    w.push({ key: 'single', text: `With one instance there is no standby: if that node goes offline or the app is moved, it is down until it restarts elsewhere${stateful ? ', and data that is not synchronised (a g: or r: flag on containerData) comes back empty, so the world or database is lost' : ''}. Three instances, the marketplace default, avoid that.` });
  }
  if (/private|our registry|internal registry|not public/i.test(userText || '') && comps.some((c) => /^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?\//i.test(String(c.image || c.repotag || '')))) {
    w.push({ key: 'private', text: 'A private registry image needs your registry credentials in the repoauth field of the deploy form - type them there yourself, never into the chat. With credentials the app becomes an enterprise app that only ArcaneOS nodes run.' });
  }
  const seen = new Set();
  for (const c of comps) {
    const key = `${c.name || ''}|${c.image || c.repotag || ''}`;
    if (seen.has(key)) w.push({ key: `dup:${key}`, text: `Two components are identical (${c.image || c.repotag}); an app needs one component per container, so the duplicate should go.` });
    seen.add(key);
  }
  return w;
}

// --- diagnosis ----------------------------------------------------------------------------------
// flux_diagnose_app returns raw facts per component (see docs/flux-diagnose-app.md):
// the last exit (time, exit code, OOM flag), restart count, memory peak against
// the limit, disk use against hdd, the end of the log. The cause is decided
// here, not by the model: asked "why did palworld-friends restart?", v10 read
// only the log, saw "Killed" and answered "most likely running out of disk".
const ceilTo = (n, step) => Math.ceil(n / step) * step;
function playersOf(comp) {
  const env = (comp.env || comp.environmentParameters || []).join(' ');
  const e = env.match(/(?:MAX_)?PLAYERS=(\d+)/i);
  if (e) return Number(e[1]);
  const l = (comp.logTail || []).join('\n').match(/\((\d+)\s*\/\s*\d+\)/g);
  return l ? Number(l[l.length - 1].match(/\d+/)[0]) : null;
}
// The marketplace RAM for this image at the player count, when it sells slot sizes.
function catalogueRamFor(image, players) {
  if (!players) return null;
  const img = String(image || '').replace(/:latest$/, '');
  const rungs = CATALOGUE.filter((x) => slotsOf(x) && x.compose.some((c) => String(c.repotag).replace(/:latest$/, '') === img))
    .sort((a, b) => slotsOf(a) - slotsOf(b));
  const rung = rungs.find((x) => slotsOf(x) >= players) || rungs[rungs.length - 1];
  return rung ? { ramMB: ramOf(rung), name: rung.name, slots: slotsOf(rung) } : null;
}
const at = (t) => (t ? `${String(t).slice(11, 16)} UTC` : 'recently');
function diagnoseComponent(c) {
  const lim = c.limits || {};
  const last = (c.state && c.state.lastExit) || null;
  const mem = c.memory || {}; const disk = c.disk || {};
  const log = (c.logTail || []).join('\n');
  const nearMem = mem.peakMB && lim.ramMB && mem.peakMB >= 0.95 * lim.ramMB;
  if ((last && (last.oomKilled || (last.exitCode === 137 && nearMem))) || (!last && nearMem && /killed|out of memory/i.test(log))) {
    const players = playersOf(c);
    const cat = catalogueRamFor(c.image, players);
    const ram = Math.min(59000, ceilTo(Math.max(lim.ramMB * 1.5, cat ? cat.ramMB : 0), 1000));
    return { component: c.name, cause: 'out of memory',
      detail: `It used its whole ${lim.ramMB} MB memory limit${mem.peakAt ? ` (peak ${mem.peakMB} MB at ${at(mem.peakAt)})` : ''} and was killed${last ? ` at ${at(last.at)}` : ''}; Flux restarted it.`,
      fix: { field: 'ram', from: lim.ramMB, to: ram,
        why: cat ? `${players} players; the marketplace sizes ${cat.slots} players at ${cat.ramMB} MB, so ${ram} MB leaves headroom.` : `${ram} MB is half as much again as the limit it hit.` } };
  }
  if ((disk.usedGB && lim.hddGB && disk.usedGB >= 0.95 * lim.hddGB) || /no space left on device/i.test(log)) {
    const hdd = ceilTo((lim.hddGB || 10) * 1.5, 5);
    return { component: c.name, cause: 'disk full',
      detail: `Its disk is full (${disk.usedGB || '?'} of ${lim.hddGB} GB)${last ? `; it stopped at ${at(last.at)}` : ''} and could not write.`,
      fix: { field: 'hdd', from: lim.hddGB, to: hdd, why: `${hdd} GB is half as much again as the disk it filled.` } };
  }
  if (last && last.exitCode === 0) {
    return { component: c.name, cause: 'exited on its own',
      detail: `The process finished by itself at ${at(last.at)} (exit code 0) and Flux started it again. That is the app's own behaviour, not a failure of the node.` };
  }
  if (last && last.exitCode) {
    const errLine = (c.logTail || []).slice().reverse().find((l) => /error|exception|fatal|panic|not set|denied|refused|cannot|failed/i.test(l));
    return { component: c.name, cause: 'crashed',
      detail: `The app crashed at ${at(last.at)} (exit code ${last.exitCode})${c.state.restartCount > 2 ? ` and has restarted ${c.state.restartCount} times` : ''}.${errLine ? ` The log's last error: "${errLine.trim().slice(0, 160)}"` : ''}` };
  }
  if (c.state && c.state.startedAt && !last) {
    const synced = /^[grs]:/.test(String(c.containerData || ''));
    return { component: c.name, cause: 'moved to another node',
      detail: `No crash was recorded: this instance started fresh at ${at(c.state.startedAt)}, which is what a reschedule to another node looks like.${synced ? '' : ' Its data has no g: or r: flag, so it started with an empty volume.'}` };
  }
  return null;
}
function diagnose(result) {
  const comps = Array.isArray(result.components) ? result.components : [];
  const found = comps.map(diagnoseComponent).filter(Boolean);
  if (!found.length) return { ...result, diagnosis: { cause: 'no restart recorded', detail: 'Every component is running with no recorded crash, memory or disk problem.' } };
  const d = found[0];
  const next = d.fix
    ? `Before answering, quote the fix with flux_quote_app: the same app with ${d.fix.field} ${d.fix.to} on ${d.component}. Then give the cause, the fix and what it adds, and ask whether to prepare the change.`
    : 'Answer with this cause and what the user can do about it.';
  return { ...result, diagnosis: { ...d, ...(result.usdPerMonth ? { currentUsdPerMonth: result.usdPerMonth } : {}) }, next };
}

function enrichTool(name, args, result, ctx) {
  if (name === 'flux_diagnose_app' && result && typeof result === 'object' && !result.error && !result.diagnosis) return diagnose(result);
  const listed = result && (Array.isArray(result) ? result : result.matches || result.templates || result.results
    || (result.compose ? [result] : null));
  if (name === 'flux_get_template' && Array.isArray(listed) && listed.length) {
    const options = sizeOptions(listed);
    if (!options.length) return result;
    const want = wantedSize(ctx.userText);
    const pick = pickSize(options, want);
    // A long list of near-identical sizes is what sent v10 into a loop reciting
    // prices. Give one answer when the user named a size, a compact ladder when not.
    const ladder = options.map((x) => ({ name: x.name, priceUSD: x.priceUSD, ramMB: ramOf(x), ...(slotsOf(x) ? { slots: slotsOf(x) } : {}) }));
    if (pick) {
      return { recommended: slim(pick),
        decision: `The user asked for ${want.players ? `${want.players} players` : `about ${want.gb} GB`}; ${pick.name} is the marketplace size that fits${pick.priceUSD ? ` ($${pick.priceUSD} a month)` : ''}. Use its image, ports, cpu, ram, hdd, containerData and instances exactly.`,
        otherSizes: ladder.filter((x) => x.name !== pick.name).slice(0, 8) };
    }
    // Tiers of one game are always a size choice; separate flat listings are
    // one only when there are several of them (two could be different apps).
    if (options.length > 3 || (options.length > 1 && options.some((o) => o.tier))) return { sizes: ladder.slice(0, 16) };   // no note: v10 read "several sizes exist, name them briefly" out loud; the size question is enforced by checkReply
    return result;
  }
  if ((name === 'flux_quote_app' || name === 'ui_prefill_deploy') && result && typeof result === 'object' && !result.error) {
    const base = ctx.baseline && ctx.baseline.usd;
    // The web app's quote says {usd, months}; the MCP and the eval say usdPerMonth.
    const monthly = Number(result.usdPerMonth ?? (result.usd !== undefined ? result.usd / (Number(result.months) || 1) : NaN));
    if (name === 'flux_quote_app' && base && monthly && !result.change && Math.abs(monthly - base) >= 0.01) {
      const addM = +(monthly - base).toFixed(2); const addD = +(addM / 30).toFixed(2);
      result = { ...result, change: { fromUsdPerMonth: base, addsUsdPerMonth: addM, addsUsdPerDay: addD },
        say: `${addM > 0 ? 'Adds' : 'Saves'} about $${Math.abs(addD).toFixed(2)} per day ($${Math.abs(addM).toFixed(2)} per month); the new total is $${monthly.toFixed(2)} per month.` };
    }
    const seen = ctx.seenWarnings || new Set();
    // Already enriched (a client that echoes what the model saw): its warnings
    // were given then, so they count as said.
    if (result.warnings) { for (const x of quoteWarnings(args, ctx.userText)) seen.add(x.key); return result; }
    const w = quoteWarnings(args, ctx.userText).filter((x) => !seen.has(x.key));
    for (const x of w) seen.add(x.key);
    return w.length ? { ...result, warnings: w.map((x) => x.text), instruction: 'Pass each warning on to the user in your own words, alongside the price.' } : result;
  }
  return result;
}

// --- tool calls repaired before they run ------------------------------------------------------
// A template's sync flag is what keeps a game world alive across a node failure,
// and the model drops it when it retypes the spec (v10 quoted Minecraft9GB with
// the right size and no g:/data). When a component uses an image a template in
// this conversation defined, the flag comes from the template, not the model.
function repairCall(name, args, ctx) {
  if (!/flux_quote_app|ui_prefill_deploy|flux_build_spec/.test(name) || !ctx.templates || !ctx.templates.size) return { args, fixed: [] };
  const fixed = [];
  const fix = (c) => {
    const img = String(c.image || c.repotag || '');
    const t = ctx.templates.get(img) || ctx.templates.get(img.replace(/:latest$/, '')) || ctx.templates.get(`${img}:latest`);
    if (!t || !t.containerData) return c;
    if (String(c.containerData || '') === t.containerData) return c;
    if (/^[grs]:/.test(String(c.containerData || ''))) return c;
    fixed.push(`${img}: containerData ${t.containerData}`);
    return { ...c, containerData: t.containerData };
  };
  const out = JSON.parse(JSON.stringify(args));
  if (Array.isArray(out.components)) out.components = out.components.map(fix);
  if (out.spec && Array.isArray(out.spec.components)) out.spec.components = out.spec.components.map(fix);
  if (out.spec && Array.isArray(out.spec.compose)) out.spec.compose = out.spec.compose.map(fix);
  return { args: out, fixed };
}

// Remember the components of every template a tool returned, by image.
function noteTemplates(result, templates) {
  const entries = [result && result.recommended, ...((result && result.matches) || []), result && result.compose ? result : null].filter(Boolean);
  for (const e of entries) for (const c of e.compose || []) if (c.repotag && !templates.has(c.repotag)) templates.set(c.repotag, c);
}

// --- the reply check --------------------------------------------------------------------------
// A loop: some run of 3+ words recurring 4+ times, or a comma list whose items
// keep coming back. Returns the index to cut at, or -1.
function repetitionCut(text) {
  const t = String(text || '');
  const items = t.split(/,\s*/);
  if (items.length >= 12) {
    const counts = new Map();
    for (let i = 0; i < items.length; i += 1) {
      const k = items[i].trim().toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
      if (k && counts.get(k) >= 3) return t.split(/,\s*/).slice(0, i - 2).join(', ').length;
    }
  }
  const words = t.split(/\s+/);
  for (let n = 3; n <= 8; n += 1) {
    const seen = new Map();
    for (let i = 0; i + n <= words.length; i += 1) {
      const k = words.slice(i, i + n).join(' ').toLowerCase();
      const hits = (seen.get(k) || []).concat(i);
      seen.set(k, hits);
      if (hits.length >= 4) return words.slice(0, hits[1]).join(' ').length;
    }
  }
  return -1;
}

// What a warning must show up as in the reply for the user to have been told.
const WARNING_SIGNS = [
  [/separate running copies/, /cop(y|ies)|separate|each instance|worlds|really want|confirm/i],
  [/no standby/, /lose|lost|empty|standby|offline|risk|reschedul|migrat|moved/i],
  [/components are identical/, /duplicate|identical|one component/i],
  [/private registry image/, /repoauth|credential/i],
];

// How a reply names each diagnosed cause, and how it would claim a different one.
const CAUSE_SIGNS = {
  'out of memory': /memory|\bram\b|oom/i,
  'disk full': /disk|space|storage/i,
  crashed: /crash|error|exit/i,
  'exited on its own': /exit|finished|on its own|by itself/i,
  'moved to another node': /moved|reschedul|migrat|another node|different node/i,
  'no restart recorded': /no (restart|crash)|running|nothing/i,
};
const CAUSE_CLAIMS = {
  'out of memory': /ran out of memory|out of memory|memory limit|oom[- ]?kill/i,
  'disk full': /out of (disk|space)|disk (was |is |got )?full|no space left/i,
  'moved to another node': /moved to another node|rescheduled to/i,
};

// Money and discounts the reply states that nothing in the conversation gave it.
// v10 told a user a private-registry app "gets the enterprise discount": there
// is none, and no tool said so. A figure is sourced when it appears in a tool
// result or a user message, or is a sourced monthly figure times 12.
function numbersIn(s) {
  return new Set([...String(s || '').matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ''))).filter((n) => Number.isFinite(n)).map((n) => n.toFixed(2)));
}
function unsourced(text, source) {
  const have = numbersIn(source);
  const perDay = new Set([...have].map((v) => (Number(v) / 30).toFixed(2)));
  const ok = (n) => have.has(n.toFixed(2)) || have.has((n / 12).toFixed(2)) || perDay.has(n.toFixed(2));
  const bad = [];
  for (const m of String(text || '').matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:USD|usd|dollars)\b/g)) {
    const n = Number((m[1] || m[2]).replace(/,/g, ''));
    if (Number.isFinite(n) && !ok(n)) bad.push(m[0].trim());
  }
  if (/\bdiscount/i.test(text) && !/discount/i.test(source)) bad.push('discount');
  return [...new Set(bad)];
}
function dropSentences(text, bad) {
  if (!bad.length) return text;
  const parts = String(text).split(/(?<=[.!?])\s+/);
  const kept = parts.filter((p) => !bad.some((b) => (b === 'discount' ? /\bdiscount/i.test(p) : p.includes(b))));
  return kept.length ? kept.join(' ') : text;
}

// --- stateless use in the hub -------------------------------------------------------------------
// The hub sees one model turn per request with the whole conversation in it.
// prepare() enriches every tool result in place (the model reads the decision)
// and returns what checking this turn's reply needs.
// Something that happened to an app, not a hypothetical: "why did it restart",
// "it keeps crashing", "is down". "If the node goes offline do I lose the
// world" is a question about Flux, answered from the docs, not a diagnosis.
const DIAG_INTENT = /\b(why (did|does|is|was|has|do)\b[^?]{0,60}\b(restart|reboot|crash|down|die|stop|offline|kill)|restarted|rebooted|crashed|went down|is down|keeps? (dying|restarting|crashing|going down)|stopped working|(was|got) killed|oom[- ]?killed|is offline|not responding)/i;
function prepare(messages, tools) {
  const ctx = { templates: new Map(), warnings: [], mustAsk: false, sourceText: '', userText: '', seenWarnings: new Set(),
    baseline: {}, diagnosis: null, change: null, knownApps: new Set(),
    canDiagnose: Array.isArray(tools) && tools.some((t) => (t.function || t).name === 'flux_diagnose_app') };
  if (!Array.isArray(messages)) return ctx;
  const calls = new Map();
  let lastUser = -1;
  messages.forEach((m, i) => { if (m && m.role === 'user') lastUser = i; });
  let userText = ''; const source = [];
  messages.forEach((m, i) => {
    if (!m) return;
    if (m.role === 'user') { userText = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''); source.push(userText); return; }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        let a = tc.function && tc.function.arguments;
        if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = {}; } }
        calls.set(tc.id, { name: tc.function && tc.function.name, args: a || {} });
      }
      return;
    }
    if (m.role !== 'tool' || typeof m.content !== 'string') return;
    const call = calls.get(m.tool_call_id) || (m.name ? { name: m.name, args: {} } : null);
    let parsed; try { parsed = JSON.parse(m.content); } catch { source.push(m.content); return; }
    let out = parsed;
    if (call) {
      try { out = enrichTool(call.name, call.args, parsed, { userText, seenWarnings: ctx.seenWarnings, baseline: ctx.baseline }); } catch { out = parsed; }
      if (out && out.diagnosis && out.diagnosis.currentUsdPerMonth) ctx.baseline.usd = out.diagnosis.currentUsdPerMonth;
      if (out !== parsed) m.content = JSON.stringify(out);
    }
    noteTemplates(out, ctx.templates);
    for (const list of [out && out.yourApps, out && out.apps]) {
      if (Array.isArray(list)) for (const a of list) { const n = typeof a === 'string' ? a : a && a.name; if (n) ctx.knownApps.add(String(n)); }
    }
    source.push(m.content);
    if (i > lastUser && out && typeof out === 'object') {
      if (Array.isArray(out.warnings)) ctx.warnings.push(...out.warnings);
      if (out.sizes) ctx.mustAsk = true;
      if (out.recommended) ctx.mustAsk = false;
      if (out.diagnosis) { ctx.diagnosis = out.diagnosis; ctx.diagApp = out; }
      if (out.recommended) ctx.recommended = out.recommended;
      if (call && call.name === 'flux_quote_app' && !out.error) ctx.quoted = true;
      if (out.change) ctx.change = { ...out.change, say: out.say };
    }
  });
  ctx.userText = userText;
  // A "why did it restart" turn goes to the diagnosis tool before anything else.
  ctx.mustDiagnose = ctx.canDiagnose && DIAG_INTENT.test(userText) && !ctx.diagnosis;
  ctx.sourceText = source.join('\n');
  return ctx;
}

// The tool call the harness makes itself when the model will not: a diagnosed
// fix that has not been priced. v10 named the right fix and never quoted it, even
// when told to on a retry, so the price the user needs never existed.
function forcedCall(ctx) {
  // A template picked for the user this turn and not priced yet: quote it from
  // the template itself. v10 looped inside the quote's arguments, copying the
  // Palworld environment list until the output ran out, so the price never came.
  if (ctx && ctx.recommended && !ctx.quoted && !ctx.diagnosis) {
    const r = ctx.recommended;
    const components = (r.compose || []).map((c) => ({
      name: c.name, image: c.repotag, ports: c.ports || [], cpu: c.cpu, ram: c.ram, hdd: c.hdd,
      ...(c.containerData ? { containerData: c.containerData } : {}),
    }));
    if (components.length) {
      return { id: `harness_quote_${Date.now().toString(36)}`, type: 'function',
        function: { name: 'flux_quote_app', arguments: JSON.stringify({ components, instances: r.instances || 3 }) } };
    }
  }
  if (!ctx || !ctx.diagnosis || !ctx.diagnosis.fix || ctx.change || !ctx.diagApp || !ctx.baseline || !ctx.baseline.usd) return null;
  const f = ctx.diagnosis.fix;
  const components = (ctx.diagApp.components || []).map((c) => ({
    name: c.name, image: c.image, cpu: (c.limits || {}).cpu, ram: (c.limits || {}).ramMB, hdd: (c.limits || {}).hddGB,
    ...(c.containerData ? { containerData: c.containerData } : {}),
    ...(c.name === ctx.diagnosis.component ? { [f.field]: f.to } : {}),
  }));
  return { id: `harness_quote_${Date.now().toString(36)}`, type: 'function',
    function: { name: 'flux_quote_app', arguments: JSON.stringify({ components, instances: ctx.diagApp.instances || 3 }) } };
}

// Repair the tool calls of an OpenAI-shaped assistant message in place.
function repairMessage(msg, ctx) {
  const fixed = [];
  if (ctx && ctx.mustDiagnose && msg && Array.isArray(msg.tool_calls)) {
    const tc = msg.tool_calls.find((t) => /^flux_get_app(_logs|_stats)?$/.test(t.function.name));
    if (tc && !msg.tool_calls.some((t) => t.function.name === 'flux_diagnose_app')) {
      let a = {}; try { a = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep {} */ }
      if (a.name) {
        fixed.push(`${tc.function.name} -> flux_diagnose_app`);
        tc.function.name = 'flux_diagnose_app';
        tc.function.arguments = JSON.stringify({ name: a.name, ...(a.component ? { component: a.component } : {}) });
        msg.tool_calls = [tc];
      }
    }
  }
  // A name the account does not have, when the user's message names one it
  // does: v10 asked to diagnose "minecraft" for "my minecraft server mcworld".
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ctx && ctx.knownApps && ctx.knownApps.size) {
    const said = norm(ctx.userText);
    for (const tc of (msg && msg.tool_calls) || []) {
      if (!/^flux_(diagnose_app|get_app(_logs|_stats)?)$/.test(tc.function.name)) continue;
      let a; try { a = JSON.parse(tc.function.arguments || '{}'); } catch { continue; }
      if (!a.name || [...ctx.knownApps].some((k) => norm(k) === norm(a.name))) continue;
      const hit = [...ctx.knownApps].sort((x, y) => y.length - x.length).find((k) => norm(k).length >= 3 && said.includes(norm(k)));
      if (hit) { fixed.push(`app name ${a.name} -> ${hit}`); a.name = hit; tc.function.arguments = JSON.stringify(a); }
    }
  }
  for (const tc of (msg && msg.tool_calls) || []) {
    let a; try { a = JSON.parse(tc.function.arguments || '{}'); } catch { continue; }
    const rep = repairCall(tc.function.name, a, ctx);
    if (rep.fixed.length) { tc.function.arguments = JSON.stringify(rep.args); fixed.push(...rep.fixed); }
  }
  return fixed;
}

// --- streaming (OpenAI SSE) -------------------------------------------------------------------
// A streamed reply cannot be retried, but it can still be checked. Text is
// forwarded LAG characters behind the model, so a loop is cut before most of it
// reaches the user; tool calls are held and repaired before they are sent; at
// the end a missing warning or size question is appended, and the finish and
// usage chunks follow. write(str) sends raw SSE to the client.
//
// With retry (feedback => Promise<completion JSON | null>), a turn the checker
// has something specific to enforce - a warning to pass on, a size question, a
// diagnosis to state, a change to price - is held rather than streamed, so a
// reply that fails the check can be asked for again, as a non-streamed turn
// is. Streaming could only append a repair; the eval's scores assume the retry.
const LAG = 240;
const mustCheck = (ctx) => Boolean(ctx && ((ctx.warnings && ctx.warnings.length) || ctx.mustAsk || ctx.mustDiagnose || ctx.diagnosis || ctx.change));
function createSseTransformer(ctx, write, { onCut, retry } = {}) {
  let buf = ''; let text = ''; let sent = 0; let cut = false; let base = null; let finishing = null;
  const pending = forcedCall(ctx);
  const hold = Boolean(retry) && mustCheck(ctx);
  const tools = []; const held = [];
  const chunk = (delta) => `data: ${JSON.stringify({ ...(base || { object: 'chat.completion.chunk' }), choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;
  const flushText = (upto) => { if (upto > sent) { write(chunk({ content: text.slice(sent, upto) })); sent = upto; } };
  function event(data) {
    if (data === '[DONE]') { finish(); return; }
    let j; try { j = JSON.parse(data); } catch { write(`data: ${data}\n\n`); return; }
    if (!base && j.id) base = { id: j.id, object: j.object || 'chat.completion.chunk', created: j.created, model: j.model };
    const ch = j.choices && j.choices[0];
    if (!ch) { held.push(data); return; }                   // the usage-only chunk
    const d = ch.delta || {};
    if (Array.isArray(d.tool_calls)) {
      for (const tc of d.tool_calls) {
        const i = tc.index ?? tools.length;
        const t = tools[i] || (tools[i] = { index: i, id: '', type: 'function', function: { name: '', arguments: '' } });
        if (tc.id) t.id = tc.id;
        if (tc.function && tc.function.name) t.function.name += tc.function.name;
        if (tc.function && tc.function.arguments) t.function.arguments += tc.function.arguments;
      }
    }
    if (typeof d.content === 'string' && d.content && !cut) {
      text += d.content;
      if (pending || hold) return;                           // held: a forced call or a retry may replace it
      const c = repetitionCut(text);
      if (c >= 0) { cut = true; text = `${text.slice(0, c).replace(/[,\s]+$/, '')}.`; flushText(Math.min(text.length, Math.max(sent, c))); if (onCut) onCut(); }
      else flushText(text.length - LAG);
    }
    if (ch.finish_reason) held.push(data);
  }
  function finish() { if (!finishing) finishing = settle(); return finishing; }
  async function settle() {
    if (!tools.length && pending) tools.push({ index: 0, ...pending });
    if (!tools.length && hold) {
      // Check the whole reply first; ask once more when it fails.
      const v = checkReply(text, ctx);
      if (!v.ok) {
        let second = null;
        try { second = await retry(v.feedback); } catch { second = null; }
        const msg = second && second.choices && second.choices[0] && second.choices[0].message;
        if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
          msg.tool_calls.forEach((tc, i) => tools.push({ index: i, id: tc.id, type: 'function', function: tc.function }));
          text = '';
        } else if (msg && typeof msg.content === 'string') {
          const v2 = checkReply(msg.content, ctx);
          text = v2.ok ? msg.content : v2.repair(msg.content);
        } else {
          text = v.repair(text);
        }
      }
      if (!tools.length) {
        const c = repetitionCut(text);
        if (c >= 0) text = `${text.slice(0, c).replace(/[,\s]+$/, '')}.`;
      }
    }
    if (tools.length) {
      const msg = { tool_calls: tools.filter(Boolean) };
      repairMessage(msg, ctx);
      if (!pending) flushText(text.length);
      write(chunk({ tool_calls: msg.tool_calls }));
      for (let i = 0; i < held.length; i += 1) held[i] = held[i].replace('"finish_reason":"stop"', '"finish_reason":"tool_calls"');
    } else if (hold) {
      flushText(text.length);                                // already checked and settled above
    } else {
      let final = text;
      const v = checkReply(text, { ...ctx, sourceText: ctx.sourceText });
      if (!v.ok) { const r = v.repair(text); if (r.startsWith(text.slice(0, sent))) final = r; }
      text = final; flushText(text.length);
    }
    if (!held.some((h) => /finish_reason/.test(h))) held.unshift(JSON.stringify({ ...(base || {}), choices: [{ index: 0, delta: {}, finish_reason: tools.length ? 'tool_calls' : 'stop' }] }));
    for (const h of held) write(`data: ${h}\n\n`);
    write('data: [DONE]\n\n');
  }
  return {
    push(str) {
      buf += str;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
        if (line.startsWith('data:')) event(line.slice(5).trim());
        else if (line.startsWith(':')) write(`${line}\n\n`);   // keepalive comments pass through
      }
    },
    end() { if (buf.trim().startsWith('data:')) event(buf.trim().slice(5).trim()); return finish(); },
    get cut() { return cut; },
  };
}

// A non-streamed completion as the SSE a streamed one would have sent, so a
// reply the hub had to fetch again (a malformed tool call retried) reaches a
// streaming client in the shape it asked for, through the same transformer.
function completionToSse(j) {
  const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const base = { id: j.id || `chatcmpl-${Date.now().toString(36)}`, object: 'chat.completion.chunk', created: j.created || Math.floor(Date.now() / 1000), model: j.model };
  const ev = (o) => `data: ${JSON.stringify({ ...base, ...o })}\n\n`;
  let out = '';
  if (msg.content) out += ev({ choices: [{ index: 0, delta: { role: 'assistant', content: msg.content }, finish_reason: null }] });
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
    out += ev({ choices: [{ index: 0, delta: { tool_calls: msg.tool_calls.map((tc, i) => ({ index: i, id: tc.id, type: 'function', function: tc.function })) }, finish_reason: null }] });
  }
  out += ev({ choices: [{ index: 0, delta: {}, finish_reason: msg.tool_calls && msg.tool_calls.length ? 'tool_calls' : 'stop' }] });
  if (j.usage) out += ev({ choices: [], usage: j.usage });
  return `${out}data: [DONE]\n\n`;
}

// Returns { ok } or { ok: false, feedback, repair } where feedback goes back to
// the model for one retry and repair(text) is applied if the retry fails too.
function checkReply(text, ctx) {
  const problems = []; const repairs = [];
  const cut = repetitionCut(text);
  if (cut >= 0) {
    problems.push('Your reply started repeating itself. Answer again in at most three sentences, and list each option once.');
    repairs.push((t) => { const c = repetitionCut(t); return c >= 0 ? `${t.slice(0, c).replace(/[,\s]+$/, '')}.` : t; });
  }
  if (ctx.mustAsk && !/(how many|how much|which size|what size|players|memory)[^.?!]*\?/i.test(text)) {
    problems.push('The user did not say how big the server should be. Do not pick a size: name the sizes briefly and ask how many players or how much memory they want.');
    repairs.push((t) => `${t.trim()}\n\nHow many players do you expect, or how much memory do you want? I will pick the matching size.`);
  }
  for (const w of ctx.warnings || []) {
    const sign = WARNING_SIGNS.find(([re]) => re.test(w));
    if (sign && !sign[1].test(text)) {
      problems.push(`The tool returned a warning you left out. Tell the user, in your own words: "${w}"`);
      repairs.push((t) => `${t.trim()}\n\nNote: ${w}`);
    }
  }
  if (ctx.mustDiagnose) {
    problems.push('The user asked why their app restarted or went down. Call flux_diagnose_app with the app name first and answer from its diagnosis; do not guess a cause.');
    repairs.push((t) => t);
  }
  if (ctx.diagnosis && ctx.diagnosis.cause) {
    const cause = ctx.diagnosis.cause;
    const said = CAUSE_SIGNS[cause];
    const wrong = Object.entries(CAUSE_CLAIMS).filter(([k]) => k !== cause).find(([, re]) => re.test(text));
    if ((said && !said.test(text)) || wrong) {
      problems.push(`The diagnosis says the cause is "${cause}": ${ctx.diagnosis.detail} State that cause${wrong ? `, not ${wrong[0]}` : ''}.`);
      const fix = ctx.diagnosis.fix ? ` Raising ${ctx.diagnosis.fix.field === 'ram' ? 'memory' : 'disk'} to ${ctx.diagnosis.fix.to} ${ctx.diagnosis.fix.field === 'ram' ? 'MB' : 'GB'} fixes it: ${ctx.diagnosis.fix.why}` : '';
      repairs.push((t) => `${cause[0].toUpperCase()}${cause.slice(1)}: ${ctx.diagnosis.detail}${fix}${wrong ? '' : `\n\n${t.trim()}`}`);
    }
  }
  if (ctx.diagnosis && ctx.diagnosis.fix && !ctx.change && ctx.baseline && ctx.baseline.usd) {
    const f = ctx.diagnosis.fix;
    problems.push(`Before answering, call flux_quote_app for the fix - the same app with ${f.field} ${f.to} on ${ctx.diagnosis.component} - so you can say what it adds.`);
    repairs.push((t) => t);
  }
  if (ctx.change) {
    const addD = Math.abs(ctx.change.addsUsdPerDay).toFixed(2); const addM = Math.abs(ctx.change.addsUsdPerMonth).toFixed(2);
    const total = ctx.change.fromUsdPerMonth + ctx.change.addsUsdPerMonth;
    const totalAsDelta = new RegExp(`\\$\\s?${total.toFixed(2).replace('.', '\\.')}[^.]{0,25}\\b(more|extra|increase)|\\b(adds?|more|extra|increase)\\b[^.]{0,25}\\$\\s?${total.toFixed(2).replace('.', '\\.')}`, 'i');
    if (!(text.includes(addD) || text.includes(addM)) || totalAsDelta.test(text)) {
      problems.push(`State what the change adds, not the new total as if it were the increase: ${ctx.change.say}`);
      repairs.push((t) => `${dropSentences(t, [`$${total.toFixed(2)}`]).trim()}\n\n${ctx.change.say}`);
    }
  }
  if (ctx.sourceText !== undefined) {
    const bad = unsourced(text, ctx.sourceText);
    if (bad.length) {
      problems.push(`You stated ${bad.map((b) => `"${b}"`).join(', ')}, which no tool result or user message gave you. State only prices, figures and discounts a tool returned.`);
      repairs.push((t) => dropSentences(t, unsourced(t, ctx.sourceText)));
    }
  }
  if (!problems.length) return { ok: true };
  return { ok: false, feedback: problems.join(' '), repair: (t) => repairs.reduce((acc, f) => f(acc), t) };
}

module.exports = { completionToSse, forcedCall, prepare, repairMessage, createSseTransformer, setCatalogue, unsourced, enrichTool, checkReply, repairCall, noteTemplates, wantedSize, pickSize, quoteWarnings, repetitionCut };
