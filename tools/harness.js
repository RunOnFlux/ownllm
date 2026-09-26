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
// Used by tools/deploy-agent-eval.js --harness; meant to move into the gate.

const CATALOGUE = (() => { try { return require('../finetune/data/marketplace.json'); } catch { return []; } })();

// --- what the user asked for ---------------------------------------------------------
// "about 9gb", "9 GB of ram", "16 players", "for 10 friends", "32 slots".
function wantedSize(text) {
  const t = String(text || '').toLowerCase();
  const gb = t.match(/(\d+(?:\.\d+)?)\s*(?:gb|gig|g\b)/);
  const players = t.match(/(\d+)\s*(?:players?|slots?|people|friends|users)/);
  return { gb: gb ? Number(gb[1]) : null, players: players ? Number(players[1]) : null, bedrock: /bedrock|pocket|console|xbox|playstation|switch/.test(t) };
}

const slim = (x) => ({ name: x.name, category: x.category, priceUSD: x.priceUSD, instances: x.instances,
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

// --- tool results with the decision made --------------------------------------------------
function componentsOf(args) {
  const sp = args.spec || args;
  const comps = sp.components || (typeof sp.compose === 'string' ? JSON.parse(sp.compose) : sp.compose) || [];
  return Array.isArray(comps) ? comps : [];
}

function quoteWarnings(args, userText) {
  const sp = args.spec || args;
  const n = Number(sp.instances ?? args.instances);
  const comps = componentsOf(args);
  const stateful = comps.some((c) => c.containerData || /minecraft|palworld|valheim|rust|terraria|ark|factorio|postgres|mysql|mariadb|mongo|redis/i.test(`${c.image || c.repotag || ''}`));
  const w = [];
  if (n >= 5) {
    w.push(`${n} instances means ${n} separate running copies of the app, each with its own data. For a game server that is ${n} separate worlds, not one bigger server; more instances add redundancy, not capacity. Tell the user this and ask them to confirm ${n} copies before they sign.`);
  }
  if (n === 1) {
    w.push(`One instance has no standby: if that node goes offline or the app is rescheduled, the app is down until it restarts elsewhere${stateful ? ', and data that is not synchronised (g: or r: on containerData) comes back empty - the world or database is lost' : ''}. The minimum for anything that matters is 3 instances (the marketplace default). Tell the user this risk alongside the price.`);
  }
  if (/private|our registry|internal registry|not public/i.test(userText || '') && comps.some((c) => /^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?\//i.test(String(c.image || c.repotag || '')))) {
    w.push('A private registry image needs registry credentials (the repoauth field), which the user types into the deploy form themselves; never ask for them in chat. Supplying them makes this an enterprise app that only ArcaneOS nodes run.');
  }
  const seen = new Set();
  for (const c of comps) {
    const key = `${c.name || ''}|${c.image || c.repotag || ''}`;
    if (seen.has(key)) w.push(`Two components are identical (${key}). A single app needs one component per container; remove the duplicate.`);
    seen.add(key);
  }
  return w;
}

function enrichTool(name, args, result, ctx) {
  if (name === 'flux_get_template' && result && Array.isArray(result.matches) && result.matches.length) {
    const byName = new Map(CATALOGUE.map((x) => [x.name, x]));
    const full = result.matches.map((m) => byName.get(m.name)).filter(Boolean);
    const want = wantedSize(ctx.userText);
    const pick = pickSize(full, want);
    // A long list of near-identical sizes is what sent v10 into a loop reciting
    // prices. Give one answer when the user named a size, a compact ladder when not.
    const ladder = full.map((x) => ({ name: x.name, priceUSD: x.priceUSD, ramMB: ramOf(x), ...(slotsOf(x) ? { slots: slotsOf(x) } : {}) }));
    if (pick) {
      return { recommended: slim(pick),
        decision: `The user asked for ${want.players ? `${want.players} players` : `about ${want.gb} GB`}; ${pick.name} is the marketplace size that fits. Use its image, ports, cpu, ram, hdd, containerData and instances exactly.`,
        otherSizes: ladder.filter((x) => x.name !== pick.name).slice(0, 8) };
    }
    if (full.length > 3) return { sizes: ladder, note: 'Several sizes exist. Name them briefly and ask which the user wants, or look one up by name.' };
    return result;
  }
  if ((name === 'flux_quote_app' || name === 'ui_prefill_deploy') && result && !result.error) {
    const w = quoteWarnings(args, ctx.userText);
    return w.length ? { ...result, warnings: w } : result;
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
  [/no standby/, /lose|lost|empty|standby|offline|risk|reschedul|migrat/i],
  [/components are identical/, /duplicate|identical|one component/i],
  [/private registry image/, /repoauth|credential/i],
];

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
      problems.push(`The tool returned a warning you did not pass on: "${w}" Include it in your reply.`);
      repairs.push((t) => `${t.trim()}\n\nNote: ${w.replace(/ Tell the user.*$| Remove the duplicate\.$/, '').replace(/ and ask them to confirm.*$/, '').replace(/; never ask for them in chat/, '')}`);
    }
  }
  if (!problems.length) return { ok: true };
  return { ok: false, feedback: problems.join(' '), repair: (t) => repairs.reduce((acc, f) => f(acc), t) };
}

module.exports = { enrichTool, checkReply, repairCall, noteTemplates, wantedSize, pickSize, quoteWarnings, repetitionCut };
