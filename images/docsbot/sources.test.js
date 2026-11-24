// node --test images/docsbot/sources.test.js
const test = require('node:test');
const assert = require('node:assert');
const { articleChunks, releaseChunks, zelcoreChunks, cleanReleaseBody, splitLong } = require('./sources.js');

test('a help-centre article becomes its lead plus one chunk per section, each naming the article', () => {
  const chunks = articleChunks({
    name: 'abc123',
    title: 'My server won\'t start',
    category: 'Flux Games',
    markdown: '# My server won\'t start\n\nUsually one of three things.\n\n## Waiting for a node\n\nAdd a region.\n\n## Still stuck?\n\nOpen a ticket.\n',
  });
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks.map(c => c.heading), [
    'Flux Games › My server won\'t start',
    'Flux Games › My server won\'t start › Waiting for a node',
    'Flux Games › My server won\'t start › Still stuck?',
  ]);
  assert.ok(chunks.every(c => c.tier === 'help' && c.url === 'https://support.runonflux.io/help/articles/abc123'));
  assert.match(chunks[2].text, /^My server won't start - Still stuck\?\nOpen a ticket\.$/);
});

test('long sections are split at paragraphs, never mid-paragraph', () => {
  const para = 'x'.repeat(700);
  const parts = splitLong([para, para, para].join('\n\n'), 1500);
  assert.equal(parts.length, 2);
  assert.ok(parts.every(p => !p.startsWith('\n') && p.length <= 1500));
});

test('release notes: newest marked as the latest, drafts and empty notes skipped, PR noise removed', () => {
  const releases = [
    { tag_name: 'v9.0.0', draft: true, published_at: null, body: 'draft' },
    { tag_name: 'v8.24.0', published_at: '2026-11-15T10:00:00Z', html_url: 'https://github.com/RunOnFlux/flux/releases/tag/v8.24.0',
      body: "## What's Changed\n* fix(apps): faster sync by @someone in https://github.com/RunOnFlux/flux/pull/1897\n\n**Full Changelog**: https://x" },
    { tag_name: 'v8.23.1', published_at: '2026-11-07T10:00:00Z', html_url: 'https://github.com/RunOnFlux/flux/releases/tag/v8.23.1', body: '' },
    { tag_name: 'v8.23.0', published_at: '2026-11-06T10:00:00Z', html_url: 'https://github.com/RunOnFlux/flux/releases/tag/v8.23.0', body: '* older' },
  ];
  const chunks = releaseChunks('FluxOS', releases, 5);
  assert.deepEqual(chunks.map(c => c.heading), ['Latest FluxOS version', 'FluxOS 8.24.0 release notes (2026-11-15)', 'FluxOS 8.23.0 release notes (2026-11-06)']);
  assert.equal(chunks[0].text, 'What is the latest FluxOS version? The latest FluxOS release is 8.24.0 (tag v8.24.0), released 2026-11-15. Release notes: https://github.com/RunOnFlux/flux/releases/tag/v8.24.0');
  chunks.shift();
  assert.match(chunks[0].text, /^FluxOS 8\.24\.0 \(v8\.24\.0\), released 2026-11-15: the latest FluxOS release, so the current FluxOS version is 8\.24\.0\./);
  assert.match(chunks[1].text, /^FluxOS 8\.23\.0 \(v8\.23\.0\), released 2026-11-06: an earlier FluxOS release\./);
  assert.equal(cleanReleaseBody(releases[1].body), "## What's Changed\n* fix(apps): faster sync");
  assert.equal(chunks[0].source, 'github.com/RunOnFlux/flux/releases');
});

test("Zelcore's changelog: one release per \"## [version]\" section, newest first", () => {
  const md = '# Changelog\n\n## [8.41.0] – Security Hardening\n\nStronger keys.\n\n### Fixed\n\n- Sends\n\n## [8.40.1] – Sell Fix\n\nSell works.\n';
  const chunks = zelcoreChunks(md, 5);
  assert.deepEqual(chunks.map(c => c.heading), ['Latest Zelcore version', 'Zelcore 8.41.0 release notes: Security Hardening', 'Zelcore 8.40.1 release notes: Sell Fix']);
  assert.match(chunks.shift().text, /^What is the latest Zelcore version\? The latest Zelcore release is 8\.41\.0\./);
  assert.match(chunks[0].text, /^Zelcore 8\.41\.0 \(Security Hardening\): the latest Zelcore release, so the current Zelcore version is 8\.41\.0\.\nStronger keys\./);
  assert.ok(chunks.every(c => c.tier === 'releases'));
});
