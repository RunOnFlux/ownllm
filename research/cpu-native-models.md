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
(Superseded by the 10/10 run on corrected pooling, §6c.)

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

**Round-two build findings (2026-09-12 19:10).** Upstream llama.cpp is not
quite "stock" for this model: its converter's bitnet tensor map lacks the
2B-4T names (`attn_sub_norm`, `ffn_sub_norm`), and its bitnet graph hardcodes
SiLU where 2B-4T uses squared ReLU (`hidden_act: relu2`). Both are one-line
patches applied in the image build; without the second, TQ2_0 would have
produced nonsense and looked like a kernel failure. Worth an upstream PR if
round two shows the model works - the `bitnet` arch in llama.cpp was built
for the 2024 reproductions and nobody has pointed it at Microsoft's own
release.

**2026-09-12 23:05, ternary vectors precomputed** on the 1.4.8 engine
(last-token pooling): 26,879 x 640 dims, 69 MB, shipped in docsbot 1.4.9 as
`corpus.jsonl.bitnet-embedding-270m.vec`. Two more tool bugs on the way:
the precompute tool assumed granite's 768 dimensions (the ternary embedder
has 640; the extra 128 floats per row were NaN - repacked, no re-embedding),
and it had no fallback for chunks past the 512-token limit (added, same
halving as the docs bot). From here the rig boots in about a minute.

## 6b. Round two: the kernel was the story

**2026-09-12 23:18, `ownllmtq2` (BitNet-b1.58-2B-4T as TQ2_0 on upstream
llama.cpp with the relu2 fix, granite embedder, node 213.166.195.190), five
minutes after registration:**

| probe | I2_S (bitnet.cpp fork, our build) | TQ2_0 (upstream llama.cpp) |
|---|---|---|
| "capital of France?" | "Paris. The capital of France is Paris. The capital..." | **"Paris"** |
| one paragraph: "NIMBUS ... 7 cores, 28000 MB RAM" → RAM? | **"70000 MB RAM and 400 GB."** | **"An application on a NIMBUS node may use up to 28000 MB RAM."** |
| "Explain Docker in two sentences" | "a container that allows you to create a container for your data that allows..." | "a platform that allows users to package and distribute software applications along with their dependencies, ensuring consistency..." |
| generation / prefill tok/s | 23 / 210 | **43 / 267** |
| 3k-token TTFT | 18-20 s | **15 s** |
| E3 grounded | 2/9 (fabricates) | 3/9 (**over-refuses**: "Not covered in the documentation." on three covered questions, one over-answer; avg answer 38 chars) |

Same weights, same prompts, same shim. The I2_S build - bitnet.cpp's kernel
compiled with `GGML_NATIVE=OFF`/`GGML_OPENMP=OFF` on a CI runner - was
producing degraded output all along, and every quality conclusion drawn from
it in §6a is withdrawn. TQ2_0 reads the number, stops, and is faster.
(Different node again; the speed ratio is indicative, not paired.)

What remains true: the model is small. Its 3/9 is a different failure than
the fork's 2/9 - it refuses when the strict eval prompt tells it never to
guess, rather than inventing. Same five questions with a softer instruction
("quote the relevant figure; say not-covered only if the documentation really
says nothing"): NIMBUS RAM -> "up to 28000 MB", image size -> "5 GB ...
document [A]", STRATUS cost -> correctly not covered; the multi-hop expire
question still refused, the GPU trick question still over-answered ("7.0
cores"). `eval-quality.js` now takes `EVAL_PROMPT=soft`; paired scores (same
evening, granite on its median node, weighted /9):

| | strict prompt | soft prompt | avg answer |
|---|---|---|---|
| granite4:tiny-h | 7/9 | 7/9 | 85-123 chars |
| BitNet-2B-4T TQ2_0 | 3/9 | 4/9 | 38-48 chars |

granite is robust to the prompt; the 2B ternary is not, and even with the
soft prompt it loses the multi-hop question (as granite does), over-answers
the GPU trick question, and refused the NIMBUS RAM question in the scored run
that it had answered in the probe (temperature 0.1 is not deterministic).
Speed repeated: 43.4 / 266. **H3 is not met: 4/9 against 7/9.** But it is
now a capacity gap of the ordinary kind - a 2.4B dense model against a
7B-total MoE - not a broken one, and it comes with 2x the speed and a
runtime that has not crashed.

Two things to file upstream: (1) microsoft/BitNet - the x86 I2_S path
compiled non-natively produces wrong-but-plausible output (or: document that
it must be built with native flags); (2) ggml-org/llama.cpp - the `bitnet`
arch needs three one-line changes to load Microsoft's own release (tensor
names, relu2, BPE vocab).

