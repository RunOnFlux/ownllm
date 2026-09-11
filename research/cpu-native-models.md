# CPU-native model architectures for the Flux docs bot

Research project. Goal: find out, by measurement on Flux nodes, whether a model
built for CPUs - ternary weights, add/subtract instead of multiply - answers
documentation questions faster than the 4-bit quantised transformer we run now,
without answering them worse. If it does, it becomes the engine; if it does
not, this document records why, with numbers, so nobody re-runs the experiment
on a hunch.

Everything below that is stated as a number was either measured by us on the
`ownllmbench` rig or read from a source that is linked. Claims we have not yet
verified are marked as such.

## 1. Why this is worth doing

What we measured on Flux (Stratus, 12 cores bought, 8 threads used):

| | granite4:tiny-h Q4_K_M (current) |
|---|---|
| generation | ~14 tok/s |
| prefill | 153-205 tok/s at 8 threads (thread peak; 12 threads was 19% slower) |
| share of latency that is prefill, 2,118-token docs-bot prompt | 89% |
| node memory bandwidth ceiling (measured) | ~16.6 GB/s |
| node-to-node variance | 35% to 6x |

Two conclusions drove the current design and they bound this project too:

1. **Generation is memory-bandwidth-bound.** tok/s ≈ bandwidth / bytes read per
   token. Smaller weights per token is the only lever.
2. **Prefill is compute-bound and dominates.** A RAG bot sends 2-3k tokens of
   context per question; the model reads it once at prefill speed. Shrinking
   the prompt (done: `PINNED_DOCS`, KV prefix reuse, 33% measured) and speeding
   up the matmul are the levers.

