# v7 target conversations

v6 fixed the "navigates instead of answering" family. What the live Flux Cloud
transcripts show next is narrower and worse: the model has been trained on six
rounds of *deploying applications*, so it now treats every sentence as a
deployment request, and when it has no grounding it invents one.

Four failures from the transcripts the user sent, verbatim in behaviour:

| Asked | v5/v6 did | Should have |
|---|---|---|
| how much flux does a stratus node need | quoted Redis at **$2.50 a month** | said **40,000 FLUX** collateral |
| deploy palworld on 30 instances with 5 cores | quoted it silently | flagged that 30 instances is 30 separate worlds, and that Palworld wants 16 GB |
| can you add contact tadeas@runonflux.io | "no tool for that here, put the email in the description" | put it in `contacts`, which is a real spec field |
| do you know something about ssp wallet | "sspwallet.online has its own page and a QR button" | the real answer, from the docs, at docs.sspwallet.io |

Five rules for v7, on top of the six from v6.

7. **Operating a node is not renting one.** Collateral, tiers, hardware and
   rewards are operator questions. They never end in a quote and never end in
   a prefilled form.
8. **`contacts` and `description` are fields.** Editing a draft means calling
   `ui_prefill_deploy` again with the field set. Editing a live app means
   signing an updated specification. Neither is a refusal.
9. **Never invent a domain, a page or a button.** If the docs come back empty,
   say the docs have nothing. "I do not know" is a correct answer; a confident
   wrong URL is the worst thing this model can emit.
10. **Size from the image, not from the sentence.** Palworld is 16 GB,
    Blockbook is 200 GB of disk, a Presearch node is 300 MB. If the user names
    a size the image cannot live in, quote the size that works and say why.
11. **Search the docs more often than feels necessary.** Anything factual about
    Flux goes through `flux_search_docs` first, including things the model
    believes it already knows.

---

## 1. The headline failure

> **user:** how much flux do i need to lock to run a stratus node

*calls `flux_search_docs("stratus node collateral")`*

> **assistant:** A Stratus node locks **40,000 FLUX** as collateral [1]. The
> collateral is not spent - it stays in your wallet, it just has to sit there
> while the node is running. The other two tiers are 1,000 FLUX for Cumulus and
> 12,500 for Nimbus.
>
> Worth being clear about which side of this you want: locking collateral is how
> you *operate* a node and earn rewards. If you only want to *run an app* on the
> network you pay per month for its resources and lock nothing.

> **user:** hmm thats a lot. i only wanted to run a small app really

*calls `flux_quote_app`*

> **assistant:** Then you want the other side of this entirely - no collateral,
> no hardware, you just pay for what the app uses. A small static site on 0.5
> cores, 500 MB and 5 GB across three instances is **$2.41** a month. Tell me
> what the site is and I will size it properly.

The quote is right in the second turn and wrong in the first. That is the
whole lesson.

## 2. The tier table

> **user:** cumulus vs nimbus vs stratus

| Tier | Collateral | CPU | RAM | Storage | Bandwidth |
|---|---|---|---|---|---|
| Cumulus | 1,000 FLUX | 2 cores / 4 threads | 8 GB | 220 GB | ≥ 25 Mbit/s |
| Nimbus | 12,500 FLUX | 4 cores / 8 threads | 16 GB | 440 GB | ≥ 50 Mbit/s |
| Stratus | 40,000 FLUX | 8 cores / 16 threads | 32 GB | 880 GB | ≥ 100 Mbit/s |

All three need a public IP and about 97% uptime. Do not confuse these with what
a node *offers an application*, which is 3 / 7 / 15 cores and 5000 / 28000 /
59000 MB - the operator's hardware and the tenant's allowance are different
numbers and the model has mixed them before.

## 3. Thirty instances

> **user:** deploy palworld on 30 instances with 5 cpu cores

*quotes both 30 instances and 1*

> **assistant:** I can do that, but check the number with me first. Instances are
> **copies**, not one bigger server: 30 instances of Palworld is 30 separate
> worlds on 30 different nodes, each with its own save and its own address -
> players cannot meet across them. For one shared world you want **1 instance**.
>
> 5 cores, 16 GB and 40 GB comes to:
>
> - 1 instance: **$22.30** a month
> - 30 instances: **$669.00** a month
>
> I have also kept the RAM at 16 GB rather than the default - below that Palworld
> gets killed part way through loading a world. Which do you want, and what
> should it be called?

Two things at once: the scale check and the sizing correction. Neither was in
v6, and the v6 deployment would have been thirty empty worlds that crash.

## 4. Contacts and description

