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
# Usage: tools/build-corpus.sh [output.jsonl]
set -euo pipefail
OUT="${1:-images/docsbot/docs/corpus.jsonl}"
R="$HOME/repos"
rm -f "$OUT"

echo "### tier: facts (generated from FluxOS source - the authoritative numbers)"
# Regenerated every build so it cannot drift from the code it describes, and so
# derived values are stated rather than computed. Every model tested failed to
# work out that 1056000 blocks is about 12 months; stating it turns a
# calculation they get wrong into a lookup they get right.
if [ -d "$R/flux/ZelBack" ]; then
  node tools/facts-from-source.js "$R/flux" > images/docsbot/docs/flux-facts.md
  node tools/ingest.js --out "$OUT" --append --tier facts --dir images/docsbot/docs
else
  echo "  missing: $R/flux (FluxOS source) - fact sheet not regenerated"
fi

echo
echo "### tier: docs (authoritative, current)"
node tools/ingest.js --out "$OUT" --append --tier docs \
  --dir "$R/flux-docs/docs" \
  --dir "$R/ssp-docs" \
  --dir "$R/flux/docs"

echo
echo "### tier: whitepaper"
# The PDFs, not the repo's markdown: repos/ under it is vendored source.
node tools/ingest.js --out "$OUT" --append --tier whitepaper \
  --pdf "$R/fluxwhitepaper/FluxWhitepaper.pdf" \
  --pdf "$R/fluxwhitepaper/FluxWhitepaper-Short.pdf"

echo
echo "### tier: website (product pages, marketing tone but current)"
LANGS='/(zh|vi|tr|ru|pt-BR|pl|ko|ja|it|id|fr|es|de|nl)(/|$)'
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://runonflux.com --max-pages 120
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://sspwallet.io --exclude "$LANGS" --max-pages 200
node tools/ingest.js --out "$OUT" --append --tier website \
  --site https://zelcore.io --max-pages 220

echo
echo "### tier: product (deployment guidance - the highest-value pages for user questions)"
# cloud.runonflux.com is the fluxos-frontend deploy UI, server-rendered, and its
# sitemap covers the register flow, every marketplace app including the game
# servers, and the comparison pages. This is what someone asking "how do I
# deploy X on Flux" actually needs.
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://cloud.runonflux.com --max-pages 120

# AI products. ai.runonflux.com has 10 tutorial pages, which are the useful
# part; beaverai.app publishes 78 blog posts.
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://ai.runonflux.com --exclude '/images/' --max-pages 60
node tools/ingest.js --out "$OUT" --append --tier product \
  --site https://beaverai.app --max-pages 120

# No sitemap on these, so only the landing page is reachable. The gap is filled
# from their repositories below.
for SITE in https://fluxedge.ai https://fluxcore.ai https://fluxai.io https://brimley.ai; do
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
for NAME in fluxai-enterprise brimley console-api fluxai-beaver fluxai-fluxedge; do
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
