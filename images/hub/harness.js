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

function enrichTool(name, args, result, ctx) {
  const listed = result && (Array.isArray(result) ? result : result.matches || result.templates || result.results);
  if (name === 'flux_get_template' && Array.isArray(listed) && listed.length) {
    const byName = new Map(CATALOGUE.map((x) => [String(x.name).toLowerCase(), x]));
    const full = listed.map((m) => byName.get(String(m.name || m.slug || '').toLowerCase())).filter(Boolean);
    if (!full.length) return result;
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
  if ((name === 'flux_quote_app' || name === 'ui_prefill_deploy') && result && typeof result === 'object' && !result.error) {
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

// Money and discounts the reply states that nothing in the conversation gave it.
// v10 told a user a private-registry app "gets the enterprise discount": there
// is none, and no tool said so. A figure is sourced when it appears in a tool
// result or a user message, or is a sourced monthly figure times 12.
function numbersIn(s) {
  return new Set([...String(s || '').matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ''))).filter((n) => Number.isFinite(n)).map((n) => n.toFixed(2)));
}
function unsourced(text, source) {
  const have = numbersIn(source);
  const ok = (n) => have.has(n.toFixed(2)) || have.has((n / 12).toFixed(2));
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
function prepare(messages) {
  const ctx = { templates: new Map(), warnings: [], mustAsk: false, sourceText: '', userText: '', seenWarnings: new Set() };
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
      try { out = enrichTool(call.name, call.args, parsed, { userText, seenWarnings: ctx.seenWarnings }); } catch { out = parsed; }
      if (out !== parsed) m.content = JSON.stringify(out);
    }
    noteTemplates(out, ctx.templates);
    source.push(m.content);
    if (i > lastUser && out && typeof out === 'object') {
      if (Array.isArray(out.warnings)) ctx.warnings.push(...out.warnings);
      if (out.sizes) ctx.mustAsk = true;
      if (out.recommended) ctx.mustAsk = false;
    }
  });
  ctx.userText = userText;
  ctx.sourceText = source.join('\n');
  return ctx;
}

// Repair the tool calls of an OpenAI-shaped assistant message in place.
function repairMessage(msg, ctx) {
  const fixed = [];
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
const LAG = 240;
function createSseTransformer(ctx, write, { onCut } = {}) {
  let buf = ''; let text = ''; let sent = 0; let done = false; let cut = false; let base = null;
  const tools = []; const held = [];
  const chunk = (delta) => `data: ${JSON.stringify({ ...(base || { object: 'chat.completion.chunk' }), choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;
  const flushText = (upto) => { if (upto > sent) { write(chunk({ content: text.slice(sent, upto) })); sent = upto; } };
  function event(data) {
    if (data === '[DONE]') return finish();
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
      const c = repetitionCut(text);
      if (c >= 0) { cut = true; text = `${text.slice(0, c).replace(/[,\s]+$/, '')}.`; flushText(Math.min(text.length, Math.max(sent, c))); if (onCut) onCut(); }
      else flushText(text.length - LAG);
    }
    if (ch.finish_reason) held.push(data);
  }
  function finish() {
    if (done) return; done = true;
    if (tools.length) {
      const msg = { tool_calls: tools.filter(Boolean) };
      repairMessage(msg, ctx);
      flushText(text.length);
      write(chunk({ tool_calls: msg.tool_calls }));
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
    end() { if (buf.trim().startsWith('data:')) event(buf.trim().slice(5).trim()); finish(); },
    get cut() { return cut; },
  };
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

module.exports = { prepare, repairMessage, createSseTransformer, setCatalogue, unsourced, enrichTool, checkReply, repairCall, noteTemplates, wantedSize, pickSize, quoteWarnings, repetitionCut };