> **user:** can you add contact tadeas@runonflux.io

*calls `ui_prefill_deploy` again, same spec, `contacts: ["tadeas@runonflux.io"]`*

> **assistant:** Added - tadeas@runonflux.io is on the contacts field now, so
> expiry warnings and notices about the app go there. Nothing else changed, it is
> still $22.30 a month.

> **user:** adjust description to have something nice about palworld

*calls `ui_prefill_deploy` again with the new description*

> **assistant:** Updated the description to "Palworld dedicated server - catch
> Pals, build a base, play with friends on a private world." It shows on the app
> page and in the marketplace listing. Price is unchanged.

`contacts` was missing from the `ui_prefill_deploy` schema, which is half of why
v6 refused. It is in the schema now. The other half was training: nothing in six
rounds ever edited a draft field, so the model had no example to follow.

On a live app the same request is an update: read the app, explain that contacts
live on the specification so it means signing a new one, note that the change
itself costs nothing because the unused term is credited, then prepare it.

## 5. SSP Wallet, without inventing anything

> **user:** do you know something about ssp wallet?

*calls `flux_search_docs("ssp wallet")`*

> **assistant:** SSP Wallet is Flux's two-factor self-custody wallet [1]. The
> browser extension holds one private key, the SSP Key app on your phone holds
> the second, and every transaction is a 2-of-2 multisignature that both have to
> sign - so a compromised laptop alone cannot move your funds. The documentation
> is at docs.sspwallet.io. You can also use it to sign Flux app deployments here
> instead of Zelcore.

v6 said "sspwallet.online has its own page and a QR button". The domain does not
exist and neither does the button.

## 6. When the docs have nothing

> **user:** is there a flux status page?

*calls `flux_search_docs`, gets no results*

> **assistant:** Nothing in the docs about a status page, so I would rather not
> point you at a URL I am guessing at. The **Network** page in here shows live
> node counts and block height, and the team posts incidents on their Discord
> and X accounts. Want the Network page?

## 7. The catalogue, at real sizes

| App | Image | Size that works | Why |
|---|---|---|---|
| Palworld | `runonflux/palworld-server-flux` | 4 cores, 16 GB, 40 GB | below 16 GB it is killed loading a world |
| Minecraft | `itzg/minecraft-server` | 3 cores, 8 GB, 30 GB | 20 players with mods settles at 8 GB |
| Blockbook explorer | `runonflux/blockbook-docker` | 2 cores, 8 GB, 200 GB | it indexes the chain; the disk only grows |
| Ethereum (geth) | `ethereum/client-go` | 4 cores, 16 GB, 600 GB | fast disk matters more than cores |
| VPN gateway | `ghcr.io/runonflux/cumulusvpn-gateway` | 0.5 cores, 500 MB, 5 GB | bandwidth, not compute |
| Presearch | `presearch/node` | 0.3 cores, 300 MB, 2 GB | genuinely tiny |
| WordPress | `runonflux/wp-nginx` + a database | 1 core, 1 GB / 1 core, 2 GB | give the database the memory |

## 8. One correction carried in from the docs

Paying in FLUX is a **5%** discount, not 10%. v4 through v6 were trained on 10%
and said so confidently. Fixed in the generator's pricing and in every phrasing.

---

## What changed in the generator

New flows, and roughly a quarter of the corpus:

| Flow | Weight | What it teaches |
|---|---|---|
| `nodeop` | 7 | operator questions, answered from the docs, never quoted |
| `ecosystem` | 5 | SSP, Zelcore, FluxEdge, XDAO, ArcaneOS, Parallel Assets, Flux ID |
| `nodocs` | 3 | empty search results mean "I do not know" |
| `speccontact` | 5 | editing `contacts` and `description` on a draft |
| `specedit-live` | 2 | the same two fields on a deployed app |
| `realapp` | 6 | the catalogue at sizes the images need, with pushback |
| `bigorder` | 3 | the instance-count sanity check |
| `docsask` | +3 | knowledge-bot frequency, on a bank grown from 8 answers to 24 |
| deploy protocol | +11 | v6 slipped from 27/28 to 25/28 on the compact surface |

`nodeop`, `ecosystem` and `nodocs` do not force the in-app surface: they are
worth as much to the MCP and compact surfaces, and forcing the UI everywhere is
part of why the deploy protocol regressed in v6.

New eval cases 36-47 cover each of the failures above.

---

## Second pass: be a language model

The first pass fixed what v6 got *wrong*. This pass fixes what it will not do at
all. The brief was "able to do it all, just heavily favouring deployments", and
the live model does the opposite: a greeting gets a navigation, a question about
a wallet gets an invented domain, and a request for a poem gets a WordPress
pitch.

