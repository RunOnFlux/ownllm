/**
 * Live sources: the help centre's articles and the products' release notes.
 *
 * The corpus is a snapshot baked into the image, rebuilt by hand
 * (tools/build-corpus.sh). That suits documentation that changes monthly; it
 * does not suit the help centre, whose articles are written from what customers
 * ask this week, or release notes, which are the only place a new version is
 * described. Baked in, both were weeks stale the day an image shipped.
 *
 * So these two are fetched by every instance, at boot and every
 * SOURCES_REFRESH_MS, embedded, and swapped into the index in place of the
 * previous fetch (server.js refreshLiveSources). Nothing to rebuild or
 * redeploy: an article published on the help centre is retrievable within the
 * refresh interval. A failed fetch keeps the previous copy.
 *
 * Help centre: Frappe Helpdesk's guest API - categories, the published Public
 * articles in each, and each article as Markdown. Release notes: GitHub
 * releases for the repositories in RELEASE_REPOS, and Zelcore's changelog,
 * which is where Zelcore writes its notes (its GitHub releases carry none).
 */
const HELP_CENTRE = (process.env.HELP_CENTRE_URL || 'https://support.runonflux.io').replace(/\/$/, '');
// "Product name=owner/repo", comma-separated.
const RELEASE_REPOS = (process.env.RELEASE_REPOS ||
  'FluxOS=RunOnFlux/flux,SSP Wallet=RunOnFlux/ssp-wallet,SSP Key=RunOnFlux/ssp-key')
  .split(',').map(s => s.trim()).filter(Boolean)
  .map((s) => { const [product, repo] = s.split('='); return { product: product.trim(), repo: (repo || '').trim() }; })
  .filter(r => r.product && r.repo);
const ZELCORE_CHANGELOG = process.env.ZELCORE_CHANGELOG ??
  'https://raw.githubusercontent.com/zelcore-io/zelcore/master/changelog.md';
const RELEASES_PER_PRODUCT = Number(process.env.RELEASES_PER_PRODUCT || 5);
const MAX_SECTION = 1800; // characters; longer sections are split at paragraphs

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'flux-docsbot' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.json();
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'flux-docsbot' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.text();
}

/** Split long text at paragraph breaks so no piece passes `max` characters (one long paragraph stays whole). */
function splitLong(text, max = MAX_SECTION) {
  if (text.length <= max) return [text];
  const out = [];
  let cur = '';
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > max) { out.push(cur); cur = ''; }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * One help-centre article as chunks: its lead (the text before the first "## "),
 * then one per section. Each chunk starts with the article title, so a section
 * like "Still stuck?" still says what it belongs to.
 */
