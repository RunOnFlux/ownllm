# ownllm — a self-hosted CPU LLM endpoint on Flux

Ollama + Open WebUI as a Flux v8 app, usable from a browser and from opencode.
Everything here was checked against mainnet at block ~2925516 (2026-09-06):
the specs in `specs/` return `status: success` from a live node's
`/apps/verifyappregistrationspecifications`.

## Publishing: what has to exist before you can deploy

Exactly **one image** needs building — the gate. Everything else in the
`--api-only` spec is a public image already on Docker Hub (`ollama/ollama`,
`alpine`).

```sh
docker buildx build --platform linux/amd64,linux/arm64 \
  -t "ghcr.io/<your-org>/ownllm-gate:$(cat images/gate/VERSION)" --push images/gate
```

`images/gate/VERSION` is the single source of truth: CI tags the image from it
and `tools/gen.js` reads the same file when it writes a repotag, so a spec can
never name a version that was never published. **Bump it to publish; never move
an existing version tag** - a moved tag means running instances and newly placed
ones silently differ, and nothing in Flux would show you that. CI also pushes a
`sha-<commit>` tag, so there is always an immutable reference even if a version
tag does get reused.

**`--platform linux/amd64` is not optional.** Enterprise apps are rejected
unless every component supports amd64 (`appConstants.js`,
`enterpriseRequiredArchitectures`), and a plain `docker build` on an Apple
Silicon Mac produces an arm64-only manifest — the registration fails validation
with no obvious clue why. `.github/workflows/gate.yml` builds both
architectures on push, which is the safer route.

### Deploying through Flux Home instead of the CLI

The UI does its own encrypting, so it wants the compose in **cleartext** and the
enterprise toggle switched on at submit time. Import the `.ui.json`, not the
envelope:

| file | for |
|---|---|
| `specs/<name>-<profile>-api.ui.json` | **importing into Flux Home** - full compose, `enterprise: false` |
| `specs/<name>-<profile>-api.register.json` | `tools/register.js` only - `compose: []`, which the UI rejects |
| `specs/<name>-<profile>-api.plaintext.json` | input to `tools/encrypt-enterprise.js` |

Leave `enterprise: false` in the imported file - the UI decides for itself
(`SimpleDeploy.vue`): it enables Enterprise mode when the spec has a private
image, a non-empty enterprise field, or an environment variable whose *name*
looks like a secret. `src/utils/detectSecrets.js` matches `/api[._-]?key/i`, so
`API_KEY=` triggers it. Setting `enterprise: true` yourself breaks things -
`specificationFormatter` stringifies the boolean to `"true"`, which is truthy,
and the node then tries to decrypt `"true"` as a blob.

Confirm the Enterprise badge is on before you pay. The `.ui.json` carries
`API_KEY` in cleartext because the UI has to see it in order to encrypt it; a
non-enterprise submission writes that key to the chain where anyone can read it.
Regenerate for a fresh key if that happens.

Going through the UI means `encrypt-enterprise.js` and `register.js` are not in
your path, and you pay the marketplace quote rather than the consensus price.

### One thing to do by hand after the first build

A package pushed to GHCR by Actions starts **private**, even in a public repo.
A private image cannot be pulled by Flux nodes unless you put registry
credentials in `repoauth`. After the first successful build, open
`github.com/orgs/RunOnFlux/packages/container/ownllm-gate/settings` and set the
visibility to public — otherwise every instance fails to install with an image
pull error and nothing in the spec explains why.

Point the generator at wherever you publish it:

```sh
node tools/gen.js --profile wide --api-only --instances 10 --registry ghcr.io/<your-org>
```

A **public** gate image needs no `repoauth`, so the enterprise blob carries only
the API key. Publish it privately and you add registry credentials to the blob —
which works, but buys nothing: the image holds no secret.

`images/engine` is optional. Build it only if you want to drop the `boot`
component; the stock `ollama/ollama` plus `boot` does the same job.

## Open sourcing this

All of it can be public. Nothing in the repository is secret by design:

- the gate holds **no** key — `API_KEY` arrives at runtime from the encrypted env
- specs on chain are public anyway; that is the entire reason the enterprise
  blob exists
- registration is authenticated by a signature from a WIF that is only ever read
  from `FLUX_WIF` in the environment, never written to a file