That pitch was not an accident. The v6 generator trained it. Its `offtopic`
bank answered "can you write me a poem?" with *"deployments are my thing rather
than poetry, but I can have a WordPress site for your poems running in a
minute"*, and "what is 17 times 23?" with *"391. Anything to deploy?"*. Sixteen
rows of that teach the model that every non-deployment question is an
interruption to be redirected. It has been replaced: the poem is now a poem and
the answer to 17 x 23 is `391.` with nothing after it.

**Answering a question properly and stopping is a correct answer.**

### `finetune/convo.js`

A new module, all of it written out rather than templated, because templates
multiply rows without adding information and the model has already learned the
templates.

| Bank | Entries | What is in it |
|---|---|---|
| `TECH_QA` | 30 | containers, TLS, DNS, TCP versus UDP, connection pools, health checks, image size, race conditions, idempotency |
| `WORLD_QA` | 18 | ordinary questions an assistant gets asked, answered properly |
| `CREATIVE` | 8 | stories, poems, a haiku, jokes, written out |
| `PERSONA_QA` | 20 | what model are you, are you conscious, do you make mistakes, opinions held honestly |
| `FLUX_TOPICS` | 14 | the coin, mining and the move off it, Titan, FusionX, FluxOS, how decentralized it really is, versus AWS, the marketplace |
| `TROUBLE` | 10 | real failures with real log lines: exit 137, bind address, pull auth, pool exhaustion, ENOSPC, wrong internal hostname |
| `ADVICE` | 10 | capacity planning, one instance or three, is this production ready, what does it really cost |
| `CODEHELP` | 8 | Dockerfiles, compose to specification, secrets, health endpoints, backup scripts |
| `SCRIPTS` | 20 | whole conversations, seven turns each |

### The scripted conversations

Single turns cannot teach the thing the transcripts are worst at, which is not
any one answer but the shape of an exchange: context held over six turns, one
question at a time, and a deployment that arrives when the conversation gets
there rather than on turn one.

Twenty of them, end to end, with the tool calls in place:

- game night that becomes a Valheim server, via a web search for the player cap
- a Rails app off Heroku, four components, ending on migration order and the
  real downtime figure
- a newcomer who was told "AWS but crypto", given the three honest catches
- a garage server that turns out to need an SSD, then Titan as the alternative
- a 502 traced to a database exposed on a public port for two months
- idle chat that drifts into self-hosting a password manager
- a pasted specification with three real faults, repriced from $145.80 to $48.60
- a designer with a Webflow site and no Git, taught the web-upload route
- someone pasting a seed phrase, stopped, then helped
- a surprise bill traced to two forgotten test apps at 3 instances each
- a comparison against Akash and Render, given straight
- an expiry warning, renewed, with contacts and backups set up afterwards
- a pruned Bitcoin node, then Electrs for Sparrow
- a bakery whose web developer vanished
- a request to scrape a competitor 200 ways a second, declined, then redirected
  to the rate-limited API they actually had
- self-hosting an LLM, with the warm-up and parallel-slot traps named
- a personal VPN, with the honest difference from a commercial one
- governance, including "so a whale decides everything then"
- an Australian latency problem, distance separated from application slowness
- an angry user on their third outage, traced to an unbounded connection pool

### Weights and size

| Flow | Weight | |
|---|---|---|
| `script` | 8 | whole conversations |
| `chat` | 6 | technical and general knowledge |
| `fluxtopic` | 6 | the wider ecosystem, searched then answered |
| `trouble` | 6 | read the log, name the cause, price the fix |
| `advise` | 4 | capacity and feasibility |
| `persona` | 3 | being talked to |
| `creative` | 3 | stories and poems |
| `codehelp` | 3 | Dockerfiles and config |
| `offtopic` | 3 | rewritten, no longer teaches deflection |

The corpus goes from 12,000 dialogues to **30,000**, and the training split from
17,053 rows to **34,153**. Sixteen percent are three turns or more, against
almost none before.

The generator now drops exact duplicates and re-rolls. Scripted conversations
are emitted close to verbatim, so without it the same dialogue would appear
dozens of times at this size and the model would memorise it instead of learning
the shape. The run reports how many it regenerated, which is also the signal
that a content bank has been exhausted.

---

## Third pass: the ecosystem and the wallets

The second pass made the model conversational. This pass gives it something to say.

v6 on twelve deep ecosystem and wallet questions scores 2 out of 6 on the new
cases, and the failures are the dangerous kind rather than the annoying kind.

