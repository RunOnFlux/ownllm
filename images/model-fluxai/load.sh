#!/bin/sh
# Install our fine-tuned model into a pool's ollama engine.
#
# Published as an asset of a GitHub release on this repository and fetched by
# the pool's boot component (see tools/gen.js, profile pool-fluxai). Why not a
# registry: ollama.com would be a third-party account, and a bare GGUF pulled
# from Hugging Face arrives with no Go chat template, so ollama refuses tool
# calls. Uploading the file to the engine ourselves - POST /api/blobs, then
# /api/create with our template - keeps the whole path inside our GitHub.
#
# Env (set by the spec): ENGINE_URL, MODEL_NAME, MODEL_RELEASE, MODEL_SHA256.
# MODEL_SHA256 pins the content, so a changed release asset cannot silently
# swap the model out from under a deployed app.
set -eu
U=${ENGINE_URL:-http://localhost:11434}
NAME=${MODEL_NAME:-fluxai:tiny}
REL=${MODEL_RELEASE:?MODEL_RELEASE (release download base URL) required}
WANT=${MODEL_SHA256:-}
GGUF=/tmp/model.gguf

echo "waiting for engine at $U"
until curl -sf "$U/api/tags" >/dev/null 2>&1; do sleep 5; done

if curl -sf "$U/api/tags" | grep -q "\"$NAME\""; then
  echo "$NAME already installed"
  exit 0
fi

# Release assets are capped at 2 GB each, so the GGUF ships in parts; append
# them one at a time rather than downloading all of them and concatenating,
# which would need twice the disk.
rm -f "$GGUF"
PARTS=$(curl -sfL "$REL/parts.txt") || { echo "FAILED fetching parts.txt"; exit 1; }
for p in $PARTS; do
  echo "downloading $p"
  curl -sfL "$REL/$p" >> "$GGUF" || { echo "FAILED downloading $p"; exit 1; }
done

GOT=$(sha256sum "$GGUF" | cut -d' ' -f1)
if [ -n "$WANT" ] && [ "$GOT" != "$WANT" ]; then
  echo "FAILED checksum: got $GOT want $WANT"; exit 1
fi
echo "model $GOT verified ($(wc -c < "$GGUF") bytes)"

echo "uploading blob"
curl -sf -X POST -H 'Content-Type: application/octet-stream' -T "$GGUF" "$U/api/blobs/sha256:$GOT" >/dev/null \
  || { echo "FAILED blob upload"; exit 1; }

curl -sfL "$REL/create.json" -o /tmp/create.tmpl || { echo "FAILED fetching create.json"; exit 1; }
sed -e "s/DIGESTPLACEHOLDER/$GOT/" -e "s|MODELNAMEPLACEHOLDER|$NAME|" /tmp/create.tmpl > /tmp/create.json
rm -f "$GGUF"   # the engine has its own copy now

echo "creating $NAME"
curl -s "$U/api/create" -d @/tmp/create.json | tail -c 300
echo
curl -sf "$U/api/tags" | grep -q "\"$NAME\"" && echo "installed $NAME" || { echo "FAILED create"; exit 1; }
