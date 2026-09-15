#!/usr/bin/env bash
# merge a lora adapter into its base, convert to gguf, quantize, write an
# ollama modelfile.
#
#   bash finetune/merge_and_convert.sh <base> <adapter-dir> <out-name> [ollama-base-tag]
#   bash finetune/merge_and_convert.sh ibm-granite/granite-4.0-h-tiny runs/tinyh-v1/adapter tinyh-v1 granite4:tiny-h
#
# produces, under $OUT_ROOT/<out-name>/ (default runs/gguf):
#   merged/              bf16 hf checkpoint (base + adapter, merge_and_unload)
#   <name>.bf16.gguf     lossless conversion
#   <name>.Q4_K_M.gguf   what ollama serves (~4.3 GB for tiny-h)
#   Modelfile            FROM the q4 gguf + granite template copied from ollama
#
# notes
# - qlora adapters are merged into the *bf16* base, not the 4-bit one. that is
#   standard practice; the delta is small and llama.cpp needs a full-precision
#   model to convert anyway.
# - llama.cpp's convert_hf_to_gguf.py has supported granitemoehybrid since
#   mid-2025 (b5xxx). if it says "model architecture not supported", git pull.
# - the chat template: the gguf carries the hf jinja template as
#   tokenizer.chat_template, but ollama uses its own go templates and only
#   auto-detects a handful. to be safe we copy the TEMPLATE / stop parameters
#   from the library model the base corresponds to (`ollama show --modelfile
#   granite4:tiny-h`), which is the exact template with tool-call rendering
#   that granite4:tiny-h serves today. pass "" as the 4th arg to skip that and
#   rely on ollama's detection.
set -euo pipefail

BASE=${1:?base model id or path}
ADAPTER=${2:?adapter dir (contains adapter_config.json)}
NAME=${3:?output name, e.g. tinyh-v1}
OLLAMA_BASE=${4-granite4:tiny-h}
OUT_ROOT=${OUT_ROOT:-runs/gguf}
LLAMA_DIR=${LLAMA_DIR:-$HOME/llama.cpp}
QUANT=${QUANT:-Q4_K_M}
PY=${PY:-python3}

OUT="$OUT_ROOT/$NAME"
mkdir -p "$OUT"
MERGED="$OUT/merged"

# ---- 1. merge adapter into base (bf16) ----------------------------------------
if [ ! -f "$MERGED/config.json" ]; then
  echo "[merge] $BASE + $ADAPTER -> $MERGED"
  $PY - "$BASE" "$ADAPTER" "$MERGED" <<'PYEOF'
import sys, torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
base, adapter, out = sys.argv[1:4]
# cpu merge is fine (a few minutes for 7B); use cuda if present for speed.
dev = "cuda" if torch.cuda.is_available() else "cpu"
model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.bfloat16, trust_remote_code=True, device_map={"": dev})
model = PeftModel.from_pretrained(model, adapter)
model = model.merge_and_unload()
model.save_pretrained(out, safe_serialization=True, max_shard_size="4GB")
# tokenizer from the adapter dir (train.py saved it there) so pad/eos match
AutoTokenizer.from_pretrained(adapter).save_pretrained(out)
print("merged ->", out)
PYEOF
else
  echo "[merge] $MERGED exists, skipping"
fi

# ---- 2. llama.cpp (clone + build quantizer if missing) ------------------------
if [ ! -d "$LLAMA_DIR" ]; then
  echo "[llama.cpp] cloning to $LLAMA_DIR"
  git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA_DIR"
fi
$PY -m pip install -q -r "$LLAMA_DIR/requirements/requirements-convert_hf_to_gguf.txt"

QUANTIZE="$LLAMA_DIR/build/bin/llama-quantize"
if [ ! -x "$QUANTIZE" ]; then
  echo "[llama.cpp] building llama-quantize (cpu build; no cuda needed)"
  cmake -S "$LLAMA_DIR" -B "$LLAMA_DIR/build" -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF >/dev/null
  cmake --build "$LLAMA_DIR/build" --config Release --target llama-quantize -j "$(nproc 2>/dev/null || sysctl -n hw.ncpu)"
fi

# ---- 3. convert + quantize ----------------------------------------------------
BF16="$OUT/$NAME.bf16.gguf"
Q="$OUT/$NAME.$QUANT.gguf"
if [ ! -f "$BF16" ]; then
  echo "[convert] $MERGED -> $BF16"
  $PY "$LLAMA_DIR/convert_hf_to_gguf.py" "$MERGED" --outtype bf16 --outfile "$BF16"
fi
if [ ! -f "$Q" ]; then
  echo "[quantize] $BF16 -> $Q ($QUANT)"
  "$QUANTIZE" "$BF16" "$Q" "$QUANT"
fi

# ---- 4. ollama modelfile ------------------------------------------------------
MF="$OUT/Modelfile"
{
  echo "# built by finetune/merge_and_convert.sh from $BASE + $ADAPTER"
  echo "FROM ./$NAME.$QUANT.gguf"
  echo "PARAMETER num_ctx 16384"
  echo "PARAMETER temperature 0"
  if [ -n "$OLLAMA_BASE" ] && command -v ollama >/dev/null && ollama show --modelfile "$OLLAMA_BASE" >"$OUT/.base.modelfile" 2>/dev/null; then
    # copy TEMPLATE (multi-line, triple-quoted) and stop tokens from the library model
    echo "# template + stops copied from ollama library model $OLLAMA_BASE"
    # prints from the TEMPLATE line through the closing """ (single- or multi-line)
    awk '/^TEMPLATE /{p=1; print; if ($0 !~ /^TEMPLATE """$/ && $0 ~ /"""$/) p=0; next} p{print; if (/"""$/) p=0}' "$OUT/.base.modelfile"
    grep -E '^PARAMETER stop' "$OUT/.base.modelfile" || true
    grep -E '^SYSTEM' "$OUT/.base.modelfile" || true
  else
    echo "# no TEMPLATE: ollama will pick a template from the gguf's embedded"
    echo "# chat_template. check tool calls work; if not, paste the TEMPLATE"
    echo "# block from: ollama show --modelfile $OLLAMA_BASE"
  fi
} >"$MF"

cat <<MSG

done.
  merged hf model : $MERGED
  gguf (bf16)     : $BF16
  gguf ($QUANT)   : $Q
  modelfile       : $MF

serve locally:
  cd $OUT && ollama create $NAME -f Modelfile && ollama run $NAME
publish for the ownllm pools (they pull by tag via the MODELS= env in the app spec):
  ollama cp $NAME <namespace>/$NAME:q4   # namespace = your ollama.com account
  ollama push <namespace>/$NAME:q4
  then set MODELS="<namespace>/$NAME:q4" in the pool spec (specs/ownllm*.json)
MSG
