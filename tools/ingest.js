#!/usr/bin/env node
/**
 * Builds a citable corpus from mixed sources: local markdown, websites, and
 * PDFs. Output is one JSON object per line, each a chunk that carries where it
 * came from, so an answer can quote a real URL and heading instead of a
 * filename.
 *
 * Source text is kept VERBATIM. It is tempting to have a model summarise
 * everything first, but a summary is a paraphrase: it bakes the model's
 * mistakes into the corpus permanently, and you can no longer quote it. The
 * whole value of a documentation bot is that its claims can be checked against
 * real text.
 *
 *   node tools/ingest.js --out corpus.jsonl \
 *     --dir ../flux/docs --site https://docs.runonflux.io --pdf whitepaper.pdf
 *
 * PDFs need `pdftotext` (poppler-utils) on PATH; without it they are skipped
 * loudly rather than silently.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const argv = process.argv.slice(2);
const many = flag => argv.reduce((acc, a, i) => (a === flag ? [...acc, argv[i + 1]] : acc), []);
const one = (flag, dflt) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : dflt; };

const OUT = one('--out', 'corpus.jsonl');
const MAX_CHARS = Number(one('--chunk', 1200));
const OVERLAP = Number(one('--overlap', 200));
const MAX_PAGES = Number(one('--max-pages', 400));
// Sitemaps carry far more than you want. sspwallet.io lists 2226 URLs, which is
// 159 pages in 14 languages: ingesting all of it would put fourteen
// translations of every page into the corpus and wreck retrieval.
const INCLUDE = one('--include', null) ? new RegExp(one('--include', null)) : null;
const EXCLUDE = one('--exclude', null) ? new RegExp(one('--exclude', null)) : null;
/**
 * Trust tier, carried through to every chunk. Documentation and marketing
 * should not be weighed the same: a 2021 announcement stating the old node
 * tiers is not wrong so much as stale, and a bot that cites it as current is
 * worse than one that has never heard of it.
 */
const TIER = one('--tier', 'docs');

const keepUrl = u => (!INCLUDE || INCLUDE.test(u)) && (!EXCLUDE || !EXCLUDE.test(u));

/**
 * Internal documents, refused by default when reading local repositories.
 *
 * Product repos are full of material that is not for customers: unreleased
 * integration plans, roadmaps, fundraising decks, growth plans, and meeting
 * prep naming specific counterparties. ssp-enterprise-app alone carries
 * SOLANA_INTEGRATION_PLAN, ADVANCED_POLICY_ENGINE_ROADMAP,
 * MIDAS_EVERSTAKE_MEETING_PREP and SSP_OUTREACH_PLAYBOOK.
 *
 * A retrieval bot has no notion of confidentiality: ingest these and "what is
 * SSP planning for Solana?" answers from the unreleased plan, with a citation.
 * So the default is to refuse, name what was refused, and require
 * --allow-internal to override.
 */
const INTERNAL = /(^|\/|_)(plan|roadmap|deck|narrative|prep|playbook|audit|internal|private|secret|strategy|principles|instructions|meeting|outreach|growth|launch-copy)([._-]|$)/i;
const IN_WORKTREE = /(^|\/)(\.claude|\.git|worktrees|node_modules)(\/|$)/;
const ALLOW_INTERNAL = argv.includes('--allow-internal');
const refused = [];
const skipped = [];

function isInternal(relPath) {
  if (IN_WORKTREE.test(relPath)) return true;
  return INTERNAL.test(relPath.split('/').pop());
}

const chunks = [];

/**
 * Splits on headings first so a chunk rarely straddles two topics, and records
 * the heading path - that is what makes a citation useful ("Deployment > Ports"
 * rather than "page 4").
 */
function addText(text, meta) {
  const lines = text.split('\n');
  let heading = [];
  let buf = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    buf = [];
    if (body.length < 40) return; // navigation scraps and stray link lists
    for (let i = 0; i < body.length; i += MAX_CHARS - OVERLAP) {
      const piece = body.slice(i, i + MAX_CHARS).trim();
      if (piece.length >= 40) chunks.push({ ...meta, heading: heading.join(' > '), text: piece });
      if (body.length <= MAX_CHARS) break;
    }
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const depth = h[1].length;
      heading = heading.slice(0, depth - 1);
      heading[depth - 1] = h[2].trim();
      heading = heading.filter(Boolean);
      continue;
    }
    buf.push(line);
  }
  flush();
}