**2026-09-14, thread sweep on production nodes (granite4:tiny-h, 12-core
instances, `FILLER_WORDS=400`):**

| threads | fast node (82.65.58.211) gen / prefill | median node (65.109.104.88) gen / prefill |
|---|---|---|
| 4 | 29.0 / 77 | 27.7 / 77 |
| 6 | 31.1 / 99 | 27.8 / 106 |
| **8** | 31.0 / **113** | 27.2 / 134 |
| 10 | 29.5 / 98 | 25.2 / **148** |
| 12 | 28.6 / 106 | 22.6 / 147 |

Generation is flat from 6 threads up and falls past 8 on both nodes -
bandwidth-bound, as predicted. Prefill peaks at 8 on the fast node and at
10 on the median one (+10% over 8, for -7% generation). Not worth a fleet
change: 8 stays. Also visible: the docs bot's 40-token warm-up measurement
(16 tok/s on the median node) under-reads the sustained rate (27); fine for
ranking nodes, not a benchmark.

## 6d. Model sweep on one node (2026-09-14/15)

Twelve models through the same harness on one 12-core STRATUS node
(`ownllmeval`, 159.194.230.145; granite4:tiny-h measured 13.3 tok/s there,
so it is a mid-speed node - production's best does 31). Speed is
generation / prefill tok/s; grounding is the 9-question eval, strict / soft
prompt; "answer" is average length.

| model | params (active) | gen | prefill | strict | soft | answer | note |
|---|---|---|---|---|---|---|---|
| granite4:tiny-h (production) | 7B (1B) MoE | 13.3 | 60 | 7/9 | 7/9 | 85-126 ch | baseline |
| **granite4:micro-h** | 3B hybrid | 7.9 | 35 | 7/9 | **9/9** | 165 ch | best quality at usable speed |
| granite4:small-h | 32B (9B) MoE | 3.3 | 10.7 | 7/9 | **9/9** | 155 ch | quality tier, slow |
| granite4.2:3b | 3B | 9.6 | 21.5 | 8/9 | **9/9** | 850 ch | reasons out loud, 4x longer answers |
| granite4.2:8b | 8B | 3.9 | 12 | 7/9 | 7/9 | 750 ch | |
| granite4.1:8b | 8B | 5.2 | 13 | - | 7/9 | 237 ch | |
| granite4.2:30b | 30B (MoE) | not measured* | | 5/9 | 5/9 | 740 ch | worse than tiny-h here |
| gpt-oss:20b | 21B (3.6B) MoE, MXFP4 | 4.6 | 16.6 | 7/9 | 6/9 | 19-60 ch | |
| lfm2.5:8b | 8B (1B) MoE | **17.0** | 59 | 3/9 | 4/9 | 11-14 ch | fastest; over-refuses |
| qwen3:8b | 8B | 5.3 | 15.5 | 6/9 | 5/9 | 29-72 ch | thinking model |
| qwen3.5:2b | 2B | 9.5 | 62 | 0/9 | 0/9 | 0 ch | thinks, never answers in budget |
| gemma4:12b | 12B | 2.4 | 9.7 | 0/9 | 0/9 | 0 ch | same |
| gemma4:26b | 26B (4B) MoE | 1.5 | 15.3 | 1/9 | 0/9 | 1 ch | same, and slow |

\* The speed bench for the 30b dropped the connection twice while the 19 GB
model loaded (the rig was sharing its node with the micro-h A/B bot, and
the two engines together exceed the node's RAM). Its grounding score
already rules it out, so the cell was not chased further.

What it says:

- **The newest generations (qwen3.5, gemma4) are reasoning models by
  default** and produce nothing inside a 200-token budget; they would need
  thinking disabled and a much larger budget, and gemma4 is slow regardless.
  "Newest" bought nothing here.
- **granite4:micro-h is the finding.** 9/9 on the soft prompt - the first
  perfect score, including the multi-hop question tiny-h always fails - with
  answers that cite sections, at 60% of tiny-h's speed. On production's fast
  node that is ~18 tok/s and ~130 prefill: interactive. Candidate to replace
  tiny-h as the docs answerer, pending a run on the real corpus prompt.
  **That run did not confirm it** (see the A/B below).
- granite4:small-h matches that quality but at a quarter of the speed: a
  "slow, thorough" tier if one is wanted.
- gpt-oss:20b is not better than granite on grounded QA (7/9 vs 7/9) and is
  three times slower. Its case is general reasoning, not documentation.
- lfm2.5:8b is the speed king (17 tok/s) and cannot be trusted to answer.
- Bigger is not better on this task: 4.2:30b scored 5/9.

**A/B on the real bot (`tools/ab-docsbot.js`).** A one-instance copy of the
production docs bot (`ownllmdocs2`, same image, prompt, corpus and vectors,
only `CHAT_MODEL=granite4:micro-h`) against production tiny-h, twelve real
questions, identical requests. micro-h did not win:

- Won one: the Cumulus/Nimbus/Stratus comparison, where tiny-h produced
  nonsense ("Cumulus nodes ... have 3,176,000 FLUX") and micro-h listed the
  collateral and hardware per tier.
- Lost two: "how much does an app cost per month" (micro-h returned an
  eight-step procedure with no number; tiny-h gave the $0.99 floor, the
  formula and the $11.20 example) and the Stratus cost ($40.00/month,
  invented, vs tiny-h's "$4.00 extra", which is what the source says).
- Tied on the rest, with micro-h wordier ("as stated in [1]") and
  formatting even one-line facts as numbered lists.
- Slower everywhere: first token 13-32 s vs 6-10 s, whole answer 18-90 s vs
  6-19 s (its node was also pulling the 30b model, so treat the ratio, not
  the absolute, as the result; the clean sweep says 60% of tiny-h).

The 9/9 came from the eval's short, clean contexts. On the real prompt
(3 chunks + facts tier + history rules) micro-h's extra capacity goes into
structure rather than into being more right. Decision: stay on tiny-h.
What the A/B did expose is corpus gaps shared by both models: "how do I
update a running application" retrieves the Enshrouded game page for both
(no how-to covered it; added), and the how-to sheet itself said "minimum 3
instances" where v8 apps allow 1 (fixed) - both are corpus fixes, not model
fixes.

Harness notes from this run: the puller reported failed pulls as "done"
(two of the eight tags did not exist); the gate refused an authenticated
pull while unready, which is exactly when a pull is needed (fixed in gate
1.4.24); an 80 GB volume holds about eight models - measure-then-delete.

## 6c. Round-one and round-two verdict

- The ternary *substrate* works on Flux CPUs and is the fastest thing we
  have measured: 43 tok/s generation, 267 tok/s prefill, 15 s to first
  token on a 3k prompt (vs granite's 11 / 107 / 37 s on its median node).
- The 2.4B ternary *model* is behind granite4:tiny-h on grounded QA (4/9 vs
  7/9) and brittle to instruction wording. Not shippable as the answerer.
- The bitnet.cpp fork is not the way to run it: our I2_S build produced
  wrong output, and its embedding server leaks. Upstream llama.cpp with
  TQ2_0 is, once three one-line fixes land.
- **The ternary embedder wins retrieval (H4 holds).** bitnet-embedding-270m
  with last-token pooling: **10/10** on the E5 set, mean rank 1.40 - it
  finds the ArcaneOS guide (rank 3) that granite-embedding misses, and the
  instances limits page (rank 2). granite-embedding: 8/10 on the production
  bot, 9/10 on the tq2 app's identical vectors (the live BM25 mix adds a
  little variance). Ten consecutive answers on the supervised 1.4.8 engine
  with no process death.

## 7. After round two

Ordered by return per effort, given the above:

1. **Prompt shape for small models.** The 3/9 -> 4/9 swing came from one
   sentence. The docs bot's prompt was tuned on granite; tune a variant on
   the TQ2 rig and rescore. Cheap, and it bounds how much of the gap is
   instruction-following rather than knowledge.
2. **Fine-tune on our own traffic** (§3 of the original plan, now viable
   because inference is correct): SFT the bf16 master weights on logged
   (question, retrieved chunks, granite's accepted answer) triples, convert
   to TQ2_0, measure on the same harness. This is the distillation that
   turns a 2x-faster substrate into a 2x-faster *product*.
3. **Extract-first pipeline** (§ research notes): the reader-then-rephraser
   design removes the "read a number out of a paragraph" requirement
   entirely and suits a small ternary rephraser best of all.
4. **Falcon-E-3B on TQ2_0** as the size midpoint, after the licence read.
5. **Upstream the fixes** so nobody else runs this model broken.

## 7a. Original follow-up list (kept for the record)

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


## 8. First fine-tune: fluxai-tinyh-v1 (2026-09-16)

granite-4.0-h-tiny, LoRA (rank 16, 16 layers, 52.9M trainable) on the 4-bit MLX
base, one epoch over 9,739 rendered assistant turns from 4,515 conversations
(2,000 code-generated deploy dialogues, 600 marketplace-preset deploys, 2,153
docs Q&A taught in-session and verified), lr 5e-5, seq 3072, batch 1. Trained
on an M3 Max in 9 h 34 min (3.5 s/iter); mlx-lm main was needed for the MoE
router gradient. Fused into the bf16 original, converted with llama.cpp after
undoing mlx-lm's expert layout, quantized Q4_K_M (3.9 GB).

| Eval | fluxai-tinyh-v1 | granite4:tiny-h (base) | gpt-oss:20b |
|---|---|---|---|
| Deploy agent, trained surface (compact tools) | 3/4, 4-12 s/turn | - | - |
| Deploy agent, MCP-derived core tools | 0/4 | 2/4 (unsafe confirm) | 4/4, 40-100 s/turn |
| Grounding strict | 9/9 | 7/9 | 7/9 |
| Grounding soft | 7/9 | 7/9 | 6/9 |

What it learned: the protocol. It builds the spec with the right units, quotes
before deploying, asks, and deploys with confirm=true only after a yes, in a
tenth of gpt-oss's time. Strict grounding went from 7/9 to 9/9.

What it did not: (1) it is brittle to the tool surface - with the MCP schemas
and a different system prompt it stops calling tools at all, so v2 data must
vary system prompts and tool descriptions; (2) the vague sizing case ("a
Minecraft server for 20 players, how much?") still yields nothing - more
examples of sizing from a workload description; (3) one quote was reported as
$1.15 where the tool returned $8.55 - copying numbers from tool results needs
reinforcement (or the UI renders the quote card from the tool result, which it
should anyway); (4) in plain generation without tools it can leak
`<tool_call>` tags into a docs answer - mix docs examples rendered without a
tools block, or strip tags at serving. Without retrieved context it answers
"What is Flux?" as the Facebook framework: knowledge lives in retrieval by
design, the fine-tune carries behaviour.

## 9. Second fine-tune: fluxai-tinyh-v2 (2026-09-17)

Goal set by the user: outperform gpt-oss:20b on the deploy-with-AI task at
tiny-h speed. Data v2: 6,753 conversations (4,000 deploy dialogues generated on
six system prompts and four tool-schema variants incl. the real MCP schemas,
sizing from workload descriptions, error flows, yes-first and stale-quote
confirmations, follow-ups; 600 marketplace presets; 2,153 docs Q&A), see
`finetune/surfaces.js` and `finetune/gen-deploy.js`. The eval grew to 12 cases
(`tools/deploy-agent-eval.js`).

Trained twice from the same data:

- **A100 80 GB on FluxEdge** (premium Hyperstack node, $1.63/h): bf16 LoRA,
  rank 32 / alpha 64 on attention, Mamba and shared-MLP projections, seq 6144,
  lr 5e-5, one epoch = 802 steps in 140 min, train loss 0.18, eval loss 0.116.
  The Mamba-2 CUDA kernels are required at this sequence length (the fallback
  path OOMs an 80 GB card at 6144); the working pairing on torch 2.5.1 is
  `causal-conv1d==1.5.0.post8 mamba-ssm==2.2.4` installed with `--no-deps` plus
  `einops`. The whole exercise, including five failed starts, cost about $6.75.
- **M3 Max, 4-bit base** (mlx-lm): same rank, seq 6144, warmup + cosine
  3e-5 -> 3e-6, gradient accumulation 4, 12k iterations (~23 h). Three earlier
  attempts failed: seq 3072 truncated the MCP pairs to nothing (NaN loss), the
  renderer put the assistant header in the completion (the model looped on
  `<tool_call>assistant<tool_call>` once fused), and constant lr 5e-5 at batch 1
  diverged at iteration 50.

| 12-case deploy eval | fluxai-tinyh-v2 (A100) | fluxai-tinyh-v1 | gpt-oss:20b | granite4:tiny-h |
|---|---|---|---|---|
| Compact tools (trained surface) | 12/12 | 8/12 | 9/12 | - |
| MCP core (5 real schemas, 3k tok) | 11/12* | 0/4 | 9/12 | 2/4 |
| MCP full (15 real schemas, 4.9k tok) | 12/12 | - | - | - |
| Grounding strict | 7/9 | 9/9 | 7/9 | 7/9 |

\* the core set has no logs tool, so the logs case cannot pass there; the model
should say so instead of replying empty (a v3 data item: "tool not available").

Per-case latency was 5-39 s including 3 tool round-trips, measured on the Mac
while another training run held the GPU; gpt-oss takes minutes per case on the
Flux pool. Grounding fell back to the base level: the v2 mix leans on deploy
behaviour and the docs batches were still at loss ~0.3 after one epoch, so v3
should raise the docs share or run a second epoch on docs only.

Files: `runs/tinyh-a100-v2/` (Q4_K_M GGUF 4.2 GB, adapter, loss history,
Modelfile), local ollama model `fluxai-tinyh-v2-a100`. Serving on Flux still
needs the GGUF hosted where the pools can pull it.

## 10. Third fine-tune: fluxai-tinyh-v3 (2026-09-18)

Production round. Data v3 adds, on top of v2: app updates (fetch the running
spec, modify, quote the update with the unused-term credit, apply on yes),
pasted Flux specifications (quote exactly as given, v7 accepted, a rejected RAM
value corrected, "is this valid?"), docker-compose pastes turned into
multi-component specs (host ports dropped, service hostnames rewritten to
`flux<component>_<app>`, `build:` refused with instructions), GitHub URLs
answered with "push an image first", honesty when the surface lacks the tool the
request needs, edits after a quote, prompt injection inside tool output ignored,
pasted private keys refused and never echoed, abuse declined, large spends
spelled out with the exact FLUX total, the rate card explained, ambiguous
targets disambiguated, transient tool failures retried once, four languages, and
noisy input (typos, casing, unit slang). The eval grew to 22 cases; `mix.js`
repeats docs rows twice in the train split and gives a third of them a tool
surface.

Trained on a **vast.ai A100 SXM4 80 GB** ($1.08/h): bf16 LoRA rank 32 / alpha
64, **seq 8192**, lr 5e-5, one epoch = 1,207 steps in 197 min, train loss 0.165,
eval loss 0.104 (v2: 0.182 / 0.116). Cost about $3.70. FluxEdge premium was
unusable: its nodes come up cordoned, so every deployment is reaped in ~5
minutes (see `tools/vast.js` and the README).

| 22-case deploy eval | fluxai-tinyh-v3 | fluxai-tinyh-v2 | gpt-oss:20b |
|---|---|---|---|
| Compact tools (trained surface) | 20/22 | 12/12 old set, 2/5 new | 9/12 old set |
| MCP full (15 real schemas) | 20/22 | 12/12 old set, 2/5 new | - |
| MCP core (5 schemas) | 20/22 | 11/12 old set | 9/12 old set |
| Grounding strict | 7/9 | 7/9 | 7/9 |

Latency 1-6 s per case including three tool round-trips, against minutes for
gpt-oss.

**The two remaining failures are a serving-layer bug, not the model.** Both
cases need the assistant to explain something *and* call a tool in the same
turn ("RAM has to be a multiple of 100 MB; rounding 1250 up to 1300" then
`flux_build_spec`; the compose note then the two-component build). Generated
raw, the model does exactly that, correctly. But ollama only parses a tool call
when the reply *starts* with `<tool_call>` (tools/template.go), so prose in
front of the call makes the whole reply content and the call disappears. Since
production serving is ollama on the Flux pools, the fix belongs in the data:
`fixToolProse()` in both generators now moves any such prose into the next
assistant message, after the tool result, which reads the same to the user and
keeps every call parseable. v3 was retrained on that corrected set.

Files: `runs/tinyh-vast-v3/` (Q4_K_M GGUF 4.0 GB, adapter, loss history,
Modelfile), ollama model `fluxai-tinyh-v3`.


## 11. Fourth fine-tune: fluxai-tinyh-v4 (2026-09-18)

v4 folded the v3 serving fix together with a capability round. Added to the
data: long multi-turn sessions on one app (deploy, status, crash, logs,
diagnose out-of-memory, resize, re-quote with the unused-term credit, apply,
renew or cancel), incremental slot filling across turns, honest capability
limits (no GPU on Flux Cloud and FluxEdge named instead, no shell or root, not
Kubernetes, static IP as a spec flag, no managed backups, amd64 only),
private-registry images as enterprise applications, domains and URLs, several
apps in one request, duplicate names as updates, and five more validation
errors (invalid characters, name too long, disk under 1 GB, missing tag, arm64
image). A new generator, `gen-docs-math.js`, produces 900 documentation rows
whose answers must be COMPUTED - blocks to months and days, price composition,
FLUX with the discount, resources across instances, unit conversion, limit
checks, headroom - with randomised figures so the procedure is learned rather
than the number, plus refusals where the context is silent. Eval grew to 26
cases. Dataset: 10,653 conversations, 12,041 train rows (docs doubled), 533 eval.

Trained on a vast.ai A100 SXM4 80 GB at $1.06/h: 1,506 steps in 317 min, train
loss 0.162, eval loss 0.084 (v3: 0.165 / 0.104). About $6.

| Eval | v4 | v3 | v2 |
|---|---|---|---|
| 26 cases, compact tools | 24/26 | 20/22 | - |
| 26 cases, MCP full (15 schemas) | 22/26 | 20/22 | - |
| 26 cases, MCP core (5 schemas) | 20/26 | 20/22 | - |
| Grounding strict | **9/9** | 7/9 | 7/9 |

Grounding reached 9/9, the first time since v1, and the computed-answer rows are
why: the only case v2 and v3 lost was dividing 1,056,000 blocks by 88,000 per
month. The prose-before-tool-call fix also held - the RAM-rounding case, which
v3 could not pass through ollama, now passes in four turns.

What is left, and the cause is coverage rather than capability:

- **Multi-component specs.** Only 3.4% of build_spec calls in the training data
  have more than one component, and on the compose case the model nests the
  second component inside the first instead of appending to the array. v5 needs
  multi-component specs at maybe 20% of calls, from compose, marketplace and
  plain "app plus database" requests.
- **Enterprise / private registry (1.7% of dialogues)** and **capability limits
  (1.5%)** are too thin to fire reliably: the private-registry case deploys as a
  normal app without mentioning credentials, and the GPU question is answered
  correctly on the compact surface but not on the larger ones.
- Behaviour is weakest on the 5-tool core surface (20/26), which is the surface
  furthest from production; the full 15-tool surface the Flux Cloud chat uses
  scores 22/26 and the compact one 24/26.

Files: `runs/tinyh-vast-v4/` (Q4_K_M GGUF 4.0 GB, adapter, loss history,
Modelfile), ollama model `fluxai-tinyh-v4`.


## 12. Fifth fine-tune: fluxai-tinyh-v5 (2026-09-19)

The multi-component round. v4 built two-component specs by nesting the second
component inside the first; the cause was coverage, 3.4% of spec calls. v5 adds
seven realistic stacks (app+db, app+db+cache, and so on) and, beyond them,
"many component" apps of three to ten parts - reverse proxy, application,
worker, database, cache, queue, search, object storage, metrics, dashboards -
each wired to the others by the real internal hostname `flux<component>_<app>`,
sized so the SUM fits the per-application maximums, with flows that add, remove
and resize one component of a large app and that refuse an eleventh
(appValidator.js caps an application at 10). Multi-component calls went from
3.4% to 38%.

Also added: the in-app UI surface (`finetune/tools-ui.js`) for the assistant
running inside fluxcloud-web - ui_navigate over the 26 real routes,
ui_open_app, ui_open_template and ui_prefill_deploy, with NO deploy tool,
because that app's rule is that the assistant can never sign; and tool-free
knowledge rows with a one-line system prompt or none at all, because v4
confabulated ("Flow network", "AWS") when the framing was thin.

The per-line paraphrase teacher was replaced by phrasing banks Claude wrote as
templates with `{what}`/`{name}`/`{cpu}` placeholders (`finetune/phrasings.json`).
Generation went from four hours over the network to one second, every figure
survives by construction, and 67.6% of first messages are distinct.

Dataset: 12,853 conversations, 14,175 train rows, 643 eval. Trained on a vast.ai
A100 SXM4 at $1.04/h: 1,772 steps in 260 min, train loss 0.155, eval loss 0.078
(v4: 0.162 / 0.084). About $4.50, plus $0.45 wasted on a host that failed with
"docker_build() error writing dockerfile".

| Eval (28 cases) | v5 | v4 (26 cases) |
|---|---|---|
| Compact tools | **27/28** | 24/26 |
| MCP full (15 schemas) | **24/28** | 22/26 |
| Grounding strict | 9/9 | 9/9 |
| Two-component spec (case 27) | **PASS** | FAIL (nested) |
| Three-component spec (case 28) | **PASS** | PASS |

Multi-component is fixed on both surfaces. What remains is the same pattern as
before, and it is measurable: the behaviours with the thinnest coverage fail
only on the 15-tool surface, where 4.9k tokens of schema dilute everything else.
Private-registry/enterprise (1.7% of dialogues) fails on both surfaces - it
quotes a private image as an ordinary app; the GPU-limits answer (1.5%) and the
German reply hold on compact and fall back to a normal quote or to English on
the full surface. v6 should raise those three to roughly the share
multi-component now has.