Two things must stay out of git, and `.gitignore` already covers them:

| file | why |
|---|---|
| `specs/*.plaintext.json` | holds the real `API_KEY` in cleartext — it is the *input* to the encrypter |
| `node_modules/` | ordinary hygiene |

`gen.js` now generates a random 32-byte key rather than leaving a placeholder to
be filled in with something weak, prints it once, and writes it only to the
gitignored plaintext file. Override with `--api-key` or `OWNLLM_API_KEY` when you
want to keep an existing key across regenerations.

The *encrypted* envelope (`specs/*-api.json` after `encrypt-enterprise.js`) is
safe to commit — the blob is ciphertext only ArcaneOS nodes can open.

Licensed MIT.

## Which JSON to deploy

`specs/ownllm-standard.json` — that is the one. gpt-oss:20b for real work plus
qwen3:4b as a fast helper, 9.1 cpu / 27600 MB / 66 GB, and it fits comfortably
on a nimbus or stratus node.

Take `small` only if you just want to prove the pipeline works, and `big` only
once you have confirmed the standard box performs acceptably — `big` adds
qwen3-coder:30b and pushes RAM to 41600 MB, which shrinks the pool of nodes that
can host it.

All three are already generated with owner `196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH`
and validated against mainnet. Regenerate with a different app name via
`node tools/gen.js --name myllm` — never hand-edit `name`, it is embedded in the
internal DNS names (`flux<component>_<appname>`).

## Two ways to deploy, and they cost very differently

**Path A — import into Flux Home.** Paste `specs/ownllm-standard.json` at
https://home.runonflux.io → Apps → Register, and it handles signing, broadcast
and payment. Cost: the USD-table quote, **~$9.60 / ~176 FLUX per month**.

**Path B — register directly, pay the consensus price.**

```sh
npm install
FLUX_WIF=<WIF of the owner ZelID> node tools/register.js specs/ownllm-standard.json
```

This validates the spec, signs it, broadcasts the (free) specification message
and prints the message hash plus the amount consensus actually requires:
**1.92 FLUX per month**. Nothing is spent yet — you then send the payment
transaction yourself, with the hash in an `OP_RETURN`. See `tools/pay.md`.

The gap is real: `messageVerifier.js:736` checks the payment against the chain
price table only, while Flux Home quotes the 5x USD table converted at the FLUX
market rate. Path B needs a wallet that can attach an `OP_RETURN`, which in
practice means a Flux daemon.

Test either path first with `--expire 1`: the enforced minimum is **1 block
(~30 s)** and the price floors at **0.01 FLUX**.

## Enterprise, API keys, instances and sync

These four questions have one answer, because they are the same question.

**Do you need `enterprise: true`?** Only if the spec itself carries a secret.
The default (no-build) topology has none — Open WebUI generates its API keys at
runtime into its own database, so nothing sensitive is on chain and enterprise
buys you nothing but the +0.8 scope surcharge.

The moment you want a *shared, pre-known* API key — which is what you need for
opencode against more than one instance — that key has to travel in the spec's
environment parameters, and then it must be encrypted. So: gate ⇒ shared key ⇒
enterprise.

```sh
node tools/gen.js --enterprise --instances 5
```

That emits the envelope plus `*.plaintext.json`, the `{contacts, compose}` to
encrypt into the `enterprise` field.

Enterprise costs almost nothing in reach: of 40 randomly sampled STRATUS nodes,
**37 run ArcaneOS**, 1 did not, 2 did not answer. It does require amd64 on every
component, and registration must go through an Arcane node — validation
decrypts before it validates (`appValidator.js:1420`).

**Giving Ollama an API key.** Ollama has no authentication of any kind and never
has. Two ways to add one:

- *Open WebUI's own keys* (default topology, zero build): create an account,
  Settings → Account → API keys. Fine for one instance.
- *The gate* (`images/gate`, enterprise topology): a Caddy bearer-token proxy
  holding `API_KEY` from the encrypted env. Stateless, so every instance accepts
  the same key — this is the only version that works across many instances.

**Instances.** `instances` may go up to 100 and capacity is not the limit. I
sampled the free resources of 38 STRATUS nodes: **26 have room for `standard`
right now**, 11 for `big`. Extrapolated over 1636 stratus nodes that is roughly
1100 eligible hosts.

