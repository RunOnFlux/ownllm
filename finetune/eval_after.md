# evaluating a fine-tuned model

after `merge_and_convert.sh` you have `runs/gguf/<name>/Modelfile`. everything
below runs on a laptop with ollama; no gpu needed for the tiny-h q4 (~5 GB ram).

## 1. serve it locally

```sh
cd runs/gguf/<name>
ollama create <name> -f Modelfile
ollama run <name> "say hi"                      # smoke test
ollama show <name> --modelfile | head -30       # confirm TEMPLATE has tool rendering
```

ollama exposes an openai-compatible api on `http://localhost:11434/v1`. the eval
tools send a bearer key; ollama ignores it, but the scripts refuse to start
without one, so export anything:

```sh
export FLUX_LLM_KEY=local
```

## 2. tool-calling eval (deploy-with-ai agent)

mocks the flux cloud mcp tools and scores the first tool call, argument
correctness, quote-before-deploy and latency on the four chat-row scenarios:

```sh
node tools/deploy-agent-eval.js --base http://localhost:11434/v1 --model <name>
node tools/deploy-agent-eval.js --base http://localhost:11434/v1 --model <name> --tools full   # all 15 tools
```

it needs the tool schemas at `/tmp/mcp-tools.json` (or `--tools-file`); the
script explains how to dump them from mcp.runonflux.com if the file is missing.
compare against the untuned base with `--model granite4:tiny-h`.

## 3. rag quality eval (adversarial context)

```sh
node tools/eval-quality.js localhost:11434 <name> granite4:tiny-h
```

takes host then model names; prints per-question pass/fail and a summary so the
tuned model and the base can be compared side by side. the easier
`tools/bench-models.js` also accepts the same host if you want the baseline.

## 4. what to look at

- tool calls: valid json arguments, the right first tool, no invented keys
- refusal behaviour: still declines questions the context cannot answer
- regression: run the base model through the same two scripts in the same
  session and diff; a tune that wins on tools but loses on rag is not shippable
- speed: q4 tiny-h should be within a few percent of the base on the same box