Ternary (1.58-bit) models attack both: weights are {-1, 0, +1}, stored at 2
bits, so a token reads 8x fewer bytes than fp16 and ~2.3x fewer than Q4_K_M
per parameter; and the matmul becomes additions, which is what
[bitnet.cpp](https://github.com/microsoft/BitNet)'s I2_S kernel exploits.

The honest caveat before any excitement: our current model is a MoE with ~1B
*active* parameters, so per generated token it already reads only about as
many bytes as a 2.4B dense ternary model does. The bandwidth argument alone
does **not** predict a generation win over granite4:tiny-h. The prefill kernel
and the 4x smaller resident set are where a win would come from - and prefill
is 89% of our latency, so that is the right place for it.

## 2. Candidates (verified 2026-09-11)

| model | params | format | size | licence | quality (published) | context |
|---|---|---|---|---|---|---|
| [microsoft/bitnet-b1.58-2B-4T](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T-gguf) | 2.4B, 4T tokens | I2_S GGUF | 1,188 MB | MIT | MMLU 53.17, GSM8K 58.38, avg 54.19 (Qwen2.5-1.5B: 55.23) | 4,096 |
| [microsoft/bitnet-embedding-270m](https://huggingface.co/microsoft/bitnet-embedding-270m) | 270M | I2_S GGUF | 367 MB | MIT | "competitive" (MTEB v2 prompts shipped); 1.32-1.74x F16 prefill, 8 threads x86 | - |
| [microsoft/bitnet-embedding-0.6b](https://huggingface.co/microsoft/bitnet-embedding-0.6b) | 0.6B | I2_S GGUF | 428 MB | MIT | 1.42-2.28x F16 prefill, 8 threads x86 | - |
| [tiiuae/Falcon-E-1B-Instruct](https://huggingface.co/tiiuae/Falcon-E-1B-Instruct-GGUF) | 1B | I2_S GGUF | 666 MB | falcon-llm-license (not MIT) | avg 13.40 vs Qwen2.5-1.5B 13.85 (TII's table) | - |
| [tiiuae/Falcon-E-3B-Instruct](https://huggingface.co/tiiuae/Falcon-E-3B-Instruct-GGUF) | 3B | I2_S GGUF | 1,000 MB | falcon-llm-license | avg 18.32 (TII's table) | - |

Microsoft's stated CPU numbers for the 2B-4T model: 29 ms per decoded token
(~34 tok/s), 0.4 GB non-embedding memory, "up to 6.17x" over the **fp16**
model on x86 - note fp16, not Q4. Their speedup figure is against a baseline
nobody runs on a CPU; it is not a prediction for us.

Not candidates, and why:

- Anything on ollama: there is no BitNet model in the ollama library and the
  I2_S format is bitnet.cpp's, not ggml's. ollama is out for this engine.
- `tdh111/bitnet-b1.58-2B-4T-GGUF` - `iq2_bn` only, an ik_llama.cpp format.
- Falcon-E goes to round two only: licence review first (it is a custom
  licence; redistribution inside a public GHCR image needs reading it).

## 3. Runtime

| option | status | notes |
|---|---|---|
| **bitnet.cpp** (`microsoft/BitNet`) | chosen for round one | Official I2_S kernels. Its server *is* llama-server (`run_inference_server.py` execs `build/bin/llama-server`), fork of llama.cpp dated 2026-07-15, so `/health`, `/v1/chat/completions`, `/v1/embeddings` all exist. Defaults: 2 threads, ctx 2048 - both overridden. |
| stock llama.cpp | round two | Has `LLM_ARCH_BITNET` (`src/models/bitnet.cpp`), a converter for `BitNetForCausalLM` (`conversion/bitnet.py`) and the `TQ1_0` (1.69 bpw) / `TQ2_0` (2.06 bpw) types. Would let us drop the fork, at the cost of Microsoft's tuned kernel. Worth measuring TQ2_0 against I2_S on the same node. |
| ollama | no | see above |

`images/ternary/` is the round-one engine: bitnet.cpp built for x86 with
`GGML_NATIVE=OFF` (AVX2/FMA, so a CI-runner build cannot SIGILL on an older
node), two llama-server processes (chat, embedder), and `shim.js` in front
translating ollama's `/api/generate` and `/api/embed`. The shim is the
methodological point: the gate, the docs bot, `bench-models.js` and
`eval-quality.js` run against it unchanged, so the comparison with granite4 is
on identical code paths.

Deployed with `node tools/gen.js --name ownllmternary --profile ternary
--api-only --docsbot --port 34000 --instances 1`. Same three components as the
docs bot, minus the puller (the weights are in the image, 1.7 GB, under the
5 GB limit): engine 8 cpu / 6,000 MB / 5 GB, gate, docsbot.

## 4. Hypotheses

- **H1 (prefill)** - BitNet-2B-4T I2_S prefills a 2,000-token docs-bot prompt
  at ≥ 2x granite4:tiny-h's tok/s on the same node at 8 threads.
- **H2 (generation)** - generation is ≥ 1.5x. (Weak expectation, see §1.)
- **H3 (quality)** - on `eval-quality.js`'s grounded questions it scores within
  1 point of granite4:tiny-h's 7/9, and refuses the off-corpus control.
- **H4 (embedder)** - bitnet-embedding-270m retrieves the right chunk for the
  eval questions as often as granite-embedding:278m (top-4 hit rate), at ≥ 1.3x
  embedding throughput.
- **H5 (footprint)** - the full stack fits a NIMBUS tier (≤ 7 cores, 28 GB) with
  room for two parallel slots; today the docs bot is STRATUS-only.

## 5. Experiments

Each has a command, an existing tool, and a number it produces. Run all on the
same node, then on three others - the node variance we measured (35% to 6x)
makes a single-node result meaningless.

| # | question | how | output |
|---|---|---|---|
| E1 | raw speed | `FILLER_WORDS=1200 FLUX_LLM_KEY=… node tools/bench-models.js <host> bitnet-2b-4t` and the same against the granite rig | prefill tok/s, gen tok/s |
| E2 | thread scaling | `tools/thread-sweep.js` against the rig (THREADS 4/6/8 via redeploy) | tok/s per thread count; does the 8-thread peak hold for ternary? |
| E3 | grounded quality | `FLUX_LLM_KEY=… node tools/eval-quality.js <host> bitnet-2b-4t` | score /9, verbosity, refusal on the control |
| E4 | end-to-end | the docs bot's own `/ask` with the 9 eval questions, timed to first delta and to done, against `ownllmdocs` | TTFT and total, per question |
| E5 | embedder | index the corpus on the rig (it re-embeds at boot when the `.vec` model differs - `server.js loadVectors`), record boot time; then top-4 hit rate on the eval questions vs the granite `.vec` | chunks/s, hit rate |
| E6 | memory | `docker stats` on the node via the bench rig's SSH | resident MB at idle and mid-answer |

Success: H1 and H3 both hold. H1 alone means a faster bot that hallucinates;
H3 alone means nothing changed. H5 holding on top is what changes the price.

## 6. Known constraints and risks

- **4,096-token context.** The docs-bot prompt is `PINNED_DOCS` + `TOP_K=4`
  chunks + question, ~2-3k tokens. It fits, barely; a longer pinned facts file
  will not. The KV-prefix trick still applies.
- **Quality ceiling.** A 2.4B dense model against granite4's 7B-total MoE. The
  published averages sit around Qwen2.5-1.5B. Grounded answering is more
  forgiving than open QA, but "exact steps, no hallucination" is the bar.
- **Build is unverified until CI runs it.** The Dockerfile mirrors
  `setup_env.py compile()` plus `GGML_OPENMP=OFF`; if bitnet.cpp's kernels
  need OpenMP the build log will say so and the fix is `libomp` in the runtime
  stage.
- **Re-embedding the corpus** at boot with a new embedder is hours (granite
  took 4.5 h on ollama before we precomputed). Once the ternary embedder is
  chosen, `tools/embed-corpus.js` must learn to target the rig and write a
  per-model `.vec`.
- **Shim overhead** is one extra local hop per request; measured against
  ollama's own HTTP layer this is noise, but E1 vs a direct `/completion` call
  will confirm.
- **Falcon-E licence** is not MIT; not in a public image until read.

## 7. After round one

If ternary wins on H1/H3, the follow-ups, in order of return per effort:

1. **Stock llama.cpp TQ2_0** of the same weights: if it matches I2_S within
   10%, drop the fork and its build complexity.
2. **bitnet-embedding-0.6b** if 270m loses on H4.
3. **Our own model.** Microsoft publishes the bf16 master weights
   (`microsoft/bitnet-b1.58-2B-4T-bf16`) for fine-tuning. Supervised
   fine-tuning on the docs bot's own traffic - question, retrieved chunks,
   granite4's accepted answer - is a distillation of the bigger model into the
   faster one, on exactly the distribution we serve. This needs GPUs for the
   training step (hours on one A100-class card for a 2B model), not Flux CPU
   nodes; inference of the result runs on Flux. Not started until round one
   says the architecture is worth it.
4. **Falcon-E-3B** after licence review, as the quality-vs-speed midpoint.

If ternary loses, the fallback ideas on the same measurement rig: a smaller
granite (granite4:micro), speculative decoding with a ternary draft model, and
prompt compression - all cheaper than a new architecture.