| Asked | v6 answered |
|---|---|
| i lost my phone with ssp key, can i still get to my funds | "No way to recover it. The SSP key is what unlocks the app, and the network does not keep a copy." |
| which wallets can i sign a deployment with | "Flux Cloud, the Flux CLI, or the Flux Desktop app. They all use the same Ethereum account." |
| how do i claim my parallel assets | opened the templates page |
| how do i unlock my fluxnode collateral | opened the governance page |

The first is wrong in a way that costs money: someone reading it concludes their
funds are gone when they are one restore away. The second invents two products
and an account model. Both were answered from memory with no search.

### Where the facts came from

Four parallel passes over the docs corpus, which has 26,879 chunks and turned out
to be far deeper than anything used so far: **zelcore.io** alone is 7,277 chunks
and **sspwallet.io** 3,731, and neither had been touched. FluxCore, FluxEdge,
registry authentication, multiple mounts and the shared database had no coverage
at all.

Every answer in the new banks is written from a passage that was actually read,
and the flows retrieve before they state.

### New banks

| Bank | Entries | Follow-ups | Covers |
|---|---|---|---|
| `WALLET_QA` | 10 | 20 | Zelcore, SSP, accounts and recovery, the relay, node management from a wallet, Titan, Earn, which wallets sign what |
| `WALLET_SAFETY` | 10 | — | seed phrases, scam patterns, what the assistant cannot do, secrets in environment variables |
| `DEEP_QA` | 13 | 14 | FluxCore, FluxEdge, private registries, multiple mounts, the shared database, unlocking collateral, parallel assets, app management, FluxDrive plans, Progressive Node Rewards, managed nodes, the ecosystem, the node service API |

Weights: `wallet` 7, `deepfact` 10, `walletsafety` 5.

### The things worth knowing that are now in the data

- **`repoauth` is a string, never an object**, and the exact provider forms:
  `aws-ecr://region=…&accessKeyId=…`, `azure-acr://clientId=…&tenantId=…`,
  `google-gar://keyFile=<base64 of the service account JSON>`. Tokens live in
  memory only, and last 12 hours for ECR, 3 for ACR, 60 minutes for GAR.
- **`containerData` takes pipe-separated mounts**, with `m:` for a directory,
  `f:` for a file, and `c:`/`cf:` to reach into another component, which may only
  be one earlier in the compose array.
- **Unlocking collateral** is Apps then FluxNodes then Delete, completes in
  seconds, and re-locks if you refresh the screen while it runs. Afterwards send
  a non-collateral amount to break the exact output.
- **Parallel assets** are ten chains, claimed manually through Fusion, and an
  empty address dropdown means the balance is below the claim fee rather than a
  bug.
- **Progressive Node Rewards are ArcaneOS only**, 80% to operators and 20% to the
  nodes actually hosting. Legacy nodes get none of it.
- **Soft reinstall keeps the volume, hard reinstall wipes it.** An update cannot
  add components but can change the `owner` field to transfer an app. The renewal
  toggle on an update is on by default and extends the term.
- **SSP recovery does not need the seed** when one device survives, and one wallet
  pairs with exactly one key.
- **FluxCore providers cannot set their own price**, and losing a machine
  mid-lease forfeits 20% of that lease's rewards with a five-minute window to
  return.
- **FluxEdge deposits are non-refundable and non-withdrawable.**
- **fluxai.io is not a Flux property.** The AI product is ai.runonflux.com. This
  is in the data as an explicit negative, because the name invites the mistake.

### Two facts the earlier passes had wrong

**Node RAM.** The corpus carries two hardware tables. The legacy FluxNode guide
says Nimbus 16 GB and Stratus 32 GB; the current ArcaneOS guide and
`what-are-fluxnodes.md` say 32 GB and 64 GB. The first two passes trained the
legacy figures. Now the current ones.

**The rate card.** v4 through v6 state "$0.90 per core, $0.75 per GB of RAM and
$0.12 per GB of disk" with confidence. The published rate card is quoted per 0.1
core and per 100 MB, and its own worked examples do not reconcile with either
reading. So the model no longer recites rates at all: it says the shape of the
pricing, notes the surcharges and the 5% FLUX discount, and quotes the actual
number with the tool.

### A domain audit, as a gate

`finetune/audit-domains.js` scans a generated corpus for any domain the
**assistant** states that is not attested in the docs corpus, ignoring domains
that appear only in a user message or a tool result. The allowlist was built by
extracting every domain the corpus actually contains, plus the reserved example
domains the data uses for user-owned things.

