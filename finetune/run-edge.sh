#!/bin/bash
# Training job for a FluxEdge pod (or any CUDA container with no shell access).
#
# FluxEdge gives a Kubernetes pod with a GPU, a public HTTPS ingress per
# declared port, and nothing else: no SSH, no exec, no working log endpoint.
# So this script is the whole job: it installs, fetches the dataset from the
# repo, trains, converts, and then SERVES its results and logs over HTTP on
# $PORT so the operator can watch progress and download the GGUF. Every step
# appends to /work/out/log.txt, which is readable at <ingress>/log.txt from
# the first minute; a DONE or FAILED marker ends it.
#
# Env: BASES (space-separated HF ids, default tiny-h + qwen3.5-2b), EPOCHS,
# QLORA=1 (24 GB cards), DATA_URL (tar.gz with data/train.jsonl + eval.jsonl),
# REPO (git URL), PORT (default 8080).
set -uo pipefail
PORT=${PORT:-8080}
WORK=${WORK:-/work}; OUT=$WORK/out; mkdir -p "$OUT"
LOG=$OUT/log.txt
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
# serve results + log from the start, in the background
( cd "$OUT" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
log "job start on $(hostname); gpu: $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo none)"
REPO=${REPO:-https://github.com/RunOnFlux/ownllm.git}
DATA_URL=${DATA_URL:-https://github.com/RunOnFlux/ownllm/raw/master/finetune/data.tar.gz}
BASES=${BASES:-"ibm-granite/granite-4.0-h-tiny Qwen/Qwen3.5-2B"}
EPOCHS=${EPOCHS:-2}
(
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >>"$LOG" 2>&1 && apt-get install -y -qq git cmake build-essential curl >>"$LOG" 2>&1
  cd "$WORK"
  [ -d ownllm ] || git clone --depth 1 "$REPO" ownllm >>"$LOG" 2>&1
  cd ownllm
  log "fetching dataset $DATA_URL"
  curl -fsSL "$DATA_URL" -o /tmp/data.tar.gz && tar xzf /tmp/data.tar.gz -C finetune/
  log "train $(wc -l < finetune/data/train.jsonl) / eval $(wc -l < finetune/data/eval.jsonl) examples"
  pip install -q -r finetune/requirements.txt >>"$LOG" 2>&1
  log "deps installed; torch $(python3 -c 'import torch;print(torch.__version__, torch.cuda.is_available())')"
  for BASE in $BASES; do
    NAME=fluxai-$(basename "$BASE" | tr 'A-Z.' 'a-z-')-v1
    log "##### training $BASE -> runs/$NAME (epochs $EPOCHS${QLORA:+, qlora})"
    python3 finetune/train.py --base "$BASE" --data finetune/data/train.jsonl --eval finetune/data/eval.jsonl \
      --out "runs/$NAME" --epochs "$EPOCHS" --lr 1e-4 --r 16 --alpha 32 --max-len 4096 --batch 2 --grad-accum 8 --bf16 --grad-ckpt ${QLORA:+--qlora} >>"$LOG" 2>&1
    log "##### converting $NAME"
    bash finetune/merge_and_convert.sh "$BASE" "runs/$NAME/adapter" "$NAME" >>"$LOG" 2>&1
    mkdir -p "$OUT/$NAME"
    cp runs/gguf/"$NAME"/*.Q4_K_M.gguf runs/gguf/"$NAME"/Modelfile "$OUT/$NAME/" 2>>"$LOG" || true
    tar czf "$OUT/$NAME-adapter.tar.gz" -C "runs/$NAME" adapter train-config.json 2>>"$LOG" || true
    cp runs/"$NAME"/log-history.json "$OUT/$NAME-loss.json" 2>/dev/null || true
    log "##### $NAME ready: $(ls -la "$OUT/$NAME" | tail -n +2 | awk '{print $9, $5}' | tr '\n' ' ')"
  done
) && log "DONE" || log "FAILED (see above)"
# keep serving so the artifacts can be downloaded; the operator stops the rental
wait
