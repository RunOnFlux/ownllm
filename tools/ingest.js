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

(async () => {
  for (const dir of many('--dir')) {
    if (!fs.existsSync(dir)) { console.log(`skip ${dir} (missing)`); continue; }
    const files = walk(dir);
    for (const f of files) {
      addText(fs.readFileSync(f, 'utf8'), { source: path.relative(dir, f), origin: dir, url: '' });
    }
    console.log(`${dir}: ${files.length} files`);
  }

  for (const pdf of many('--pdf')) {
    try {
      const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64e6 });
      addText(text, { source: path.basename(pdf), origin: 'pdf', url: '' });
      console.log(`${pdf}: ${text.length} chars`);
    } catch (err) {
      console.log(`SKIPPED ${pdf}: ${/ENOENT/.test(err.message) ? 'pdftotext not installed (brew install poppler)' : err.message}`);
    }
  }

  for (const site of many('--site')) {
    let urls = await sitemapUrls(site);
    if (!urls.length) { console.log(`${site}: no sitemap, fetching the single page`); urls = [site]; }
    urls = urls.slice(0, MAX_PAGES);
    let ok = 0;
    for (const url of urls) {
      try {
        const html = await fetchText(url);
        const before = chunks.length;
        addText(htmlToText(html), { source: titleOf(html) || url, origin: site, url });
        if (chunks.length > before) ok += 1;
      } catch { /* a dead link should not stop the crawl */ }
    }
    console.log(`${site}: ${ok}/${urls.length} pages`);
  }

  fs.writeFileSync(OUT, `${chunks.map(c => JSON.stringify(c)).join('\n')}\n`);
  const words = chunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
  console.log(`\nwrote ${OUT}: ${chunks.length} chunks, ~${words.toLocaleString()} words`);
})();
