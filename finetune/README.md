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

A stronger teacher (any OpenAI-compatible endpoint) improves the docs set;
the deploy set does not depend on the teacher's judgement.

## Train, convert, serve

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
