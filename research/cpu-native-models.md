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

## 6a. Round-one log

**2026-09-11, first deploy.** `ownllmternary` registered via `tools/deploy.js`
(1 instance, 8 cores / 6,000 MB, node 104.157.37.8). Image built in CI first
try, 1.38 GB compressed; both llama-servers loaded, gate ready in minutes.

- **Embedder (E5, partial):** bitnet-embedding-270m indexed the corpus at
  ~7.7 chunks/s (llama-server log: 4 slots, ~1,000 tokens/s) while sharing
  the 8 cores with chat requests. Full corpus ≈ 1 h. granite-embedding:278m on
  ollama took 4.5 h, under a 500 MB OOM constraint - not the same conditions,
  but the gap is not noise. Hit rate (H4) still to measure.
- **Chat (E1, confounded):** with the embedder running concurrently, prefill
  92-98 tok/s at 21 / 772 / 2,003 prompt tokens and generation 8.7-11.1 tok/s.
  Not a clean number; re-measure once indexing finishes.
- **Bug found:** llama-server did not apply BitNet's `Role: text<|eot_id|>`
  chat template, so the model echoed the prompt and never stopped ("Paris. The
  capital of France is Paris. The capital of..."). Fixed in 1.4.1: the shim
  formats the prompt itself, calls `/completion` with explicit stop strings,
  and applies the model card's sampling (temp 0.6, top_p 0.9) plus
  repeat_penalty 1.1. Quality numbers (E3) wait for that image.
- The bench's 4k-context probe must use `FILLER_WORDS=500`: random words
  tokenize at ~5 tokens each.
- **OOM at 6,000 MB**, five minutes into indexing on 1.4.0: the chat
  llama-server's default batch 2048 means a ~1 GB logits buffer (128k
  vocab), and the embedder ran 4 slots at a 2,048-token micro-batch. 1.4.3
  pins `-np 1 -b 512 -ub 512` on chat, `-np 4 -c 2048 -ub 512` on the
  embedder, and the profile moves to 12,000 MB. Note for H5: a 2B ternary
  model's *weights* are 1.2 GB; the *process* is not.
- Two more infrastructure bugs surfaced by the rig, both fixed in 1.4.2: idle
  keep-alive sockets closed by the shim (Node, 5 s) and by llama-server
  (httplib, 5 s) produced "fetch failed" on the next request, and the docs
  bot answered any indexing error by starting over from chunk 0.

**2026-09-11, granite4:tiny-h baseline (same day, same harness,
`FILLER_WORDS=500`)** on the three production `ownllmdocs` instances:

| instance | gen tok/s | prefill tok/s | 3k-token TTFT | grounded (E3) |
|---|---|---|---|---|
| 80.208.17.22 | 1.3 | 62 | 64 s | 7/9 |
| 86.210.144.251 | 11.2 | 107 | 37 s | - |
| 91.192.45.97 | 14.8 | 137 | 29 s | - |

Same image, same spec, an 11x spread in generation speed between nodes. Any
ternary-vs-granite number has to name the node it was taken on, and the only
comparison that means anything is on the same node - which one app per node
prevents. Until a paired run exists, the rule is: compare against the
*median* node (86.210.144.251) and flag it. The router's latency-aware
selection is what turns this spread into a product advantage rather than a
liability: it measured the slow node and routes around it.

**2026-09-11 23:10, E3 grounded quality, BitNet-b1.58-2B-4T (1.4.4 image, temp 0.1):
2/9** against granite4:tiny-h's 7/9 on the same harness the same evening.
Average answer 804 chars vs 86 - it does not stop, and it does not read:

| probe | context | answer |
|---|---|---|
| eval prompt, docs in user turn | 271 tok | "1 block. Maximum RAM is 100 blocks..." |
| eval prompt, docs in system turn | 271 tok | same |
| one paragraph stating "NIMBUS ... 7 cores, 28000 MB RAM" | 114 tok | **"70000 MB RAM and 400 GB."** |
| no context | 20 tok | "1. The amount of RAM ... is 1. The amount ..." |
| repeat_penalty 1.0 vs 1.1 | - | no difference in kind |

