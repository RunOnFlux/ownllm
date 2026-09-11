#!/bin/sh
# Two llama-server processes (one model each - llama-server serves a single
# GGUF) and the ollama-compatible shim in front. If any of the three exits the
# container exits, so FluxOS restarts it rather than serving half an engine.
set -e
BIN=/opt/bitnet/bin
export LD_LIBRARY_PATH=$BIN
T=${THREADS:-8}

$BIN/llama-server -m "$CHAT_GGUF" -c "${CTX:-4096}" -t "$T" -ngl 0 -cb \
  --host 127.0.0.1 --port 8081 --no-webui --metrics &
CHAT=$!
$BIN/llama-server -m "$EMBED_GGUF" -t "$T" -ngl 0 --embeddings --pooling mean -ub 2048 -b 2048 \
  --host 127.0.0.1 --port 8082 --no-webui &
EMB=$!
node /opt/bitnet/shim.js &
SHIM=$!

# POSIX sh has no `wait -n`; poll instead.
while :; do
  for p in $CHAT $EMB $SHIM; do
    if ! kill -0 "$p" 2>/dev/null; then echo "process $p exited, stopping engine"; kill $CHAT $EMB $SHIM 2>/dev/null; exit 1; fi
  done
  sleep 2
done
