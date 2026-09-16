#!/bin/sh
# LoRA fine-tune on Apple Silicon with mlx-lm, then fuse to a plain HF folder
# that merge_and_convert.sh's llama.cpp step can turn into a GGUF.
#
#   sh finetune/train_mlx.sh Qwen/Qwen3.5-2B runs/qwen35-2b-v1 [iters=1200] [batch=2]
#   sh finetune/train_mlx.sh ibm-granite/granite-4.0-h-tiny runs/tinyh-v1 800 1
#
# Memory: a 2B model in bf16 trains comfortably in 36 GB; tiny-h (7B total)
# in bf16 is tight - pass QUANT=1 to LoRA on a 4-bit base (QLoRA-style).
# Data: run finetune/mix.js then render_mlx.py first (prompt/completion pairs
# so the loss is on assistant tokens only: --mask-prompt).
set -e
BASE=${1:?base model (HF id)}; OUT=${2:?run dir}; ITERS=${3:-1200}; BATCH=${4:-2}
PY=$(dirname "$0")/.venv-mlx/bin/python
DATA=$(dirname "$0")/data/mlx-$(basename "$OUT")
MODEL=$BASE
if [ -n "$QUANT" ]; then
  MODEL=$OUT/base-4bit
  [ -d "$MODEL" ] || $PY -m mlx_lm.convert --hf-path "$BASE" -q --q-bits 4 --mlx-path "$MODEL"
fi
$PY $(dirname "$0")/render_mlx.py --base "$BASE" --data $(dirname "$0")/data/train.jsonl --eval $(dirname "$0")/data/eval.jsonl --out "$DATA"
$PY -m mlx_lm.lora --model "$MODEL" --train --data "$DATA" --adapter-path "$OUT/adapter" \
  --iters "$ITERS" --batch-size "$BATCH" --learning-rate 5e-5 --num-layers 16 --max-seq-length 6144 \
  --mask-prompt --steps-per-eval 100 --steps-per-report 20 --save-every 200 --grad-checkpoint
# fuse the adapter into a full model folder (HF layout) for GGUF conversion
$PY -m mlx_lm.fuse --model "$BASE" --adapter-path "$OUT/adapter" --save-path "$OUT/merged" --de-quantize
echo "fused model in $OUT/merged - convert with: python llama.cpp/convert_hf_to_gguf.py $OUT/merged --outtype bf16 --outfile $OUT/model.bf16.gguf"
