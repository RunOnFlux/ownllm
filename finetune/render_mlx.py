#!/usr/bin/env python3
"""Render chat JSONL into mlx-lm prompt/completion pairs.

mlx-lm's LoRA trainer masks the prompt when given {"prompt", "completion"}
records, which is exactly assistant-only loss. A conversation with several
assistant turns becomes several records: the prompt is the chat template
rendered up to that turn (with the tools, so tool schemas and tool results
are in the prompt as they will be at serving), the completion is that
assistant turn rendered by the same template (tool calls included).

  finetune/.venv-mlx/bin/python finetune/render_mlx.py --base Qwen/Qwen3.5-2B \
      --data finetune/data/train.jsonl --eval finetune/data/eval.jsonl --out finetune/data/mlx-qwen
"""
import argparse, json, os, sys
from transformers import AutoTokenizer

ap = argparse.ArgumentParser()
ap.add_argument('--base', required=True)
ap.add_argument('--data', required=True)
ap.add_argument('--eval', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--max-chars', type=int, default=40000)
ap.add_argument('--max-tokens', type=int, default=6144, help='drop pairs longer than this; a truncated pair loses its completion and the masked loss becomes NaN')
a = ap.parse_args()

tok = AutoTokenizer.from_pretrained(a.base, trust_remote_code=True)

def norm(messages):
    out = []
    for m in messages:
        m = dict(m)
        if m.get('tool_calls'):
            calls = []
            for c in m['tool_calls']:
                c = json.loads(json.dumps(c))
                args_ = c['function'].get('arguments')
                if isinstance(args_, str):
                    try: c['function']['arguments'] = json.loads(args_)
                    except Exception: pass
                calls.append(c)
            m['tool_calls'] = calls
        if m.get('content') is None: m['content'] = ''
        out.append(m)
    return out

def render(messages, tools, gen=False):
    kw = {'tokenize': False, 'add_generation_prompt': gen}
    if tools: kw['tools'] = tools
    return tok.apply_chat_template(messages, **kw)

def pairs(row):
    msgs = norm(row['messages']); tools = row.get('tools')
    res = []
    for i, m in enumerate(msgs):
        if m['role'] != 'assistant': continue
        # The prompt ends with the assistant header (generation prompt), exactly
        # as it does at serving time, so the completion is the turn body only.
        # Putting the header in the completion teaches the model to re-emit it
        # (v2 attempt 2: '<tool_call>assistant<tool_call>' loops after fusing).
        before = render(msgs[:i], tools, gen=True)
        upto = render(msgs[:i + 1], tools)
        if not upto.startswith(before):
            # template not prefix-monotonic for this turn; skip rather than mislabel
            continue
        # the assistant turn itself, minus any generation prompt the template
        # appended to `before` (strip a trailing generation prompt if present)
        completion = upto[len(before):]
        if not completion.strip(): continue
        res.append({'prompt': before, 'completion': completion})
    return res

def convert(src, dst):
    n = 0; skipped = 0
    with open(src) as f, open(dst, 'w') as o:
        for line in f:
            if not line.strip(): continue
            row = json.loads(line)
            ps = pairs(row)
            if not ps: skipped += 1
            for p in ps:
                if len(p['prompt']) + len(p['completion']) > a.max_chars: skipped += 1; continue
                if len(tok(p['prompt'] + p['completion']).input_ids) > a.max_tokens: skipped += 1; continue
                o.write(json.dumps(p) + '\n'); n += 1
    return n, skipped

os.makedirs(a.out, exist_ok=True)
n1, s1 = convert(a.data, os.path.join(a.out, 'train.jsonl'))
n2, s2 = convert(a.eval, os.path.join(a.out, 'valid.jsonl'))
print(f'train {n1} pairs ({s1} skipped), valid {n2} pairs ({s2} skipped) -> {a.out}')
# show one rendered pair so the masking boundary can be eyeballed
with open(os.path.join(a.out, 'train.jsonl')) as f:
    ex = json.loads(f.readline())
print('--- prompt tail:', repr(ex['prompt'][-300:]))
print('--- completion:', repr(ex['completion'][:300]))