function articleChunks({ name, title, category, markdown }) {
  const url = `${HELP_CENTRE}/help/articles/${name}`;
  const body = String(markdown || '').replace(/\r/g, '').replace(/^# .*\n+/, '').trim();
  const parts = body.split(/\n(?=## )/);
  const chunks = [];
  for (const part of parts) {
    const m = /^## (.*)\n?/.exec(part);
    const section = m ? m[1].trim() : '';
    const text = (m ? part.slice(m[0].length) : part).trim();
    if (!text) continue;
    for (const piece of splitLong(text)) {
      chunks.push({
        source: 'support.runonflux.io/help',
        heading: [category, title, section].filter(Boolean).join(' › '),
        url,
        tier: 'help',
        text: `${title}${section ? ` - ${section}` : ''}\n${piece}`,
      });
    }
  }
  return chunks;
}

/** GitHub release notes, without the per-PR author and link noise. */
function cleanReleaseBody(body) {
  return String(body || '')
    .replace(/\r/g, '')
    .replace(/ by @[\w-]+ in https:\/\/github\.com\/\S+/g, '')
    .replace(/^\*\*Full Changelog\*\*.*$/gm, '')
    .replace(/^## New Contributors[\s\S]*?(?=^## |$(?![\s\S]))/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * One short chunk per product stating its latest version, phrased as the
 * question. Release notes are long feature lists, so "what is the latest
 * FluxOS version" matched the API's "update to the latest version" endpoints
 * better than the notes themselves; stated, it is a lookup (as the facts tier
 * does for numbers the models get wrong).
 */
function latestChunk(product, version, tag, date, url) {
  return {
    source: 'github.com/releases (latest versions)',
    heading: `Latest ${product} version`,
    url,
    tier: 'releases',
    text: `What is the latest ${product} version? The latest ${product} release is ${version}${tag && tag !== version ? ` (tag ${tag})` : ''}, released ${date}. Release notes: ${url}`,
  };
}

function releaseChunks(product, releases, limit = RELEASES_PER_PRODUCT) {
  const shown = releases
    .filter(r => !r.draft && !r.prerelease && r.published_at && String(r.body || '').trim())
    .slice(0, limit);
  const head = shown[0];
  const latest = head
    ? [latestChunk(product, String(head.tag_name || head.name).replace(/^v(?=\d)/, ''), head.tag_name || head.name, head.published_at.slice(0, 10), head.html_url)]
    : [];
  return latest.concat(shown
    .flatMap((r, i) => {
      const date = r.published_at.slice(0, 10);
      const tag = r.tag_name || r.name;
      const version = String(tag).replace(/^v(?=\d)/, '');
      // Written the way people ask: "latest", "current version", "8.24" and "v8.24".
      const lead = i === 0
        ? `${product} ${version} (${tag}), released ${date}: the latest ${product} release, so the current ${product} version is ${version}.`
        : `${product} ${version} (${tag}), released ${date}: an earlier ${product} release.`;
      return splitLong(cleanReleaseBody(r.body)).map(piece => ({
        source: `github.com/${r.html_url ? r.html_url.split('/').slice(3, 5).join('/') : product}/releases`,
        heading: `${product} ${version} release notes (${date})`,
        url: r.html_url,
        tier: 'releases',
        text: `${lead}\n${piece}`,
      }));
    }));
}

/** Zelcore's changelog: "## [8.41.0] – Title" sections, newest first. */
function zelcoreChunks(markdown, limit = RELEASES_PER_PRODUCT) {
  const url = 'https://github.com/zelcore-io/zelcore/blob/master/changelog.md';
  const sections = String(markdown || '').replace(/\r/g, '').split(/\n(?=## \[)/).filter(s => s.startsWith('## ['));
  const top = /^## \[([^\]]+)\]/.exec(sections[0] || '');
  // The changelog has no dates, so the latest-version line carries none.
  const latest = top ? [{ ...latestChunk('Zelcore', top[1].trim(), '', '', url), text: `What is the latest Zelcore version? The latest Zelcore release is ${top[1].trim()}. Release notes: ${url}` }] : [];
  return latest.concat(sections.slice(0, limit).flatMap((sec, i) => {
    const m = /^## \[([^\]]+)\]\s*[–-]?\s*(.*)\n?/.exec(sec);
    if (!m) return [];
    const version = m[1].trim();
    const title = m[2].trim();
    const text = sec.slice(m[0].length).trim();
    const lead = i === 0
      ? `Zelcore ${version}${title ? ` (${title})` : ''}: the latest Zelcore release, so the current Zelcore version is ${version}.`
      : `Zelcore ${version}${title ? ` (${title})` : ''}: an earlier Zelcore release.`;
    return splitLong(text).map(piece => ({
      source: 'github.com/zelcore-io/zelcore/changelog.md',
      heading: `Zelcore ${version} release notes${title ? `: ${title}` : ''}`,
      url,
      tier: 'releases',
      text: `${lead}\n${piece}`,
    }));
  }));
}

async function fetchHelpCentre() {
  const api = `${HELP_CENTRE}/api/method/helpdesk.api.knowledge_base`;
  const categories = (await getJson(`${api}.get_categories`)).message || [];
  const chunks = [];
  if (!categories.length) throw new Error('the help centre lists no categories');
  for (const cat of categories) {
    const id = cat.name || cat.category_id;
    if (!id) continue;
    for (let start = 0; ; start += 100) {
      const page = (await getJson(`${api}.get_articles?category=${encodeURIComponent(id)}&limit=100&start=${start}`)).message || [];
      for (const a of page) {
        const markdown = await getText(`${api}.get_article_markdown?name=${encodeURIComponent(a.name)}`);
        chunks.push(...articleChunks({ name: a.name, title: a.title, category: cat.category_name, markdown }));
      }
      if (page.length < 100) break;
    }
  }
  return chunks;
}

async function fetchReleases() {
  const chunks = [];
  for (const { product, repo } of RELEASE_REPOS) {
    try {
      chunks.push(...releaseChunks(product, await getJson(`https://api.github.com/repos/${repo}/releases?per_page=15`)));
    } catch (err) { console.log(`live sources: ${product} releases unavailable (${err.message})`); }
  }
  if (ZELCORE_CHANGELOG) {
    try { chunks.push(...zelcoreChunks(await getText(ZELCORE_CHANGELOG))); }
    catch (err) { console.log(`live sources: Zelcore changelog unavailable (${err.message})`); }
  }
  // Nothing at all (GitHub rate-limited this node, say) is a failure, not "no releases".
  if (!chunks.length) throw new Error('no release notes fetched');
  return chunks;
}

/**
 * Both sources. A source that fails comes back as null, so the caller can keep
 * its previous copy instead of dropping the help centre for six hours.
 */
async function fetchLiveSources() {
  const [help, releases] = await Promise.all([
    fetchHelpCentre().catch((err) => { console.log(`live sources: help centre unavailable (${err.message})`); return null; }),
    fetchReleases().catch((err) => { console.log(`live sources: release notes unavailable (${err.message})`); return null; }),
  ]);
  return { help, releases };
}

module.exports = { fetchLiveSources, articleChunks, releaseChunks, zelcoreChunks, cleanReleaseBody, splitLong };
