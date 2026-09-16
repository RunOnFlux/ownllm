#!/bin/bash
# One-shot fine-tune on a rented CUDA box (FluxEdge or any GPU host).
#
#   scp finetune/data.tar.gz user@gpu:/work/          # the generated dataset
#   ssh user@gpu 'curl -fsSL https://raw.githubusercontent.com/RunOnFlux/ownllm/master/finetune/run-gpu.sh | bash'
#
# Trains LoRA on both candidate bases from the same data, converts each to a
# Q4_K_M GGUF with an ollama Modelfile, and leaves everything under /work.
# Needs: a GPU with >= 40 GB for tiny-h in bf16 (or set QLORA=1 for 24 GB),
# python3, git, cmake. Roughly 3-6 hours on an A100 for both runs.
set -euo pipefail
WORK=${WORK:-/work}
mkdir -p "$WORK" && cd "$WORK"
[ -d ownllm ] || git clone --depth 1 https://github.com/RunOnFlux/ownllm.git
cd ownllm
[ -f "$WORK/data.tar.gz" ] && tar xzf "$WORK/data.tar.gz" -C finetune/
[ -f finetune/data/train.jsonl ] || { echo "finetune/data/train.jsonl missing - scp data.tar.gz first"; exit 1; }
python3 -m venv .venv && . .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r finetune/requirements.txt
EXTRA=${QLORA:+--qlora}
for BASE in ibm-granite/granite-4.0-h-tiny; do
  NAME=fluxai-$(basename "$BASE" | tr 'A-Z.' 'a-z-' )-v1
  echo "##### $(date) training $BASE -> runs/$NAME"
  python3 finetune/train.py --base "$BASE" --data finetune/data/train.jsonl --eval finetune/data/eval.jsonl \
    --out "runs/$NAME" --epochs 2 --lr 2e-4 --r 16 --alpha 32 --max-len 4096 --batch 2 --grad-accum 8 --bf16 --grad-ckpt $EXTRA
  echo "##### $(date) converting $NAME"
  bash finetune/merge_and_convert.sh "$BASE" "runs/$NAME/adapter" "$NAME"
done
echo "##### $(date) done. GGUFs and Modelfiles under runs/gguf/. Serve with: ollama create <name> -f runs/gguf/<name>/Modelfile"
