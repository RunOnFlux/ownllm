# Fine-tuning a Flux model

One small model, two skills, replacing two general models:

- **Flux AI deploy agent** for the Flux Cloud chat row: size, quote, deploy
  after the user agrees, then manage (status, logs, restart, cancel).
- **Knowledge bot** answers for the docs assistant: grounded in retrieved
  documentation, cited, concise, refusing when the docs do not say.

Why a fine-tune and not a prompt: the failures measured with
`tools/deploy-agent-eval.js` are conventions, not intelligence - GB vs MB,
quote before deploy, never invent a key, what a Minecraft server for 20
players needs, ask instead of guess - and the docs bot's failures are the
same class (invented figures, wrong units, wandering off the sources). Those
are what supervised fine-tuning fixes, and a model that has them baked in
needs a few hundred tokens of prompt instead of 3-7k of tool schemas, which
on CPU is the difference between seconds and minutes to the first token.

## Base models

| Base | Why | Note |
|---|---|---|
| `ibm-granite/granite-4.0-h-tiny` (`granite4:tiny-h`) | fastest that formats tool calls: 13 tok/s gen, 58 prefill on Flux nodes | hybrid Mamba-2 MoE; LoRA on attention/Mamba/shared MLP |
| `Qwen/Qwen3.5-2B` (`qwen3.5:2b`) | dense, huge LoRA ecosystem; 3/4 on the deploy eval untrained | thinking must be off at serving |
| BitNet b1.58 2B-4T | 3x faster still, 1.2 GB | phase 2: QAT fine-tune from the bf16 master weights, 4k context |

Train the first two on the same data and let the eval choose.

## Data

Both generators write OpenAI-format chat JSONL (`{"messages": [...], "tools": [...]}`).

- `gen-deploy.js` - deploy dialogues **correct by construction**: every tool
  call comes from code over a sampled scenario (preset, resources, instances,
  region, term, flow). The teacher only paraphrases user lines, and each
  paraphrase must keep every number and name. Flows: estimate, deploy with
  confirmation, change of mind, decline, vague ask (question back), "skip the
  quote" (quote anyway), unit traps, management, off-topic. Tool surface:
  `tools-compact.js` - the keyless, ~900-token facade the product will expose.
- `gen-docs.js` - docs Q&A: the teacher writes user questions for a corpus
  chunk and answers them under the docs bot's exact prompt over a small
  retrieved-style context; kept only if every citation exists, every number
  is in a cited chunk, and there are no URLs. 15% refusals from unrelated
  contexts.

```
# a local hub over the pools is the cheapest teacher (gpt-oss:20b, 20 nodes)
export TEACHER_BASE=http://localhost:8799/v1 TEACHER_MODEL=gpt-oss:20b TEACHER_KEY=sk-flux-...
node finetune/gen-deploy.js --n 2000 --concurrency 12 --out finetune/data/deploy.jsonl
node finetune/gen-docs.js   --n 1500 --concurrency 12 --out finetune/data/docs.jsonl
node finetune/mix.js        # -> data/train.jsonl, data/eval.jsonl
```

The docs set can also be taught from inside Claude Code without any API
key: `batch-chunks.js` samples chunks with their retrieved-style contexts
into batch files, Claude (as subagents, in parallel) writes the questions
and grounded answers into `data/batches-out/`, and `verify-docs.js` keeps
only what verifies (citations exist, every number is in a cited chunk, no
URLs, refusals exact). That is the route used for v1; the deploy set does
not depend on the teacher's judgement either way.

## Train on this Mac (Apple Silicon, mlx-lm)

Measured on an M3 Max with 36 GB: `Qwen3.5-2B` runs out of Metal memory at
any useful sequence length (its linear-attention layers need ~15 GB at 1k
tokens) and `granite-4.0-h-tiny` fails with a gather-VJP error (mlx-lm cannot
differentiate through the MoE router). `granite-4.0-micro` (dense 3B, same
family and tool template) trains at ~10 GB peak but only ~0.2 it/s, about
thirteen hours per epoch over the 9.7k rendered pairs. Learning rate 2e-4
diverged (loss 3 -> 23 in 20 iterations); 5e-5 is stable (validation loss
1.97 -> 0.29 over 60 iterations), which is what train_mlx.sh uses. Use the Mac for smoke
tests and small runs; the real runs go to a GPU (below).

```
python3 -m venv finetune/.venv-mlx && finetune/.venv-mlx/bin/pip install mlx-lm transformers
sh finetune/train_mlx.sh Qwen/Qwen3.5-2B runs/qwen35-2b-v1 1200 2          # bf16, overnight on 36 GB
QUANT=1 sh finetune/train_mlx.sh ibm-granite/granite-4.0-h-tiny runs/tinyh-v1 800 1   # LoRA on a 4-bit base
```

`render_mlx.py` turns each assistant turn into a prompt/completion pair so
`--mask-prompt` gives assistant-only loss; `mlx_lm.fuse` writes a merged HF
folder that the llama.cpp conversion below turns into a GGUF.

## Train on a GPU (CUDA), convert, serve

```
pip install -r finetune/requirements.txt
python finetune/train.py --base ibm-granite/granite-4.0-h-tiny --data finetune/data/train.jsonl \
    --eval finetune/data/eval.jsonl --out runs/tinyh-v1 --epochs 2 --bf16 --dry-run   # check masking
python finetune/train.py ... (same, without --dry-run)                                 # GPU, hours
bash finetune/merge_and_convert.sh ibm-granite/granite-4.0-h-tiny runs/tinyh-v1/adapter fluxai-tinyh-v1
ollama create fluxai-tinyh-v1 -f runs/gguf/fluxai-tinyh-v1/Modelfile
```

`Dockerfile.train` packages this for a rented GPU (FluxEdge or any CUDA
box). tiny-h needs a 40 GB card in bf16 or a 24 GB card with `--qlora`.

## Acceptance

Before it goes near a paid action: `finetune/eval_after.md`. The deploy eval
(`tools/deploy-agent-eval.js`, keyless) and the grounding eval
(`tools/eval-quality.js`) run against the ollama-served model. Bar: no
unconfirmed deploy, no invented key, quote before deploy on every case,
units right, and grounding at or above tiny-h's 7/9.

Whatever the model scores, the product keeps two guards: the UI owns the
Deploy button and is the only thing that sends `confirm=true`, and keys are
injected server-side, never seen by the model.
