# `flux_diagnose_app` — tool spec for the FluxCloud backend

The FluxCloud assistant answers "why did my app restart / crash / go down?" with
this tool. The backend returns **raw facts**; the hub's decision layer
(`images/hub/harness.js`, `diagnose()`) decides the cause, the fix and the price
difference, so the rules live in one place and the model only relays them.

Without this tool the model guesses: asked "why did palworld-friends restart?",
it read only the log, saw `Killed`, and answered "most likely running out of
disk" for an app that had hit its memory limit.

**Implemented** in fluxcloud-web (`src/features/deploy/agent/lookups.ts`,
`diagnoseApp` / `componentFacts`), which runs the assistant's tools in the
browser as the signed-in owner. A `g:` app is read on its primary instance:
the standbys run no container.

## Tool definition (in `finetune/tools-ui.js` and fluxcloud-web `tools.ts`)

```json
{
  "name": "flux_diagnose_app",
  "description": "Why an app restarted, crashed or went down: the last restart and its reason, memory and disk use against their limits, and the end of the log, for each component. Call it first for any \"why did it restart / crash / stop / go down\" question, and answer from its diagnosis.",
  "parameters": { "type": "object", "required": ["name"],
    "properties": { "name": { "type": "string" }, "component": { "type": "string" } } }
}
```

Match `name` leniently: users type `palworld-friends` for the app `palworldfriends`
(Flux names cannot contain dashes). Compare lowercase with non-alphanumerics removed.

## Response

```json
{
  "name": "palworldfriends",
  "instances": 3,
  "usdPerMonth": 17.34,
  "components": [
    {
      "name": "palworld",
      "image": "thijsvanloef/palworld-server-docker:latest",
      "limits": { "cpu": 2.5, "ramMB": 8000, "hddGB": 15 },
      "containerData": "g:/palworld/Pal/Saved",
      "env": ["PLAYERS=12"],
      "state": {
        "status": "running",
        "startedAt": "2026-09-27T14:02:33Z",
        "restartCount": 1,
        "lastExit": { "at": "2026-09-27T14:02:31Z", "exitCode": 137, "oomKilled": true }
      },
      "memory": { "currentMB": 3100, "peakMB": 7998, "peakAt": "2026-09-27T14:02:12Z" },
      "disk": { "usedGB": 6.1 },
      "logTail": ["[14:01:58] Player joined (12/32)", "[14:02:11] Saving world...", "Killed"]
    }
  ]
}
```

Unknown app: return the owner's app names so the harness can correct the call.

```json
{ "error": "no app named \"minecraft\"", "yourApps": ["mcworld", "palworldfriends"] }
```

### Where each field comes from

Read from the instance the user is asking about (or, for a multi-instance app,
the one with the most recent restart). All endpoints are FluxOS, authenticated
as the app owner.

| Field | Source |
|---|---|
| `limits.cpu/ramMB/hddGB`, `containerData`, `env`, `image`, `instances` | the app specification |
| `usdPerMonth` | the current price of the running spec (the same figure `flux_quote_app` returns). **Required for the fix to be priced as a difference.** |
| `state.status`, `state.startedAt`, `state.restartCount` | `GET /apps/appinspect/<component>_<app>`: `State.Status`, `State.StartedAt`, `RestartCount` |
| `state.lastExit.at`, `.exitCode`, `.oomKilled` | same: `State.FinishedAt`, `State.ExitCode`, `State.OOMKilled`. Omit `lastExit` when the container has never exited (`FinishedAt` is the zero time). |
| `memory.currentMB` | `GET /apps/appstats/<component>_<app>`: `memory_stats.usage` |
| `memory.peakMB`, `memory.peakAt` | `GET /apps/appmonitor/<component>_<app>/<range>`: maximum `memoryUsage` over the window (24 h is enough), with its `timestamp`. The same series feeds a "Show memory graph" button. |
| `disk.usedGB` | the latest `appmonitor` sample's `disk.used` (or `/apps/appstats` `disk_stats`) |
| `logTail` | `GET /apps/applog/<component>_<app>/30`: the last ~30 lines, newest last. Strip ANSI colour codes; never include environment values. |

Bytes to MB: divide by 1,000,000 (Flux specifies RAM in decimal MB).

## What the harness does with it

`diagnose()` in `images/hub/harness.js`, first match wins:

| Cause | Rule | Fix it proposes |
|---|---|---|
| out of memory | `oomKilled`, or exit 137 with `peakMB` ≥ 95% of `ramMB` | RAM to 1.5× the limit, or the marketplace size for the player count if larger, rounded up to 1000 MB (max 59000) |
| disk full | `usedGB` ≥ 95% of `hddGB`, or "No space left on device" in the log | disk to 1.5×, rounded up to 5 GB |
| exited on its own | exit code 0 | none: the process finished and Flux restarted it |
| crashed | any other non-zero exit | none: quotes the last error line of the log |
| moved to another node | no `lastExit`, fresh `startedAt` | none; notes an empty volume when `containerData` has no `g:`/`r:` flag |

When there is a fix, the harness has the model quote it with `flux_quote_app`
(and issues that call itself if the model will not). The quote result gains
`change.addsUsdPerDay` / `addsUsdPerMonth` against `usdPerMonth`, and the reply
check requires the difference ("adds about $0.11 per day"), never the new total
presented as the increase.

## Tests

`tools/deploy-agent-eval.js` cases 66-70 mock this response shape for five
apps (out of memory, disk full, crash loop, reschedule, clean exit):

```
FLUX_LLM_KEY=x node tools/deploy-agent-eval.js --base http://localhost:11434/v1 \
  --model fluxai-tinyh-v10 --ui --harness --case 66,67,68,69,70
```

## Documentation search

`flux_search_docs` in the web app posts `{query, k}` to the docs bot's
retrieval-only endpoint through the router (`ownllmrouter.../search`, docs bot
1.4.40): the passages `/ask` would answer from, `{results: [{n, title, text,
url}]}`, with no generation. Public like `/ask`, and rate limited the same way.
