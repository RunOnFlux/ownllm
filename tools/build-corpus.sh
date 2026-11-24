#!/bin/bash
# Builds the Flux knowledge corpus from every source worth having.
#
# The source list matters as much as the tooling. Three findings from surveying
# what exists, each of which would have degraded the corpus if ingested naively:
#
#   1. THREE docs repos exist. flux-docs was updated 17 hours ago;
#      runonflux-docs is 6 months stale and runonflux-docusaurus 10 months.
#      They cover the same pages, so ingesting all three puts contradictory
#      versions of the same fact in front of the retriever. Only the live one
#      is used here.
#
#   2. sspwallet.io's sitemap lists 2226 URLs, which is 159 pages in 14
#      languages. Without the language filter the corpus becomes fourteen
#      translations of everything.
#
#   3. The fluxwhitepaper repo vendors copies of other repos under repos/ -
#      that is where 2.1M of its 2.18M words live. The whitepaper itself is the
#      PDFs at the top level.
#
# Not in the corpus on purpose: the help centre (support.runonflux.io) and the
# release notes. They change weekly, so the docs bot fetches them itself
# (images/docsbot/sources.js) instead of waiting for the next corpus build.
#
# Usage: tools/build-corpus.sh [output.jsonl]
#   REPOS=<dir>  read the repositories from <dir> instead of ~/repos. Use an
#                export of each default branch: a working copy on a feature
#                branch (flux-docs often is) puts unreleased pages in the corpus.
set -euo pipefail
# Built beside the real files and moved over them only at the end: a build that
# fails halfway (a site down, a missing config) must not leave the image with
# no corpus or an empty fact sheet.
FINAL="${1:-images/docsbot/docs/corpus.jsonl}"
OUT="$FINAL.building"
R="${REPOS:-$HOME/repos}"
rm -f "$OUT"

echo "### tier: facts (generated from FluxOS source - the authoritative numbers)"
# Regenerated every build so it cannot drift from the code it describes, and so
# derived values are stated rather than computed. Every model tested failed to
# work out that 1056000 blocks is about 12 months; stating it turns a
# calculation they get wrong into a lookup they get right.
if [ -d "$R/flux/ZelBack" ]; then
  node tools/facts-from-source.js "$R/flux" > images/docsbot/docs/flux-facts.md.building
  node tools/facts-api-from-source.js "$R/flux" > images/docsbot/docs/flux-api.md.building
  mv images/docsbot/docs/flux-facts.md.building images/docsbot/docs/flux-facts.md
  mv images/docsbot/docs/flux-api.md.building images/docsbot/docs/flux-api.md
  # Marketplace sheet: the live catalogue (tools/fetch-marketplace.js) through
  # gen-marketplace-facts.js. gen-marketplace.js is the training-data generator; its
  # sheet comes from the stale listapps subset and drops the NewGames category.
  node tools/fetch-marketplace.js >/dev/null 2>&1 || echo "  marketplace catalogue not refreshed; using finetune/data/marketplace.json as it is"
  node finetune/gen-marketplace-facts.js --out images/docsbot/docs/marketplace-facts.md.building
  mv images/docsbot/docs/marketplace-facts.md.building images/docsbot/docs/marketplace-facts.md
  # the live catalog aggregate
  node finetune/gen-catalog.js >/dev/null 2>&1 && cp finetune/data/catalog-facts.md images/docsbot/docs/
  node tools/ingest.js --out "$OUT" --append --tier facts --dir images/docsbot/docs
else
  echo "  missing: $R/flux (FluxOS source) - fact sheet not regenerated"
fi

echo
echo "### tier: docs (authoritative, current)"
node tools/ingest.js --out "$OUT" --append --tier docs \
  --dir "$R/flux-docs/docs" \
  --dir "$R/ssp-docs" \
  --dir "$R/flux/docs" \
  --dir "$R/zelcore-docs/docs"

echo
echo "### tier: whitepaper"
# The PDFs, not the repo's markdown: repos/ under it is vendored source.
# fluxwhitepaper-public is the published paper (whitepaper.app.runonflux.io);
# the private fluxwhitepaper repo stopped at 1.0 when 1.0.1 shipped there.
WP="$R/fluxwhitepaper-public"
git -C "$WP" pull -q --ff-only || echo "  could not update $WP - using it as it is"
node tools/ingest.js --out "$OUT" --append --tier whitepaper \
  --pdf-base https://whitepaper.app.runonflux.io \
  --pdf "$WP/FluxWhitepaper.pdf" \
  --pdf "$WP/FluxWhitepaper-Short.pdf"

echo
echo "### tier: website (product pages, marketing tone but current)"
# runonflux.com/games added Portuguese as /pt/ (not /pt-BR/): 2,956 translated chunks
# slipped into the November 2026 build before pt was listed here.
LANGS='/(zh|vi|tr|ru|pt-BR|pt|pl|ko|ja|it|id|fr|es|de|nl)(/|$)'
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://runonflux.com --max-pages 120
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://sspwallet.io --exclude "$LANGS" --max-pages 200
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://zelcore.io --max-pages 220