Watch the tier boundary though: NIMBUS offers apps only **7.0 cores / 28000 MB**,
so `standard` (9.1 cores) is stratus-only. The `nimbus` profile is sized to fit
both and triples the pool.

**Syncing data between instances.** Three different answers for three kinds of
data:

| data | sync? | why |
|---|---|---|
| model blobs (`/models`) | **never** | 13–18 GB per model; syncthing would thrash. Each node re-pulls, which takes minutes and costs nothing. |
| gate | nothing to sync | the shared key comes from the spec, so all instances are identical |
| Open WebUI (`/app/backend/data`) | `g:` when instances > 1 | accounts, keys and chat history must be one dataset |

`g:` is masterSlave, not load balancing: exactly one instance runs the component
and the rest keep synced copies stopped as hot standbys
(`advancedWorkflows.js:2513`). So in the enterprise topology the **API scales
horizontally across all instances** while the **UI is single-active with
failover**. `gen.js` applies `g:` to the UI automatically once `instances > 1`.

Without the gate, `instances > 1` gives you failover only — every request has to
reach the one active UI.

## Scaling out: many instances, preset key, survives migration

```sh
node tools/gen.js --api-only --instances 100
```

`--api-only` drops Open WebUI. That single choice is what makes the rest work:
with no UI there is **no state anywhere in the app**, so every instance is
byte-identical and a node migration is a non-event rather than a resync.

**The API key.** It lives in the `gate` component's `API_KEY` environment
parameter, inside the encrypted enterprise blob — preset, identical on every
instance, and never visible on chain. Nobody can "claim" the deployment the way
they could grab the first Open WebUI signup on a freshly migrated node, because
there is no signup and no admin account to take. Rotating it is a spec update.

**Routing.** Flux already does this. `<appname>.app.runonflux.io` is a CNAME to
`fdm-lb-1-1.runonflux.io` (verified: `api-manager.app.runonflux.io` and
`ailotapp.app.runonflux.io` both resolve there), and FDM health-checks the
published port across every instance. You get one stable URL; put that in
`opencode.json` and never think about node addresses.

**Migration.** When an instance moves, the new node starts with an empty volume
and has to pull 13 GB. The gate polls `/api/tags` and serves **503 until every
model in `MODELS` is actually present**, so an instance that cannot answer is
reported unhealthy rather than handed traffic. Ollama returns 200 on
`/api/tags` from the moment it boots, which is why "is the engine up" is the
wrong readiness signal.

FDM is HAProxy, and an app with no entry in `flux-domain-manager`'s
`src/services/application/custom.js` is checked with
`option httpchk` + `http-check send meth GET uri /` - no `expect status`, so
HAProxy's default of "2xx or 3xx is healthy" applies. The gate therefore answers
readiness on **`/`** (as well as `/health`, which FDM's custom entries use, and
`/healthz`) and leaves those three unauthenticated. Requiring the bearer token
on `/` would return 401 to the health check and mark the backend down
permanently, model or no model.

**The ceiling is 100, not hundreds.** `maximumInstances` is 100
(`appValidator.js:826`). For more, register several apps (`ownllm1`, `ownllm2`,
…) and round-robin their FDM domains from your own client or a small front
proxy. Capacity is not the constraint — 26 of 38 sampled stratus nodes have room
for this profile today, roughly 1100 network-wide.

## A 10-instance pilot

```sh
node tools/gen.js --profile wide --api-only --instances 10
FLUX_WIF=<WIF> node tools/encrypt-enterprise.js specs/ownllm-wide-api.register.json
FLUX_WIF=<WIF> node tools/register.js         specs/ownllm-wide-api.register.json
```

`--api-only` implies enterprise, because the whole point is the preset
`API_KEY`, and an unencrypted spec would publish it on chain for everyone.

`encrypt-enterprise.js` builds the blob and **proves it before writing it**: it
fetches the app public key, encrypts with each candidate RSA padding in turn,
and asks an ArcaneOS node to decrypt each attempt via
`/apps/verifyappregistrationspecifications`. Only a blob the node actually
decrypted gets saved. If none works it errors instead of handing you a spec
nobody can run. `register.js` refuses to submit a placeholder blob, and refuses
to talk to a non-Arcane node.

Cost for ten instances, one month:

