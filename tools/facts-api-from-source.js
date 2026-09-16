#!/usr/bin/env node
/**
 * FluxOS API reference, generated from ZelBack/src/routes.js so it cannot
 * drift from the code. One line per route: method, path, cache, and whether
 * it needs a signed session (verifyPrivilege level) - the things a user or an
 * agent asks ("which endpoint lists an app's instances", "does it need
 * login"). Grouped by path prefix under headings that carry the public API
 * base so answers can point at api.runonflux.io.
 *
 *   node tools/facts-api-from-source.js ~/repos/flux > images/docsbot/docs/flux-api.md
 */
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] || path.join(process.env.HOME, 'repos', 'flux');
const src = fs.readFileSync(path.join(repo, 'ZelBack', 'src', 'routes.js'), 'utf8');
const lines = src.split('\n');
const routes = [];
for (let i = 0; i < lines.length; i += 1) {
  const m = /^\s*app\.(get|post|put|delete)\('([^']+)'/.exec(lines[i]);
  if (!m) continue;
  const body = lines.slice(i, i + 6).join(' ');
  const cache = (/cache\('([^']+)'\)/.exec(body) || [])[1];
  const svc = (/\b([a-zA-Z]+Service|[a-zA-Z]+Helper|[a-zA-Z]+Manager)\.([a-zA-Z]+)\(/.exec(body) || []);
  const priv = (/verifyPrivilege\('([^']+)'/.exec(body) || [])[1];
  routes.push({ method: m[1].toUpperCase(), route: m[2], cache, handler: svc[1] ? `${svc[1]}.${svc[2]}` : '', priv });
}
const groups = new Map();
for (const r of routes) { const g = r.route.split('/')[1] || '/'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
const GROUP_DOC = {
  apps: 'application registration, lookup, control and logs', daemon: 'the Flux daemon (blockchain node) RPC', flux: 'this FluxOS node: version, network, peers, updates', id: 'login: loginphrase, verifylogin, sessions', benchmark: 'node benchmark', explorer: 'the built-in explorer', backup: 'app backups', zelnode: 'legacy node endpoints', fluxshare: 'FluxShare storage', syncthing: 'app data sync', ws: 'websocket entry points',
};
let out = '# FluxOS API reference (generated from ZelBack/src/routes.js)\n\n'
  + 'Every FluxOS node serves this HTTP API on port 16127 (or the node\'s configured API port), and https://api.runonflux.io fronts a healthy node with the same paths. Responses are JSON with status "success" or "error" and a data field. Management endpoints (control, logs, update, install, remove) need a signed session: request a loginphrase, sign it with the Flux ID (ZelID) that owns the app or node, and send it as the zelidauth header; read-only listing endpoints are public.\n';
const PRIV = { user: 'signed session (any logged-in user)', appowner: 'signed session (app owner)', appownerabove: 'signed session (app owner or higher)', admin: 'signed session (node admin)', adminandfluxteam: 'signed session (admin or Flux team)', fluxteam: 'signed session (Flux team)' };
for (const [g, rs] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  out += `\n## /${g} endpoints${GROUP_DOC[g] ? ` - ${GROUP_DOC[g]}` : ''} <https://api.runonflux.io/${g}>\n`;
  // Privilege checks mostly live inside the service handlers, not in
  // routes.js, so an absent check here does not mean public: say nothing.
  for (const r of rs) out += `- ${r.method} ${r.route}${r.priv ? ` - ${PRIV[r.priv] || `signed session (${r.priv})`}` : ''}${r.cache ? `, cached ${r.cache}` : ''}${r.handler ? `; handled by ${r.handler}` : ''}\n`;
}
process.stdout.write(out);
console.error(`${routes.length} routes in ${groups.size} groups`);
