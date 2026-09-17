/**
 * Tool surfaces and system prompts the deploy agent is trained across.
 *
 * v1 was trained on one system prompt and one tool schema and stopped
 * calling tools the moment either changed. Every v2 dialogue samples a
 * surface from here: a system prompt variant, a schema variant (compact,
 * MCP-derived core, full set, shuffled order, reworded descriptions), so the
 * model learns the task rather than the wording. The MCP-derived variants are
 * built from finetune/tools.json (the real server's schemas, keys stripped),
 * so the surface the eval and the hosted MCP use is in the training set too.
 */
const fs = require('node:fs');
const path = require('node:path');
const COMPACT = require('./tools-compact');
const MCP = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8'));

const SYSTEM_PROMPTS = [
  'You are Flux AI, the assistant inside Flux Cloud. You help people run apps on the Flux decentralized cloud with the tools. Prices are USD per month. Get a quote with flux_quote_app and show it before any deployment; call flux_deploy_app with confirm=true only after the user has agreed to that quote. The user is signed in: never ask for keys, wallets or addresses. Be brief.',
  'You are Flux AI inside Flux Cloud. Help the user run apps on the Flux decentralized cloud using the tools. Prices are USD per month. Always get a quote with flux_quote_app and show it before deploying; deploy only after the user agrees, with confirm=true. Be brief. Use tools rather than guessing numbers. The user is signed in; their Flux ID and payment are handled by the app, so never ask for keys or addresses.',
  'Flux Cloud deployment assistant. Tools are available for building specifications, quoting, deploying and managing applications on the Flux network. Rules: quote before deploy; deploy (confirm=true) only after explicit user agreement; never invent prices or resources - read them from tool results; keys and payment are handled by the platform. Keep answers short.',
  'You help users of Flux Cloud deploy and manage Docker applications on Flux, a decentralized cloud of independent nodes. Use the provided functions. Show the price from flux_quote_app and wait for the user to agree before calling flux_deploy_app with confirm set to true. Do not ask for private keys. Answer concisely, in the user\'s language if it is not English.',
  'You are the AI in the Flux Cloud chat. When someone describes something to run, size it sensibly (or ask if the app is unclear), build the spec, quote it, and only deploy after they say yes. Report the exact figures the tools return. Never request wallet keys; the user is already signed in.',
  'Assistant for cloud.runonflux.com. Capabilities: estimate costs, deploy apps, check status, read logs, restart or cancel apps, via tools. Spending FLUX requires the user\'s explicit go-ahead after seeing the quote. Be direct and brief.',
];

// Wording variants for tool descriptions, applied to the compact schema so
// the same tools appear with different prose.
const REWORD = [
  (d) => d,
  (d) => d.replace(/Build a valid app specification from images, ports and resources\./, 'Create the application spec (v8) from the images, ports, environment and resources.')
    .replace(/USD price per term for a spec\. Always before deploying\./, 'Get the price in USD and FLUX for a specification. Call this before any deployment.')
    .replace(/Register the app and pay\. Spends FLUX only with confirm=true, after the user agreed to the quote\./, 'Deploy the application. Without confirm=true this only validates; with confirm=true it registers the app and pays.'),
  (d) => d.replace(/\.$/, '').toLowerCase().replace(/^([a-z])/, (m) => m.toUpperCase()),
];

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function shuffle(a, rnd) { const b = a.slice(); for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

const CORE = ['flux_get_pricing', 'flux_build_spec', 'flux_quote_app', 'flux_deploy_app', 'flux_wait_for_app'];
const KEY_PARAMS = ['fluxIdPrivateKey', 'paymentPrivateKey'];
function mcpTools(names) {
  return MCP.filter((t) => !names || names.includes(t.name)).map((t) => {
    const schema = clone(t.inputSchema || { type: 'object', properties: {} });
    schema.properties = Object.fromEntries(Object.entries(schema.properties || {}).filter(([k]) => !KEY_PARAMS.includes(k)));
    schema.required = (schema.required || []).filter((k) => !KEY_PARAMS.includes(k));
    return { type: 'function', function: { name: t.name, description: t.description.replace(/\b(Requires|Needs) (the )?(Flux ID|fluxIdPrivateKey|payment)[^.]*\./gi, '').trim(), parameters: schema } };
  });
}

/** Pick a surface: { system, tools, kind }. `rnd` is the caller's PRNG. */
function sample(rnd) {
  const system = SYSTEM_PROMPTS[Math.floor(rnd() * SYSTEM_PROMPTS.length)];
  const r = rnd();
  let tools; let kind;
  if (r < 0.40) { kind = 'compact'; tools = clone(COMPACT).map((t) => { t.function.description = REWORD[Math.floor(rnd() * REWORD.length)](t.function.description); return t; }); }
  else if (r < 0.60) { kind = 'compact-core'; tools = clone(COMPACT).filter((t) => [...CORE, 'flux_list_my_apps', 'flux_get_app', 'flux_get_app_logs', 'flux_control_app', 'flux_cancel_app', 'flux_get_network_info'].includes(t.function.name)).slice(0, 5 + Math.floor(rnd() * 6)); }
  else if (r < 0.85) { kind = 'mcp-core'; tools = mcpTools(CORE); }
  else { kind = 'mcp-full'; tools = mcpTools(null); }
  if (rnd() < 0.5) tools = shuffle(tools, rnd);
  return { system, tools, kind };
}

module.exports = { sample, SYSTEM_PROMPTS, COMPACT, mcpTools, CORE };