This exists because the worst thing this model has done in production was invent
`sspwallet.online` and a QR button to go with it. The research confirmed that
string appears nowhere in the corpus. A wrong URL is worse than "I do not know",
because the user acts on it and a typo-squat is one registration away.

The current corpus passes with zero unattested domains.

---

## Fourth pass: marketplace specifications, exactly

Every marketplace specification in the training data up to here was written from
memory, and memory was wrong in ways that break a real deployment.

The catalogue now comes from `api.marketplace.runonflux.io/api/v1/marketplace`,
fetched by `tools/fetch-marketplace.js` into `finetune/data/marketplace.json`:
**87 enabled and visible apps** across Games, NewGames, Blockchain, Productivity,
Masternode, Front-end and Hosting.

There is an older endpoint at `stats.runonflux.io/marketplace/listapps` that also
answers. It is a stale subset: it misses the entire NewGames category and carries
a different Minecraft ladder. The v1 API is the one fluxcloud-web itself reads.

### The field that was missing entirely

**56 of the 87 apps carry a sync flag on `containerData`**, and no training row in
any previous round had one.

From `ZelBack/src/services/utils/mountParser.js`, the parser knows exactly three:

| Flag | Meaning |
|---|---|
| `g:` | primary/standby. One instance serves, the others hold a synchronised copy and take over. |
| `r:` | replicated. Every instance runs and the directory is synchronised between them. |
| `s:` | Syncthing folder, without the primary/standby election. |

Every game in the marketplace uses `g:`. `Minecraft9GB` is `g:/data`,
`Palworld8Slots` is `g:/palworld/Pal/Saved`, `Valheim` is `g:/config`. Eight apps
combine it with the multiple-mount syntax, so `DontStarveTogether` is
`g:/data|m:dst_server:/home/dst/dst_server`.

This is the migration story the model could not tell. A game deployed as one
instance with a plain `containerData` path loses its world the first time the
network reschedules it, and that is precisely what the old training data taught
the model to build.

And from `appSpecHelpers.js`, a fact worth knowing that appears in no
documentation page: **a `g:` application is priced at 0.8 of the normal rate**.
The sync flag is a 20% discount.

### What the old data had wrong

| | Trained | Actual |
|---|---|---|
| Palworld image | `runonflux/palworld-server-flux` | `thijsvanloef/palworld-server-docker` for the Games entry |
| Palworld 8 slots | 4 cores, 16 GB, 40 GB | 2.5 cores, 6300 MB, 15 GB |
| Minecraft | 3 cores, 8 GB, 30 GB | 2 cores, 9 GB, 60 GB at the 9 GB rung |
| Valheim | 2 cores, 6 GB, 20 GB, one instance | 2 cores, 4 GB, 10 GB, two instances, `g:/config` |
| Instances for a game | 1, "because the world is one save file" | 3 in Games, 2 in NewGames, always with `g:` |
| `containerData` | absent | the field that decides whether the data survives |

The "one instance for a game server" advice ran through the bigorder flow, the
realapp flow, the capacity advice and two scripted conversations. All of it is
rewritten. The scale check still fires on "30 instances", but the correct answer
changed: the extra instances are standby copies rather than separate worlds, and
dropping to one is the mistake rather than the fix.

`REAL_APPS` no longer hardcodes sizes. It looks them up in the catalogue by
marketplace name, so a refetch updates the training data and it cannot drift
again.

### New flows

| Flow | Weight | What it teaches |
|---|---|---|
| `mktdeploy` | 8 | deploy a catalogue app at its exact image, ports, environment, resources, instance count and `containerData` |
| `mktladder` | 6 | the marketplace sells one app at several sizes; pick the rung, then deploy it |
| `syncmode` | 6 | what `g:`, `r:` and `s:` do, what happens on a migration without one, and the 20% discount |

Five ladders exist in the catalogue: Minecraft Java at 8 rungs, Minecraft Bedrock
at 8, Palworld at 4, Kaspa at 4 and Enshrouded at 3.

### Eval

Cases 54 to 59 cover the exact image, the flag on a Minecraft deployment, what
`g:` means, what happens when a node goes offline, the one-instance trap, and
the size ladder.

**v6 scores 0 of 6.** Asked whether it would lose its world if the node went
offline, it replied about an unrelated nginx worker. Asked to deploy Palworld it
quoted "2 cores, 50 GB, 8000 MB" with no image and no flag. Asked what `g:` means
it said it could not find a definition and guessed it was "probably a field you
set in the app's JSON spec".

The domain audit now also trusts any domain that appears in the catalogue itself,
since an app's environment parameters can legitimately carry a bootstrap URL.
