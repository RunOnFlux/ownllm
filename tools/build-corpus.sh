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