echo
echo "### Flux Games (runonflux.com/games): guides at the docs tier, the rest as website"
# The game pages live in their own sitemap (runonflux.com/games/sitemap.xml),
# which the runonflux.com crawl above never reaches. Their guides are the
# current word on game servers: in October 2026 the docs' game pages still said
# a server is joined by its domain without the port, and the bot repeated it.
# --delay: the site refuses a fast crawl after about 100 pages.
GAMES_DOCS='/(guides/[^/]+|setup-guide|server-requirements|pricing|world-settings-editor)/?$'
node tools/ingest.js --out "$OUT" --append --tier docs \
  --site https://runonflux.com/games --include "$GAMES_DOCS" --exclude "$LANGS" --max-pages 400 --delay 1200
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://runonflux.com/games --exclude "$LANGS|$GAMES_DOCS" --max-pages 400 --delay 1200

echo
echo "### tier: product (deployment guidance - the highest-value pages for user questions)"
# cloud.runonflux.com is the fluxos-frontend deploy UI, server-rendered, and its
# sitemap covers the register flow, every marketplace app including the game
# servers, and the comparison pages. This is what someone asking "how do I
# deploy X on Flux" actually needs.
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://cloud.runonflux.com --max-pages 120

# AI products. ai.runonflux.com has 10 tutorial pages, which are the useful
# part; beaverai.app publishes 78 blog posts. In November 2026 ai.runonflux.com
# became a client-rendered app with an empty sitemap (one ~20-word page comes
# back) and beaverai.app answered HTTP 530, so both contribute nothing until
# that changes; FluxAI is still covered by fluxai-enterprise below.
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://ai.runonflux.com --exclude '/images/' --max-pages 60
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://beaverai.app --max-pages 120

# No sitemap on these, so only the landing page is reachable. The gap is filled
# from their repositories below. fluxedge.ai and fluxcore.ai are gone: FluxEdge
# and FluxCore shut down in November 2026, and the docs' shutdown page
# (flux-docs docs/home/fluxedge-fluxcore-shutdown.md) is what the bot should say.
for SITE in https://fluxai.io https://brimley.ai; do
  node tools/ingest.js --out "$OUT" --append --tier product --site "$SITE" --max-pages 1
done

echo
echo "### tier: enterprise (SSP Enterprise - public material only)"
# The enterprise repos are mostly internal: integration plans, roadmaps,
# fundraising decks and meeting prep naming specific counterparties. The
# ingester refuses those by default and prints what it refused; only the
# genuinely descriptive files come through. Read that refusal list before
# publishing - it is the difference between a product bot and a leak.
for REPO in "$R/ssp-enterprise" "$R/ssp-enterprise-app"; do
  [ -d "$REPO" ] && node tools/ingest.js --out "$OUT" --append --tier enterprise --dir "$REPO"
done
# The customer-facing enterprise story lives on the website, and that is already
# covered by the sspwallet.io academy scrape above.

echo
echo "### tier: product-repo (what the thin marketing sites do not say)"
# fluxedge, fluxcore, brimley and beaver have little or no public
# documentation, but their repositories do: fluxai-enterprise alone carries 390
# markdown files. Clone whichever are missing, then re-run.
# ai_university is 157,000 words of generic AI education - "AI in Healthcare",
# "Data Literacy", "AI Ethics" - and none of it is about Flux. It would be 7% of
# the corpus, matching AI-related questions strongly and crowding out the
# product answers those questions actually want. It belongs to a different
# product with a different audience; if it needs a bot, it needs its own.
# DOCKER_IMAGE_FILE_TREE and test logs are engineering exhaust, not documentation.
SKIP='(ai_university|DOCKER_IMAGE_FILE_TREE|^tests/|/archive/)'
# console-api (the FluxEdge console) and fluxai-fluxedge (FluxAI on FluxEdge)
# are left out: they describe a platform that no longer runs.
for NAME in fluxai-enterprise brimley fluxai-beaver; do
  if [ -d "$R/$NAME/docs" ]; then
    node tools/ingest.js --out "$OUT" --append --tier product-repo --exclude "$SKIP" --dir "$R/$NAME/docs"
  elif [ -d "$R/$NAME" ]; then
    node tools/ingest.js --out "$OUT" --append --tier product-repo --exclude "$SKIP" --dir "$R/$NAME"
  else
    echo "  missing: $NAME (gh repo clone RunOnFlux/$NAME)"
  fi
done

echo
echo "### tier: academy (long-form articles - the richest material we have)"
# These are database-backed, but every article is listed in the sitemap and
# rendered server-side, so no API key is needed: sampled articles came back
# with 1,488 / 1,908 / 2,953 words of real text. Category index pages are
# nearly empty and fall below the minimum chunk length on their own.
node tools/ingest.js --out "$OUT" --append --tier academy \
  --site https://sspwallet.io --include '/en/(academy|newsroom|guide|case-studies|support)' --max-pages 250
node tools/ingest.js --out "$OUT" --append --tier academy \
  --site https://zelcore.io --include '/(academy|newsroom|ecosystem|learn)' --max-pages 250

echo
echo "### tier: blog (dated announcements - useful for history, not for current fact)"
node tools/ingest.js --out "$OUT" --append --tier blog \
  --rss https://fluxofficial.medium.com/feed

echo
echo "### corpus summary"
python3 - "$OUT" <<'PY'
import json,sys,collections
rows=[json.loads(l) for l in open(sys.argv[1])]
t=collections.Counter(r.get('tier','docs') for r in rows)
w=collections.Counter()
for r in rows: w[r.get('tier','docs')]+=len(r['text'].split())
print(f"  {len(rows)} chunks, ~{sum(w.values()):,} words")
for k in t: print(f"    {k:<12} {t[k]:>5} chunks  ~{w[k]:>8,} words")
PY
mv "$OUT" "$FINAL"
echo "  written to $FINAL"
