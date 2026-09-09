#!/bin/sh
# Idempotent: `ollama pull` is a no-op when the digest is already present, so a
# restart on the same node costs one registry HEAD per model, not a re-download.
set -e

/bin/ollama serve &
SERVE_PID=$!

until /bin/ollama list >/dev/null 2>&1; do sleep 2; done

for m in $MODELS; do
  echo "==> pulling $m"
  /bin/ollama pull "$m" || echo "!! pull failed for $m, continuing"
done

# Readiness marker: the gate serves 503 until this exists, which keeps FDM from
# routing traffic to an instance that is still downloading 13 GB of weights.
touch "${OLLAMA_MODELS}/.ready"
echo "==> ready"

wait "$SERVE_PID"
