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

**Sequence length must cover the longest pair.** mlx-lm truncates from the end,
so a pair longer than `--max-seq-length` loses its completion and the masked
loss becomes 0/0 = NaN, which poisons the whole run from the first step (the
first v2 attempt at 3072 tokens did exactly that: the MCP-surface prompts carry
3.7-6.2k tokens of schema). `render_mlx.py --max-tokens` (default 6144) drops
anything longer, and the v2 run trains at `--max-seq-length 6144`. tiny-h is
36 Mamba-2 layers + 4 attention layers, so memory grows roughly linearly with
sequence length and 6144 fits on 36 GB with `--grad-checkpoint`.

**The prompt must end with the assistant header.** The renderer puts the
generation prompt (`<|start_of_role|>assistant<|end_of_role|>`) at the end of the
prompt and trains only on the turn body, exactly as the model is served. An
earlier version put the header in the completion; the model learned to re-emit
it and, once fused onto the bf16 base, looped on `<tool_call>assistant<tool_call>`.

**Never fuse/convert while training.** Both share Metal memory; a checkpoint
build next to a running job killed the trainer and left the ollama runner in
an error state (empty responses until restarted).

v3 data (`gen-deploy.js`, on top of v2): dialogues never call a tool the
surface does not offer - when the request needs a missing tool the assistant
says so and points at Flux Cloud; edits after a quote (instances, RAM, cores,
disk, term, region, name, env, image tag, port) each rebuild and re-quote;
docker-compose pastes become multi-component specs (host ports dropped,
service hostnames rewritten to `flux<component>_<app>`, `build:` refused with
instructions); GitHub URLs get the "push an image first" answer; resource
stats via flux_get_app_stats; German, Spanish, French and Czech requests
answered in kind; a quarter of openings pass through `noisy()` (typos, casing,
unit slang). `tools.json` carries all 15 MCP tools. `mix.js --docs-weight 2`
repeats the docs rows in the train split so one epoch gives docs two passes.
The eval has 17 cases; case 13 expects different behaviour depending on
whether the surface offers the stats tool.

v2 run (`finetune/lora-v2.yaml`): rank 32, 24 layers, lr 5e-5, seq 6144, 12k
iterations over 25.3k pairs from 6.7k conversations; the deploy dialogues are
generated on six system prompts and four tool-schema variants (see
`surfaces.js`) so the model no longer depends on one exact prompt.

## Train on a rented GPU

FluxEdge premium (Hyperstack) nodes currently come up **cordoned**: the pod
never schedules and the deployment is reaped after ~5 minutes with no error.
Only the FluxEdge team can uncordon (Rancher > Cluster > Nodes > Uncordon, or
`kubectl uncordon <node>`), so `tools/vast.js` is the working path. It runs the
same `run-edge.sh` job and publishes the log and artifacts on the instance's
mapped port 8080.

```
python3 -m venv finetune/.venv-vast && finetune/.venv-vast/bin/pip install vastai
echo "<api key>" > ~/.vast.key && chmod 600 ~/.vast.key
node tools/vast.js offers --gpu A100_SXM4 --max-price 1.5
node tools/vast.js rent                 # cheapest A100 80 GB, MAXLEN 8192, 1 epoch
node tools/vast.js log --lines 30       # GPU, kernels, [data], losses
node tools/vast.js fetch runs/vast-v3   # adapter + GGUF + Modelfile (streamed)
node tools/vast.js stop                 # bills until destroyed
```

**Sequence length on the GPU path is 8192, not 6144.** With all 15 MCP tools in
the schema every full-surface example is longer than 6144 tokens, and `train.py`
drops what does not fit rather than mislabel it: a 6144 run silently trained on
zero full-surface examples (`dropped={'assistant tokens truncated away': 991}`).
At 8192 nothing is dropped (longest 8,153) and an 80 GB A100 holds it at batch 1
with grad-accum 8, about 10 s/step.

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