Confounds checked: not the chat template (fixed in 1.4.1; free-form answers
are coherent - "Docker is a software that allows users to create containers
of applications, manage them, and deploy them."), not the repeat penalty, not
context placement, not context length. With the fact one sentence away the
model merges "7 cores" and "28000 MB" into 70000. **H3 fails**, and not
narrowly: this is below the bar for a bot whose whole job is to copy figures
from documentation.

One confound is *not* closed: the I2_S kernel was built with `GGML_NATIVE=OFF`
and `GGML_OPENMP=OFF`, a build Microsoft does not publish numbers for. A
subtly wrong kernel would look exactly like a weak model. Round two's
stock-llama.cpp TQ2_0 run of the same weights is now a correctness check
first and a speed comparison second: if TQ2_0 reads "28000" and I2_S reads
"70000", the kernel is the story. If both fail, the architecture at 2.4B is.

Either way the conclusion for the *program* holds and sharpens: a 2B ternary
generalist is not the CPU-native model for grounded QA. The extract-first
pipeline (a 100M reader copies the span; the generator only rephrases what
it is handed) is precisely the design that removes this failure mode, because
the model never has to read a number correctly - it is given the sentence.

**2026-09-12 01:10, indexing post-mortem.** The rig never indexed past chunk
672 on 1.4.3 or 1.4.4. The embedding model's context is **512 tokens** (the
same as granite-embedding's), and one chunk - a marketplace README table -
is 823 tokens even cut to 2,000 characters, because table text tokenizes at
~2.4 chars/token. llama-server refuses an over-long input; **ollama truncates
it silently**, which is why the granite index never showed the problem. The
docs bot's restart also appended to the previous attempt's index instead of
clearing it: "embedded 32256/26879" was 48 passes over the first 672 chunks.
1.4.5 clears the index on restart and halves a rejected chunk until the
embedder accepts it. The ternary E1/E5 numbers wait for that image.

The measured indexing rate stands at ~3 chunks/s across all the attempts,
with the embedder sharing 8 cores with a chat server; the earlier 7.7/s
figure was a short window on the 1.4.0 engine and is not to be quoted.

**2026-09-12 09:24, E1 on the idle rig (1.4.5, index built, node
104.157.37.8), two runs:**

| | run 1 | run 2 | granite median node | granite best node |
|---|---|---|---|---|
| generation tok/s | 23.0 | 23.5 | 11.2 | 14.8 |
| prefill tok/s | 204 | 220 | 107 | 137 |
| 3k-token TTFT | 20 s | 18 s | 37 s | 29 s |

Different node from the granite runs (see the variance table), so: **H1
(prefill ≥2x) holds against the median node (1.9-2.1x) and not against the
best (1.5-1.6x); H2 (generation ≥1.5x) holds against both (1.6-2.1x).** The
ternary model is the fastest thing measured on this network by a clear
margin - and it answers wrong. Speed without H3 is not a product.

**E5 retrieval (ternary embedder), partial:** 5 hits of the 6 questions it
answered before the rig went down (instances question missed - generic
deploy pages instead of the limits page); granite scored 8/10 on the same
list. The remaining four questions need the rebuilt index.

**Second crash post-mortem.** During E5 the chat llama-server exited
("process 8 exited"), the entrypoint took the container down with it, the
docs bot's in-flight `fetch` rejected, and because the handler did `return
answerStream()` instead of `return await`, the rejection escaped the
try/catch and killed the docs bot too - index gone again. 1.4.6: `return
await` plus an in-band error line; each llama-server under its own restart
loop so a process crash no longer costs the index; the shim aborts upstream
generation when the caller disconnects; the retrieval tool drains streams
instead of cancelling them (the burst of cancels is the only correlate of
the chat server's exit - cause unproven).

**2026-09-12 11:00, E5 second attempt, identical outcome:** six questions
answered (5 hits, the instances question missed again), then on the seventh
the chat llama-server exited, the engine container with it, and the docs bot
started re-indexing. Streams were drained this time, so cancellation is
ruled out. Six 3k-token prompts, then death, twice: this smells like the
bitnet.cpp fork's llama-server (2026-07-15) and its prompt cache with `-np 1
-c 4096` - the seventh prompt finds no room and something asserts. 1.4.6
keeps the process under a supervisor and the docs bot alive, so the next
occurrence leaves a log to read instead of an empty container.

E5 stands at **5/6 on the questions the ternary embedder was able to answer**
against granite's 8/10 on all ten; the four unanswered ones are the
long-tail ones (deploy, FluxEdge, ArcaneOS, Zelcore), so the number is not
comparable yet.

**2026-09-12 12:40, third E5 run and the crash diagnosed.** Seven questions
answered this time (6 hits; the deploy question now a hit, the instances
question the standing miss), then the eighth failed - but the docs bot and
its index survived, as 1.4.6 intended, which left a log: a bare `Killed`
line, after which chat tasks continue and embedding tasks never reappear.
The cgroup OOM killer took the embedding server. Container memory afterwards:
0.74 GB of 12. Every engine death so far - 6 GB five minutes into indexing,
twice after a full index, now after 47k embedding tasks - fits **memory
growth in the fork's embedding server over many requests**. The shell
supervisor did not restart it; 1.4.7 makes the shim the supervisor (spawn,
respawn on exit, kill-and-respawn after 60 s of failed /health).

E5 stands at 6/7 answered, 3 questions outstanding, vs granite 8/10.

**2026-09-12 18:55, two corrections before round two.** (1) The BitNet
embedding model uses *last-token* pooling (model card); the rig ran
`--pooling mean` from 1.4.0 to 1.4.7. Index and query were pooled the same
way, so retrieval functioned, but the E5 numbers above are for a model used
off-spec; 1.4.8 fixes it and the ternary vectors are precomputed on it. (2)
Indexing is now a one-off: `tools/embed-corpus.js` writes a per-embedder
`.vec` the docs bot loads at boot, so a rig restart costs a minute, not two
hours.

**Round two is built, not yet deployed:** `images/ternary-tq2` converts the
bf16 master weights to TQ2_0 with the stock llama.cpp converter and serves
them with stock llama-server, alongside ollama's exact granite-embedding
blob reported under its production name (so the precomputed granite vectors
apply). Deployed as a separate app with `--engine tq2`, it isolates the
chat-kernel question - same weights, independent kernel - and removes the
fork's embedding server from the picture altogether.

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
