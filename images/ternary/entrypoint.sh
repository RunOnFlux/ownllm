#!/bin/sh
# Two llama-server processes (one model each - llama-server serves a single
# GGUF) and the ollama-compatible shim in front. If any of the three exits the
# container exits, so FluxOS restarts it rather than serving half an engine.
set -e
BIN=/opt/bitnet/bin
export LD_LIBRARY_PATH=$BIN
T=${THREADS:-8}

# Batch sizes are memory, not just speed: llama-server sizes its logits buffer
# at batch x vocab x 4 bytes, which at the default 2048 and BitNet's 128k
# vocab is ~1 GB for the chat server alone, and the embedder's 4 default slots
# each carried a 2048-token micro-batch. Together with the docs bot's 96-text
# embed batches that OOM-killed a 6 GB engine at 5 min. One chat slot with a
# 512 micro-batch (a 3k prompt takes six passes, which costs a little prefill
# speed and saves the gigabyte); the embedder keeps 4 slots at 512 - chunks
# are ~300 tokens - with a 2048-token context per slot.
$BIN/llama-server -m "$CHAT_GGUF" -c "${CTX:-4096}" -t "$T" -ngl 0 -cb -np 1 -b 512 -ub 512 \
  --host 127.0.0.1 --port 8081 --no-webui --metrics &
CHAT=$!
$BIN/llama-server -m "$EMBED_GGUF" -t "$T" -ngl 0 --embeddings --pooling mean -np 4 -c 2048 -b 2048 -ub 512 \
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
