/**
 * Conversation metrics for the Flux AI assistant.
 *
 * The hub posts one record per assistant turn (POST /events, bearer
 * METRICS_KEY): the new messages of that turn with personal data masked, the
 * reply, the tools called, what the decision layer did (repairs, retries,
 * forced quotes, warnings), latency and tokens. The web app posts thumbs up or
 * down against a conversation (POST /feedback, browser, origin-checked, rate
 * limited). An admin reads aggregates (GET /admin/report) and exports
 * conversations for analysis and training (GET /admin/export).
 *
 * Storage is SQLite on the app's g: volume: FluxOS runs one primary and keeps
 * standbys in sync, so there is exactly one writer. Records older than
 * RETENTION_DAYS (365) are deleted every hour.
 *
 * Environment: METRICS_KEY (the hub's write key), ADMIN_KEY (reads),
 * ALLOWED_ORIGINS (hosts allowed to post feedback), RETENTION_DAYS,
 * DB_PATH (/data/metrics.db), FEEDBACK_RPM (per visitor, default 30).
 *
 * No dependencies: node:http, node:sqlite, node:crypto.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 8080);
const METRICS_KEY = process.env.METRICS_KEY || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 365);
const DB_PATH = process.env.DB_PATH || '/data/metrics.db';
const FEEDBACK_RPM = Number(process.env.FEEDBACK_RPM || 30);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim().toLowerCase()).filter(Boolean);
if (!METRICS_KEY || !ADMIN_KEY) {
  console.error('METRICS_KEY and ADMIN_KEY are required');
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    conversation TEXT NOT NULL,
    turn INTEGER NOT NULL,
    model TEXT, streamed INTEGER, latency_ms INTEGER,
    prompt_tokens INTEGER, completion_tokens INTEGER,
    tools TEXT, harness TEXT, outcome TEXT,
    messages TEXT, reply TEXT
  );
  CREATE INDEX IF NOT EXISTS turns_conv ON turns (conversation, turn);
  CREATE INDEX IF NOT EXISTS turns_ts ON turns (ts);
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    conversation TEXT NOT NULL,
    rating TEXT NOT NULL,
    comment TEXT
  );
  CREATE INDEX IF NOT EXISTS feedback_conv ON feedback (conversation);
`);

// --- redaction ---------------------------------------------------------------------------------
// A second line of defence: the hub masks before it sends, and this masks
// again on the way in, so a record never lands with a secret in it even if a
// client of /events forgets. The patterns are deliberately broad: a masked
// word costs an analysis nothing, a leaked key costs someone their funds.
const REDACTIONS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<private-key>'],
  [/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, '<wif-key>'],
  [/\b(?:0x)?[0-9a-fA-F]{64}\b/g, '<hex-secret>'],
  [/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, '<jwt>'],
  [/\b(?:sk|pk|rk|ghp|gho|github_pat|glpat|xox[abp]|dckr_pat)[-_][A-Za-z0-9_-]{16,}\b/g, '<token>'],
  // A BIP39 phrase: exactly 12/15/18/21/24 lowercase words of 3-8 letters. A
  // longer run of short words is prose and is left alone.
  [/\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g, (m) => ([12, 15, 18, 21, 24].includes(m.split(/\s+/).length) ? '<seed-phrase?>' : m)],
  [/\b([A-Z0-9_]*(?:KEY|PASS|PASSWORD|TOKEN|SECRET|PRIV|AUTH|MNEMONIC|SEED)[A-Z0-9_]*)=\S+/gi, '$1=<secret>'],
  [/"repoauth"\s*:\s*"[^"]*"/g, '"repoauth":"<secret>"'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>'],
  [/\b(?:t1|t3)[1-9A-HJ-NP-Za-km-z]{33}\b/g, '<flux-address>'],
  [/\b(?:bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})\b/g, '<btc-address>'],
  [/\b0x[0-9a-fA-F]{40}\b/g, '<eth-address>'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>'],
];
function redact(text) {
  let s = String(text ?? '');
  for (const [re, to] of REDACTIONS) s = s.replace(re, to);
  return s;
}
const redactJson = (v) => redact(JSON.stringify(v ?? null));

// --- helpers -----------------------------------------------------------------------------------
function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
function sameKey(given, key) {
  const a = Buffer.from(given); const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', (d) => { size += d.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); } else parts.push(d); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function originAllowed(origin) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return ALLOWED_ORIGINS.some((o) => host === o || host.endsWith(`.${o}`));
  } catch { return false; }
}
const visitors = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const v = visitors.get(ip) || { start: now, n: 0 };
  if (now - v.start > 60_000) { v.start = now; v.n = 0; }
  v.n += 1; visitors.set(ip, v);
  return v.n > FEEDBACK_RPM;
}
setInterval(() => { const cut = Date.now() - 120_000; for (const [k, v] of visitors) if (v.start < cut) visitors.delete(k); }, 60_000).unref();
const clip = (s, n) => String(s ?? '').slice(0, n);
const CONV_RE = /^[A-Za-z0-9:_-]{6,80}$/;

// --- retention ---------------------------------------------------------------------------------
function prune() {
  const cut = Date.now() - RETENTION_DAYS * 86_400_000;
  const a = db.prepare('DELETE FROM turns WHERE ts < ?').run(cut);
  const b = db.prepare('DELETE FROM feedback WHERE ts < ?').run(cut);
  if (a.changes || b.changes) console.log(`retention: removed ${a.changes} turns, ${b.changes} ratings older than ${RETENTION_DAYS} days`);
}
prune();
setInterval(prune, 3_600_000).unref();

// --- report ------------------------------------------------------------------------------------
function report(days) {
  const since = Date.now() - days * 86_400_000;
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const turns = all('SELECT tools, harness, outcome, latency_ms, streamed FROM turns WHERE ts >= ?', since);
  const count = (key) => {
    const m = new Map();
    for (const t of turns) for (const x of JSON.parse(t[key] || '[]')) { const k = String(x).split(':')[0]; m.set(k, (m.get(k) || 0) + 1); }
    return Object.fromEntries([...m].sort((a, b) => b[1] - a[1]));
  };
  const lat = turns.map((t) => t.latency_ms).filter((x) => x != null).sort((a, b) => a - b);
  const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null);
  const outcomes = {};
  for (const t of turns) outcomes[t.outcome || 'answer'] = (outcomes[t.outcome || 'answer'] || 0) + 1;
  return {
    days,
    conversations: one('SELECT COUNT(DISTINCT conversation) n FROM turns WHERE ts >= ?', since).n,
    turns: turns.length,
    streamedTurns: turns.filter((t) => t.streamed).length,
    latencyMs: { p50: pct(0.5), p90: pct(0.9), max: lat.length ? lat[lat.length - 1] : null },
    outcomes,
    tools: count('tools'),
    harness: count('harness'),
    ratings: Object.fromEntries(all('SELECT rating, COUNT(*) n FROM feedback WHERE ts >= ? GROUP BY rating', since).map((r) => [r.rating, r.n])),
    ratedDown: all(`SELECT f.conversation, f.comment, f.ts FROM feedback f WHERE f.rating = 'down' AND f.ts >= ? ORDER BY f.ts DESC LIMIT 50`, since),
  };
}

// --- server ------------------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(`ok turns=${db.prepare('SELECT COUNT(*) n FROM turns').get().n}`);
  }

  // Feedback comes from the browser: origin-checked, rate limited, no key.
  if (url.pathname === '/feedback') {
    const origin = req.headers.origin || '';
    if (origin && !originAllowed(origin)) return send(res, 403, { error: 'origin not allowed' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
    if (rateLimited(ip)) return send(res, 429, { error: 'too many ratings' });
    try {
      const b = JSON.parse((await readBody(req, 8_000)) || '{}');
      if (!CONV_RE.test(String(b.conversation || ''))) return send(res, 400, { error: 'conversation id required' });
      if (!['up', 'down'].includes(b.rating)) return send(res, 400, { error: 'rating must be up or down' });
      db.prepare('INSERT INTO feedback (ts, conversation, rating, comment) VALUES (?, ?, ?, ?)')
        .run(Date.now(), b.conversation, b.rating, b.comment ? redact(clip(b.comment, 1000)) : null);
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 400, { error: String(err.message).slice(0, 100) });
    }
  }

  // Turn records come from the hub only.
  if (url.pathname === '/events' && req.method === 'POST') {
    if (!sameKey(bearer(req), METRICS_KEY)) return send(res, 401, { error: 'unauthorized' });
    try {
      const b = JSON.parse((await readBody(req)) || '{}');
      const conv = String(b.conversation || '');
      if (!CONV_RE.test(conv)) return send(res, 400, { error: 'conversation id required' });
      db.prepare(`INSERT INTO turns (ts, conversation, turn, model, streamed, latency_ms, prompt_tokens, completion_tokens, tools, harness, outcome, messages, reply)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        Date.now(), conv, Number(b.turn) || 0, clip(b.model, 60), b.streamed ? 1 : 0,
        Number.isFinite(b.latencyMs) ? Math.round(b.latencyMs) : null,
        Number(b.promptTokens) || null, Number(b.completionTokens) || null,
        JSON.stringify((b.tools || []).map((t) => clip(t, 60)).slice(0, 20)),
        JSON.stringify((b.harness || []).map((h) => clip(h, 200)).slice(0, 40)),
        clip(b.outcome, 30) || null,
        clip(redactJson(b.messages), 60_000),
        clip(redactJson(b.reply), 30_000),
      );
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 400, { error: String(err.message).slice(0, 100) });
    }
  }

  if (url.pathname.startsWith('/admin/')) {
    if (!sameKey(bearer(req), ADMIN_KEY)) return send(res, 401, { error: 'unauthorized' });
    if (url.pathname === '/admin/report') return send(res, 200, report(Math.max(1, Number(url.searchParams.get('days')) || 7)));
    if (url.pathname === '/admin/export') {
      // JSONL, one conversation per line: its turns in order and its ratings.
      const since = Date.now() - Math.max(1, Number(url.searchParams.get('days')) || 7) * 86_400_000;
      const only = url.searchParams.get('rating');
      const convs = db.prepare(`SELECT DISTINCT conversation FROM turns WHERE ts >= ?${only ? ' AND conversation IN (SELECT conversation FROM feedback WHERE rating = ?)' : ''}`)
        .all(...(only ? [since, only] : [since])).map((r) => r.conversation);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      for (const c of convs) {
        const turns = db.prepare('SELECT * FROM turns WHERE conversation = ? ORDER BY turn, id').all(c)
          .map((t) => ({ ...t, tools: JSON.parse(t.tools), harness: JSON.parse(t.harness), messages: JSON.parse(t.messages), reply: JSON.parse(t.reply) }));
        const ratings = db.prepare('SELECT rating, comment, ts FROM feedback WHERE conversation = ? ORDER BY ts').all(c);
        res.write(`${JSON.stringify({ conversation: c, turns, ratings })}\n`);
      }
      return res.end();
    }
    return send(res, 404, { error: 'not found' });
  }
  return send(res, 404, { error: 'not found' });
});
server.listen(PORT, () => console.log(`metrics on :${PORT}, ${DB_PATH}, retention ${RETENTION_DAYS} days`));
