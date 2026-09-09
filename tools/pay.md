# Paying the consensus price

`tools/register.js` broadcasts the specification message for free and prints a
64-hex message hash plus the amount consensus actually requires. Nothing is
spent until you send the payment transaction yourself — and because you build
that transaction, you choose the amount.

## What the chain checks

Two independent things, in two different files:

- `explorerService.js:330` scans every block for a transaction that both pays
  one of the app addresses and carries a 64-character message in an
  `OP_RETURN`. It sums **all** outputs to the app address into `valueSat`.
- `messageVerifier.js:736` then accepts the app if
  `valueSat >= appPrice * 1e8`, where `appPrice` comes from the **chain** price
  table — no HW discount, no USD table, no market-rate conversion.

Accepted app addresses (any of them): `t1LUs6quf7TB2zVZmexqPQdnqmrFMGZGjV6`,
`t3aGJvdtd8NR6GrnqnRuVEzH6MbrXuJFLUX`, `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX`.
Use the last one — it is what `/apps/deploymentinformation` currently reports.

## Sending it from a Flux daemon

You need a wallet that can attach an `OP_RETURN`, which in practice means the
daemon. Check your RPC set first — these names come from the Zcash lineage and
your build may differ:

```sh
flux-cli help | grep -iE 'rawtransaction|sendmany'
```

Then:

```sh
HASH=<64 hex from register.js>
AMOUNT=1.92          # the printed consensus price
ADDR=t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX

RAW=$(flux-cli createrawtransaction '[]' "{\"$ADDR\":$AMOUNT,\"data\":\"$HASH\"}")
FUNDED=$(flux-cli fundrawtransaction "$RAW" | python3 -c 'import sys,json;print(json.load(sys.stdin)["hex"])')
SIGNED=$(flux-cli signrawtransaction "$FUNDED" | python3 -c 'import sys,json;print(json.load(sys.stdin)["hex"])')
flux-cli sendrawtransaction "$SIGNED"
```

Confirm it landed by watching the app appear:

```sh
curl -s https://api.runonflux.io/apps/globalappsspecifications/<appname> | head -c 400
```

Pay promptly — the temporary message has a one-hour TTL
(`fluxapps.tempMsgTtlS`). If it expires before the payment confirms, re-run
`register.js` for a fresh hash and pay that one instead.

## If you would rather not hand-build a transaction

Import the JSON into Flux Home instead. It handles signing, broadcast and
payment in one flow — and charges the USD-table quote, roughly 90x the
consensus price at the current FLUX rate. That is the entire trade-off.
