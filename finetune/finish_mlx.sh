#!/bin/sh
# After an mlx-lm LoRA run: fuse the adapter into the bf16 base, convert to
# GGUF, quantize to Q4_K_M, create the ollama model, and run the two evals.
#
#   sh finetune/finish_mlx.sh runs/tinyh-mac-v1 [adapter file, default adapters.safetensors] [name=fluxai-tinyh-v1]
#
# Fusing needs the ORIGINAL bf16 HF weights (ibm-granite/granite-4.0-h-tiny,
# ~14 GB download once); the 4-bit MLX base the adapter was trained on is
# fine for training but a fused 4-bit model converts to a poor GGUF.
set -e
set -o pipefail 2>/dev/null || true
RUN=${1:?run dir}; ADAPTER=${2:-adapters.safetensors}; NAME=${3:-fluxai-tinyh-v1}
BASE=ibm-granite/granite-4.0-h-tiny
PY=$(dirname "$0")/.venv-mlx/bin/python
LL=${LLAMA_DIR:-$HOME/repos/llama.cpp}
cd "$(dirname "$0")/.."
if [ -d "$RUN/merged" ]; then echo "== merged model exists, skipping fuse"; else
echo "== fuse $RUN/adapter/$ADAPTER into $BASE"
# the adapter was trained on the 4-bit MLX base; applying it to the bf16 original is the usual QLoRA merge
$PY -m mlx_lm.fuse --model "$BASE" --adapter-path "$RUN/adapter" --save-path "$RUN/merged" 2>&1 | grep -v "^\s*$" | tail -4
[ -d "$RUN/merged" ] || { echo "fuse produced no $RUN/merged"; exit 1; }
fi
# mlx-lm saves the MoE in its own SwitchGLU layout; llama.cpp wants HF's
[ -d "$RUN/merged-hf" ] || $(dirname "$0")/.venv-hf/bin/python $(dirname "$0")/mlx_to_hf.py "$RUN/merged" "$RUN/merged-hf"
[ -d "$LL" ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LL"
[ -x "$LL/build/bin/llama-quantize" ] || (cd "$LL" && cmake -B build -DGGML_METAL=ON >/dev/null && cmake --build build --target llama-quantize -j 8 >/dev/null)
[ -d "$LL/.venv" ] || (python3 -m venv "$LL/.venv" && "$LL/.venv/bin/pip" install -q -r "$LL/requirements/requirements-convert_hf_to_gguf.txt")
echo "== convert to GGUF"
[ -f "$RUN/$NAME.bf16.gguf" ] || "$LL/.venv/bin/python" "$LL/convert_hf_to_gguf.py" "$RUN/merged-hf" --outtype bf16 --outfile "$RUN/$NAME.bf16.gguf" 2>&1 | tail -2
[ -f "$RUN/$NAME.Q4_K_M.gguf" ] || "$LL/build/bin/llama-quantize" "$RUN/$NAME.bf16.gguf" "$RUN/$NAME.Q4_K_M.gguf" Q4_K_M 2>&1 | tail -1
echo "== ollama model $NAME"
# Template and stop tokens copied from the library model so tool calls
# render exactly as they do for granite4:tiny-h today (pulled if absent).
ollama show --modelfile granite4:tiny-h >/dev/null 2>&1 || ollama pull granite4:tiny-h
ollama show --modelfile granite4:tiny-h > "$RUN/base.modelfile" 2>/dev/null || true
{ echo "FROM ./$NAME.Q4_K_M.gguf"; echo "PARAMETER num_ctx 16384"; grep -E "^PARAMETER stop" "$RUN/base.modelfile" || true; awk '/^TEMPLATE/,/^"""$/' "$RUN/base.modelfile"; } > "$RUN/Modelfile"
(cd "$RUN" && ollama create "$NAME" -f Modelfile)
echo "== evals (ollama at localhost:11434)"
FLUX_LLM_KEY=local node tools/deploy-agent-eval.js --base http://localhost:11434/v1 --model "$NAME" --tools core 2>&1 | tail -30
FLUX_LLM_KEY=local EVAL_PROMPT=soft node tools/eval-quality.js localhost:11434 "$NAME" granite4:tiny-h 2>&1 | grep -E "grounding|fail|skip" | tail -20
echo "== done: $RUN/$NAME.Q4_K_M.gguf"
