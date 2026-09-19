#!/bin/sh
# Publish a fine-tuned GGUF as a GitHub release on this repository, in the
# shape images/model-fluxai/load.sh expects.
#
#   sh tools/publish-model.sh --gguf runs/tinyh-vast-v4/fluxai-tinyh-v4.Q4_K_M.gguf --tag model-v4
#
# Uploads: the GGUF split into <2 GB parts (the release asset limit), parts.txt
# listing them in order, create.json holding the chat template and parameters,
# and load.sh. Prints the MODEL_RELEASE URL and MODEL_SHA256 for the spec.
#
# The template is taken from the stock granite4:tiny-h model rather than
# committed, so it cannot drift from the one the fine-tune was trained against.
# Needs: gh (repo scope), ollama, python3, split.
set -eu
GGUF=""; TAG=""; CTX=16384; REPO=${REPO:-RunOnFlux/ownllm}
while [ $# -gt 0 ]; do
  case "$1" in
    --gguf) GGUF=$2; shift 2;;
    --tag) TAG=$2; shift 2;;
    --ctx) CTX=$2; shift 2;;
    --repo) REPO=$2; shift 2;;
    *) echo "unknown argument: $1"; exit 1;;
  esac
done
[ -n "$GGUF" ] && [ -f "$GGUF" ] || { echo "--gguf <path to .gguf> required"; exit 1; }
[ -n "$TAG" ] || { echo "--tag model-vN required"; exit 1; }

DIR=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

SHA=$(shasum -a 256 "$GGUF" | cut -d' ' -f1)
echo "model $GGUF"
echo "sha256 $SHA"

# 1.8 GB parts: under the 2 GB asset cap with room to spare
split -b 1800m "$GGUF" "$WORK/model.gguf.part-"
(cd "$WORK" && ls model.gguf.part-* | sort > parts.txt)
echo "split into $(wc -l < "$WORK/parts.txt" | tr -d ' ') parts"

ollama show --modelfile granite4:tiny-h > "$WORK/base.modelfile" 2>/dev/null \
  || { echo "need granite4:tiny-h locally for the chat template: ollama pull granite4:tiny-h"; exit 1; }
python3 - "$WORK" "$CTX" <<'PY'
import json, re, sys
work, ctx = sys.argv[1], int(sys.argv[2])
mf = open(f'{work}/base.modelfile').read()
tpl = re.search(r'TEMPLATE """(.*?)"""', mf, re.S)
if not tpl:
    raise SystemExit('no TEMPLATE block in the granite4:tiny-h modelfile')
body = {
    'model': 'MODELNAMEPLACEHOLDER',
    'files': {'model.gguf': 'sha256:DIGESTPLACEHOLDER'},
    'template': tpl.group(1),
    'parameters': {'num_ctx': ctx, 'temperature': 0},
}
stops = [s.strip().strip('"') for s in re.findall(r'^PARAMETER stop (.*)$', mf, re.M)]
if stops:
    body['parameters']['stop'] = stops
json.dump(body, open(f'{work}/create.json', 'w'))
print(f'create.json: template {len(tpl.group(1))} chars, {len(stops)} stop tokens, num_ctx {ctx}')
PY

cp "$DIR/images/model-fluxai/load.sh" "$WORK/load.sh"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "release $TAG exists; replacing assets"
  gh release upload "$TAG" "$WORK"/model.gguf.part-* "$WORK/parts.txt" "$WORK/create.json" "$WORK/load.sh" --clobber --repo "$REPO"
else
  gh release create "$TAG" "$WORK"/model.gguf.part-* "$WORK/parts.txt" "$WORK/create.json" "$WORK/load.sh" \
    --repo "$REPO" --title "$TAG" --notes "GGUF for the Flux pools. sha256 $SHA. Installed by images/model-fluxai/load.sh."
fi

echo
echo "MODEL_RELEASE=https://github.com/$REPO/releases/download/$TAG"
echo "MODEL_SHA256=$SHA"