| profile | per instance | model | UI quote | consensus (as broadcast) |
|---|---|---|---|---|
| `small` x10 | 4.6 cpu / 8600 MB / 23 GB | qwen3:4b | $52.20 · ~955 FLUX | 2.71 FLUX |
| `wide` x10 | 4.6 cpu / 16600 MB / 28 GB | gpt-oss:20b | $65.90 · ~1205 FLUX | 2.71 FLUX |

Both fit NIMBUS as well as STRATUS, so ten placements out of ~3200 candidate
nodes is not a constraint.

### Two things that will bite

**`small` runs qwen3:4b, which is weak at agentic coding.** Ten replicas of it
is ten times the throughput of a model that will still lose the plot in
opencode. `wide` runs gpt-oss:20b on 4 cores for $13.70/month more — generation
barely suffers (it is memory-bandwidth bound, not core bound), only prefill
does. Start there.

**Round-robin destroys KV cache reuse.** FDM spreads requests across instances,
and the prefix cache is per-instance, so consecutive turns of one conversation
can land on different nodes and re-prefill the whole context from cold. On CPU
that is the expensive half. Ten instances give you ten times the *concurrent
users*, not a faster single session. If you and one friend are the only users,
consider pointing each of you at a fixed instance and keeping the instance count
low — or measure whether FDM holds sessions sticky before assuming it does.

## The three components

| component | image | published | why |
|---|---|---|---|
| `engine` | `ollama/ollama` | no | model server, reachable in-app at `http://fluxengine_<app>:11434` |
| `boot` | `alpine:3.20` | no | pulls the models on first boot, then idles |
| `webui` | `open-webui` | **:33000** | browser UI + authenticated OpenAI-compatible API |

`boot` exists because Flux sets only the container's `Cmd`, never its
`Entrypoint` (`dockerService.js` `createAppContainer`). `ollama/ollama`'s
entrypoint is `/bin/ollama`, so there is no shell in which to pull a model
before serving. `alpine` has no entrypoint, so its `commands` are the whole
command line — it waits for the engine, POSTs `/api/pull` per model, and parks.
`ollama pull` is idempotent, so a restart costs one registry HEAD per model.

Build `images/engine` instead and the `boot` component disappears — the image
pulls its own models from `$MODELS` and writes a `/models/.ready` marker.

## Models

Generation on CPU is memory-bandwidth bound: bytes read per token ≈ active
params × bits ÷ 8. That makes MoE models the only sensible choice — a 30B-A3B
generates at roughly the speed of a dense 4B while being far more capable.

| model | disk | RAM loaded | active params | notes |
|---|---|---|---|---|
| `qwen3:4b` | 2.6 GB | ~4 GB | 4B dense | fast helper, keep resident |
| `gpt-oss:20b` | 13 GB | ~14 GB | 3.6B | native tool-calling, best default for opencode |
| `qwen3-coder:30b` | 18 GB | ~19 GB | 3.3B | strongest at code |
| `qwen3:8b` | 5.2 GB | ~6 GB | 8B dense | slower than the 30B MoE — not worth it |

Rough throughput: **10–25 tok/s** generation on dual-channel DDR4, 3–4× that on
an 8-channel EPYC node. Prefill is the painful part — 60–150 tok/s, so a
10k-token context is 70–170 s to first token. Fine for chat and single-file
edits; not a repo-wide agent loop.

`ram` is a hard cgroup limit with only 2 GB swap (`dockerService.js:963`) —
exceed it and the container is OOM-killed, not slowed. `OLLAMA_MAX_LOADED_MODELS`
must be sized so the resident set fits.

Changing the model list: edit `MODELS` on the `boot` component (space-separated)
and push a spec update. Adding a model that pushes past `hdd` fails the pull
silently, so raise `hdd` in the same update.

### Changing the models

Nothing is baked into an image. The model list is the `MODELS` environment
parameter, and it appears in exactly two places in a spec — both generated from
one source:

- the **puller** (`boot`, or `images/engine`'s entrypoint) runs `ollama pull` for each
- the **gate** answers 503 until every one of them is present

```sh
node tools/gen.js --profile wide --api-only --models "qwen3-coder:30b qwen3:4b"
```

`gen.js` refuses to emit a spec where those two lists disagree — if they drift,
the gate health-checks the app out of FDM's rotation permanently. It also warns
when a list will not fit:

```
WARNING: 1 resident model(s) need ~20 GB but engine.ram is 16 GB.
         ram is a hard limit with 2 GB swap - the container will be OOM-killed, not slowed.
```

On an already-deployed app, changing models is a spec update: same component
structure means a *soft* redeploy, so the volume and the models already pulled
survive and only the new one downloads. For an enterprise app you must
re-run `encrypt-enterprise.js` first, since `MODELS` lives inside the blob.

`opencode.json` has its own model list — that one is client-side and has to be
kept in step by hand.

### Disk

`hdd` becomes a real ext4 volume of exactly that size (`fallocate` + `mke2fs`,
`advancedWorkflows.js:533`) mounted over `containerData`. Two separate caps sit
next to it: the container **rootfs is capped at 10 GB**, and the **image at 5 GB**
(`maxImageSize`) — which is why models are pulled at runtime rather than baked in.

Mount-hiding trap: the volume is mounted *over* the path, so anything baked into
the image at `/models` would be hidden. Hence `OLLAMA_MODELS=/models` with the
volume owning that path explicitly.

Downloads happen on first install (3–10 min for 13 GB), and again whenever the
app lands on a new node — which happens on its own when nodes drop. Restarts on
the same node reuse the volume. A spec update is a *soft* redeploy and keeps the
volume; changing the component structure escalates to a *hard* redeploy
(`advancedWorkflows.js:1296`) and wipes it.

## Using it from opencode

1. Open `http://<node-ip>:33000`, create the admin account (first signup wins).
2. Settings → Account → API keys → generate one.
3. Set `ENABLE_SIGNUP=false` and push a spec update.
4. `export FLUX_LLM_KEY=...`, then copy `opencode.json` to
   `~/.config/opencode/opencode.json` and set `baseURL` to your app's FDM domain.

Open WebUI's `/api` is OpenAI-compatible and carries its own key checking, which
is why the no-build variant does not publish Ollama directly — Ollama has **no
authentication at all**, and a published port on a node's public IP is open to
anyone who portscans the network.

If opencode's tool-calling misbehaves through Open WebUI, build `images/gate`
(a ~20-line Caddy bearer-token proxy) and point it at the engine's native `/v1`.

## Enterprise variant (encrypted env vars)

`gen.js` emits `specs/<name>.plaintext.json` — the `{contacts, compose}` object
that goes *inside* the encrypted `enterprise` field — private registry
credentials, the gate's API key, everything. On chain it is
`base64( RSA(256B)(AES-256 key) || nonce || ciphertext || tag )` and only
ArcaneOS nodes can decrypt it (`enterpriseHelper.js:105`).

`tools/encrypt-enterprise.js` builds the blob and verifies it against a live
ArcaneOS node before writing anything, so the RSA padding (which lives in
fluxbench, not in this repo) never has to be assumed. Enterprise registration
must go through an Arcane node regardless: validation decrypts before it
validates (`appValidator.js:1420`), and both tools check for that up front.

Enterprise also: costs +0.8 FLUX/mo (`scope`), requires **amd64** on every
component, and is the only way to use `nodes[]` targeting or private images.

## Enforced limits worth knowing

Verified live via `/apps/deploymentinformation`:

- per-app totals: **15 cpu**, **59000 MB RAM**, **820 GB** (stratus minus locked)
- `cpu` multiple of 0.1 (min 0.1), `ram` multiple of **100** (min 100), `hdd` whole GB (min 1)
- max 10 components; component names alphanumeric only, no `flux`/`zel` prefix
- app name must not start with `flux` — `fluxllm` is rejected, hence `ownllm`
- `ports`/`containerPorts`/`domains` arrays must be the same length, max 5 ports
- max 20 env vars and 20 commands per component, each string ≤400 chars
- `containerData` 2–200 chars
- expire: 1 to 1,056,000 blocks; 88000 blocks = 1 month (30.1 s/block measured)
- `instances`: min 1 for v8 (past block 2176519), max 100
- surcharged ports: `0-1023`, 8080, 8081, 8443, 6667 — 33000 avoids them
- payment address: `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX`

## Gotcha: POSTing to FluxOS

`Content-Type: application/json` hangs until the gateway 504s — FluxOS reads the
raw body itself. Use `text/plain`. `tools/verify.sh` already does.