/**
 * Repairs what pdftotext leaves behind.
 *
 * The worst of it is line-break hyphenation: a 424-page whitepaper splits words
 * across lines, so "Cumulus" is stored as "Cu-\nmulus". Embeddings shrug that
 * off, but BM25 does not - a search for "Cumulus" simply misses the passage
 * that defines it, which is exactly the technical term a user would ask about.
 * 17% of whitepaper chunks contained at least one.
 *
 * Table-of-contents dot leaders are pure noise: they retrieve well against
 * anything (they contain every heading in the document) and answer nothing.
 */
function cleanPdfText(raw) {
  return raw
    // "Cu-\nmulus" -> "Cumulus", but leave real hyphenated compounds alone
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    // "...... 139" table-of-contents rows
    .replace(/^.*\.{5,}\s*\d+\s*$/gm, '')
    // page numbers alone on a line, and "Page 4 of 424"
    .replace(/^\s*\d{1,4}\s*$/gm, '')
    .replace(/^\s*page \d+ of \d+\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(p);
    return /\.(md|markdown|txt)$/i.test(e.name) ? [p] : [];
  });
}

/** Strips scripts, styles, nav and tags, and turns headings back into markdown. */
function htmlToText(html) {
  return html
    .replace(/<(script|style|nav|footer|header|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, d, t) => `\n${'#'.repeat(Number(d))} ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const titleOf = html => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ownllm-ingest' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Follows the site's own sitemap rather than crawling blind. */
async function sitemapUrls(site) {
  const bases = [`${site.replace(/\/$/, '')}/sitemap.xml`, `${site.replace(/\/$/, '')}/sitemap_index.xml`];
  for (const b of bases) {
    try {
      const xml = await fetchText(b);
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
      const nested = locs.filter(u => /sitemap.*\.xml$/i.test(u));
      if (nested.length) {
        const out = [];
        for (const n of nested.slice(0, 20)) {
          try { out.push(...[...(await fetchText(n)).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())); } catch { /* skip */ }
        }
        return out.filter(u => !/\.xml$/i.test(u));
      }
      if (locs.length) return locs;
    } catch { /* try the next candidate */ }
  }
  return [];
}

/**
 * Pulls articles from a CMS that serves JSON rather than pages. The SSP sites
 * render their Academy and blog content from a database, so the articles are
 * invisible to sitemap scraping - and the API gives clean text with real
 * titles and categories instead of HTML that has to be stripped.
 *
 * Needs a key: CMS_API_KEY in the environment.
 */
async function ingestApi(endpoint) {
  const key = process.env.CMS_API_KEY;
  if (!key) { console.log(`SKIPPED ${endpoint}: CMS_API_KEY is not set`); return; }
  const seen = [];
  for (let page = 0; page < 20; page += 1) {
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=100&offset=${page * 100}`;
    let body;
    try {
      const res = await fetch(url, { headers: { 'x-api-key': key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.json();
    } catch (err) { console.log(`SKIPPED ${endpoint}: ${err.message}`); return; }
    const items = Array.isArray(body) ? body : (body.data || body.posts || body.items || []);
    if (!items.length) break;
    for (const it of items) {
      const text = it.content || it.body || it.markdown || it.html || '';
      if (!text) continue;
      const clean = /<[a-z][\s\S]*>/i.test(text) ? htmlToText(text) : text;
      addText(`# ${it.title || it.slug || 'untitled'}\n${clean}`, {
        source: it.title || it.slug || 'untitled',
        origin: endpoint,
        url: it.url || (it.slug ? `${endpoint.replace(/\/api\/.*/, '')}/${it.slug}` : ''),
        tier: TIER,
        date: it.publishedAt || it.createdAt || '',
        category: it.category || it.section || undefined,
      });
      seen.push(it.slug || it.title);
    }
    if (items.length < 100) break;
  }
  console.log(`${endpoint}: ${seen.length} articles`);
}

(async () => {
  for (const endpoint of many('--api')) await ingestApi(endpoint);

  for (const dir of many('--dir')) {
    if (!fs.existsSync(dir)) { console.log(`skip ${dir} (missing)`); continue; }
    const files = walk(dir);
    let used = 0;
    for (const f of files) {
      const rel = path.relative(dir, f);
      if (!ALLOW_INTERNAL && isInternal(rel)) { refused.push(`${path.basename(dir)}/${rel}`); continue; }
      // --exclude applies to local paths as well as sitemap URLs, so a whole
      // subtree can be left out by topic rather than by name.
      if (EXCLUDE && EXCLUDE.test(rel)) { skipped.push(`${path.basename(dir)}/${rel}`); continue; }
      addText(fs.readFileSync(f, 'utf8'), { source: rel, origin: dir, url: '', tier: TIER });
      used += 1;
    }
    console.log(`${dir}: ${used}/${files.length} files${used < files.length ? ` (${files.length - used} internal, refused)` : ''}`);
  }

  for (const pdf of many('--pdf')) {
    try {
      const raw = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64e6 });
      const text = cleanPdfText(raw);
      addText(text, { source: path.basename(pdf), origin: 'pdf', url: '', tier: TIER });
      console.log(`${pdf}: ${text.length} chars`);
    } catch (err) {
      console.log(`SKIPPED ${pdf}: ${/ENOENT/.test(err.message) ? 'pdftotext not installed (brew install poppler)' : err.message}`);
    }
  }

  for (const feed of many('--rss')) {
    // Medium serves 403 to scrapers and its sitemap returns HTML, so the feed
    // is the only reliable way in - but it caps at the ten most recent posts.
    // Anything older has to be exported or fetched by hand.
    try {
      const xml = await fetchText(feed);
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
      for (const item of items) {
        const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'untitled';
        const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
        const date = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        const body = (item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/) || [])[1] || '';
        if (body) addText(`# ${title}\n${htmlToText(body)}`, { source: title.trim(), origin: feed, url: link.trim(), tier: TIER, date: date.trim() });
      }
      console.log(`${feed}: ${items.length} items (RSS shows only the latest 10)`);
    } catch (err) { console.log(`SKIPPED ${feed}: ${err.message}`); }
  }

  for (const site of many('--site')) {
    let urls = await sitemapUrls(site);
    if (!urls.length) { console.log(`${site}: no sitemap, fetching the single page`); urls = [site]; }
    const before = urls.length;
    urls = urls.filter(keepUrl).slice(0, MAX_PAGES);
    if (before !== urls.length) console.log(`${site}: ${before} URLs -> ${urls.length} after filtering`);
    let ok = 0;
    for (const url of urls) {
      try {
        const html = await fetchText(url);
        const before = chunks.length;
        addText(htmlToText(html), { source: titleOf(html) || url, origin: site, url, tier: TIER });
        if (chunks.length > before) ok += 1;
      } catch { /* a dead link should not stop the crawl */ }
    }
    console.log(`${site}: ${ok}/${urls.length} pages`);
  }

  // Marketing sites repeat their nav, footer and calls-to-action on every
  // page. Those chunks are identical, retrieve well against generic questions,
  // and crowd out real answers, so keep only the first copy of each.
  const seenText = new Set();
  const deduped = chunks.filter(c => {
    const finger = c.text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 220);
    if (seenText.has(finger)) return false;
    seenText.add(finger);
    return true;
  });
  const dropped = chunks.length - deduped.length;
  if (dropped) console.log(`  deduplicated: dropped ${dropped} repeated chunks`);
  chunks.length = 0; chunks.push(...deduped);

  const line = `${chunks.map(c => JSON.stringify(c)).join('\n')}\n`;
  if (argv.includes('--append') && fs.existsSync(OUT)) fs.appendFileSync(OUT, line);
  else fs.writeFileSync(OUT, line);
  const words = chunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
  const byTier = chunks.reduce((a, c) => ({ ...a, [c.tier || 'docs']: (a[c.tier || 'docs'] || 0) + 1 }), {});
  console.log(`\nwrote ${OUT}: ${chunks.length} chunks, ~${words.toLocaleString()} words`);
  console.log(`  by tier: ${Object.entries(byTier).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  if (skipped.length) {
    console.log(`\n  excluded ${skipped.length} files by --exclude:`);
    for (const r of skipped.slice(0, 6)) console.log(`    ${r}`);
    if (skipped.length > 6) console.log(`    ... and ${skipped.length - 6} more`);
  }
  if (refused.length) {
    console.log(`\n  REFUSED ${refused.length} internal documents (--allow-internal to override):`);
    for (const r of refused.slice(0, 12)) console.log(`    ${r}`);
    if (refused.length > 12) console.log(`    ... and ${refused.length - 12} more`);
  }
})();
