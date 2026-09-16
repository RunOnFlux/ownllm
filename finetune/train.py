#!/usr/bin/env python3
"""lora / qlora supervised fine-tuning for chat + tool-call datasets.

targets ibm-granite/granite-4.0-h-tiny (the hf model behind ollama's
granite4:tiny-h) but is model-agnostic: anything with a chat template that
accepts `tools=` works (Qwen/Qwen3.5-2B, granite-4.0-micro, ...).

  python finetune/train.py --base ibm-granite/granite-4.0-h-tiny \
      --data data/train.jsonl --eval data/eval.jsonl --out runs/tinyh-v1 \
      [--epochs 2 --lr 2e-4 --r 16 --alpha 32 --max-len 4096 --batch 4 \
       --grad-accum 4 --bf16 --qlora]

dataset: one json object per line, openai chat format:
  {"messages": [{"role": "system"|"user"|"assistant"|"tool", ...}],
   "tools": [{"type": "function", "function": {"name", "description", "parameters"}}]}
assistant messages may carry "tool_calls": [{"id", "type": "function",
"function": {"name", "arguments"}}] where arguments is a json string (openai)
or an object; tool messages carry "tool_call_id".

design choices
- we tokenize ourselves instead of letting trl apply the template, because
  trl's conversational path does not pass a per-example `tools` list, and tool
  schemas are the whole point here. the chat template is applied with
  `tools=` and the result handed to SFTTrainer pre-tokenized
  (dataset_kwargs={"skip_prepare_dataset": True}), which keeps us independent
  of trl's dataset-format churn.
- loss on assistant tokens only. we try the template's own `{% generation %}`
  markers first (return_assistant_tokens_mask); most templates, granite's
  included, lack them, so the fallback renders the conversation prefix up to
  each assistant turn and marks the char span it adds. that is exact as long
  as the template renders prefixes consistently (it does for granite/qwen);
  if a prefix check fails we warn and train on the whole sequence for that
  example.
- lora on every nn.Linear except lm_head/embeddings: attention q/k/v/o, dense
  mlp gate/up/down (granite: shared_mlp input_linear/output_linear), and the
  mamba2 in_proj/out_proj. granite's moe experts are 3-d parameters, not
  nn.Linear, so they stay frozen; that is fine for behaviour tuning.
- tool_call.function.arguments is normalised to a dict (what hf templates
  expect: they `tojson` it). --args-as-string keeps json strings for the few
  templates that print arguments verbatim.
"""
import argparse
import json
import os
import sys
import time
import warnings
from pathlib import Path

import torch
from torch import nn


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--base", default="ibm-granite/granite-4.0-h-tiny", help="hf model id or local path")
    p.add_argument("--data", required=True, help="train jsonl")
    p.add_argument("--eval", default=None, help="eval jsonl (optional)")
    p.add_argument("--out", required=True, help="output dir for adapter + logs")
    p.add_argument("--epochs", type=float, default=2)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--r", type=int, default=16, help="lora rank")
    p.add_argument("--alpha", type=int, default=32, help="lora alpha (2*r is the usual choice)")
    p.add_argument("--dropout", type=float, default=0.05)
    p.add_argument("--max-len", type=int, default=4096, help="token limit; longer examples are truncated on the right")
    p.add_argument("--batch", type=int, default=4, help="per-device micro batch")
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--bf16", action="store_true", help="bf16 weights/compute (default on ampere+; fp32 otherwise)")
    p.add_argument("--qlora", action="store_true", help="4-bit nf4 base via bitsandbytes; lora adapters stay bf16")
    p.add_argument("--grad-ckpt", action="store_true", help="gradient checkpointing (trade compute for memory)")
    p.add_argument("--warmup", type=float, default=0.03, help="warmup ratio")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--args-as-string", action="store_true", help="keep tool_call arguments as json strings")
    p.add_argument("--drop-long", action="store_true", help="drop examples over --max-len instead of truncating")
    p.add_argument("--target-modules", default=None, help="comma list to override auto lora targets")
    p.add_argument("--dry-run", action="store_true", help="tokenize, print stats + one rendered example, exit")
    return p.parse_args()


# --------------------------------------------------------------------------- data

def read_jsonl(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                sys.exit(f"{path}:{n}: bad json: {e}")
    return rows


def normalise_messages(messages, args_as_string):
    """coerce openai-style messages into what hf chat templates expect."""
    out = []
    for m in messages:
        m = dict(m)
        if m.get("content") is None:
            m["content"] = ""
        if m.get("role") == "assistant" and m.get("tool_calls"):
            calls = []
            for c in m["tool_calls"]:
                c = json.loads(json.dumps(c))  # deep copy
                fn = c.get("function") or {}
                a = fn.get("arguments", {})
                if args_as_string:
                    if not isinstance(a, str):
                        a = json.dumps(a, ensure_ascii=False)
                else:
                    if isinstance(a, str):
                        try:
                            a = json.loads(a) if a.strip() else {}
                        except json.JSONDecodeError:
                            warnings.warn(f"tool_call arguments not json, keeping string: {a[:80]!r}")
                fn["arguments"] = a
                c["function"] = fn
                c.setdefault("type", "function")
                calls.append(c)
            m["tool_calls"] = calls
        out.append(m)
    return out


def render(tok, messages, tools, add_generation_prompt):
    return tok.apply_chat_template(
        messages, tools=tools or None, tokenize=False, add_generation_prompt=add_generation_prompt
    )


def assistant_char_spans(tok, messages, tools):
    """[(start, end)] char spans of assistant turns in the fully rendered text.

    renders messages[:i] with the generation prompt and messages[:i+1] without,
    and takes the difference. verifies the prefix property so a template that
    renders non-monotonically is detected rather than silently mislabelled.
    """
    full = render(tok, messages, tools, False)
    spans = []
    for i, m in enumerate(messages):
        if m["role"] != "assistant":
            continue
        before = render(tok, messages[:i], tools, True)
        through = render(tok, messages[: i + 1], tools, False)
        if not (full.startswith(before) and full.startswith(through) and len(through) > len(before)):
            return full, None
        spans.append((len(before), len(through)))
    return full, spans


def encode_example(tok, row, max_len, args_as_string, drop_long):
    messages = normalise_messages(row["messages"], args_as_string)
    tools = row.get("tools") or None
    if not any(m["role"] == "assistant" for m in messages):
        return None, "no assistant turn"

    # path 1: template with {% generation %} markers.
    try:
        enc = tok.apply_chat_template(
            messages, tools=tools, tokenize=True, return_dict=True,
            return_assistant_tokens_mask=True, add_generation_prompt=False,
        )
        ids, mask = list(enc["input_ids"]), list(enc["assistant_masks"])
        if not any(mask):
            raise ValueError("template has no generation markers")
    except Exception:
        # path 2: prefix diffing + offset mapping.
        text, spans = assistant_char_spans(tok, messages, tools)
        enc = tok(text, add_special_tokens=False, return_offsets_mapping=True)
        ids = enc["input_ids"]
        if spans is None:
            warnings.warn("template prefix check failed; training on all tokens for one example")
            mask = [1] * len(ids)
        else:
            mask = []
            for (s, e) in enc["offset_mapping"]:
                # a token is trainable if it overlaps any assistant span
                mask.append(int(any(s < se and e > ss for ss, se in spans)))

    if len(ids) > max_len:
        if drop_long:
            return None, "too long"
        ids, mask = ids[:max_len], mask[:max_len]
    if not any(mask):
        return None, "assistant tokens truncated away"
    return {"input_ids": ids, "completion_mask": mask}, None


def build_dataset(tok, path, a):
    from datasets import Dataset
    rows = read_jsonl(path)
    feats, dropped = [], {}
    for r in rows:
        ex, why = encode_example(tok, r, a.max_len, a.args_as_string, a.drop_long)
        if ex is None:
            dropped[why] = dropped.get(why, 0) + 1
        else:
            feats.append(ex)
    lens = [len(f["input_ids"]) for f in feats]
    train_toks = sum(sum(f["completion_mask"]) for f in feats)
    print(f"[data] {path}: {len(feats)} examples kept, dropped={dropped or 0}, "
          f"tokens max={max(lens) if lens else 0} mean={sum(lens)/max(len(lens),1):.0f}, "
          f"assistant tokens={train_toks}")
    if not feats:
        sys.exit("no usable examples")
    return Dataset.from_list(feats)


class PadCollator:
    """pads input_ids, builds attention_mask and labels (-100 off the completion mask).

    we ship our own collator so the assistant-only loss does not depend on
    which trl version is installed (completion_only_loss / assistant_only_loss
    names moved around between 0.17 and 0.21)."""

    def __init__(self, pad_id):
        self.pad_id = pad_id

    def __call__(self, batch):
        n = max(len(b["input_ids"]) for b in batch)
        ids = torch.full((len(batch), n), self.pad_id, dtype=torch.long)
        att = torch.zeros((len(batch), n), dtype=torch.long)
        lab = torch.full((len(batch), n), -100, dtype=torch.long)
        for i, b in enumerate(batch):
            L = len(b["input_ids"])
            t = torch.tensor(b["input_ids"], dtype=torch.long)
            m = torch.tensor(b["completion_mask"], dtype=torch.bool)
            ids[i, :L] = t
            att[i, :L] = 1
            lab[i, :L] = torch.where(m, t, torch.full_like(t, -100))
        return {"input_ids": ids, "attention_mask": att, "labels": lab}


# --------------------------------------------------------------------------- model

def find_lora_targets(model):
    """names of every linear leaf except the output head and embeddings.

    returns the set of *leaf names* (peft matches on suffix), e.g.
    {'q_proj','k_proj','v_proj','o_proj','in_proj','out_proj','input_linear','output_linear'}."""
    skip = ("lm_head", "embed_tokens", "embed_out", "wte", "score")
    linear_types = (nn.Linear,)
    try:
        import bitsandbytes as bnb
        linear_types = linear_types + (bnb.nn.Linear4bit, bnb.nn.Linear8bitLt)
    except Exception:
        pass
    names = set()
    for full, mod in model.named_modules():
        if isinstance(mod, linear_types) and not any(s in full for s in skip):
            names.add(full.split(".")[-1])
    return sorted(names)


def load_model_and_tok(a):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(a.base, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token  # granite: <|end_of_text|>; qwen: <|endoftext|>
    tok.padding_side = "right"

    dtype = torch.bfloat16 if a.bf16 else torch.float32
    kw = dict(torch_dtype=dtype, trust_remote_code=True)
    if a.qlora:
        from transformers import BitsAndBytesConfig
        kw["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16 if a.bf16 else torch.float16,
        )
        kw["device_map"] = {"": 0}
    elif torch.cuda.is_available():
        kw["device_map"] = {"": 0}
    model = AutoModelForCausalLM.from_pretrained(a.base, **kw)
    model.config.use_cache = False
    return model, tok


def wrap_lora(model, a):
    from peft import LoraConfig, get_peft_model
    # Not prepare_model_for_kbit_training(): it upcasts every non-quantized
    # parameter to float32, and on a MoE hybrid like granite tiny-h the routed
    # experts are 3-D tensors bitsandbytes does not quantize - ~6B params that
    # became 24 GB of fp32 and OOM-ed a 24 GB card before training started.
    # Base weights are frozen by peft anyway; bf16 compute keeps the norms fine.
    if a.qlora:
        for p_ in model.parameters():
            p_.requires_grad_(False)
    targets = a.target_modules.split(",") if a.target_modules else find_lora_targets(model)
    print(f"[lora] target modules: {targets}")
    cfg = LoraConfig(r=a.r, lora_alpha=a.alpha, lora_dropout=a.dropout, bias="none",
                     task_type="CAUSAL_LM", target_modules=targets)
    model = get_peft_model(model, cfg)
    if a.grad_ckpt:
        model.enable_input_require_grads()
        # non-reentrant checkpointing is required for the mamba2 layers
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.print_trainable_parameters()
    return model, targets


# --------------------------------------------------------------------------- main

def main():
    a = parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(a.seed)

    model, tok = load_model_and_tok(a)
    train_ds = build_dataset(tok, a.data, a)
    eval_ds = build_dataset(tok, a.eval, a) if a.eval else None

    if a.dry_run:
        ex = train_ds[0]
        ids, m = ex["input_ids"], ex["completion_mask"]
        print("---- rendered example 0 (assistant tokens in [[ ]]) ----")
        buf, on = [], False
        for t, k in zip(ids, m):
            if k and not on:
                buf.append("[["); on = True
            if not k and on:
                buf.append("]]"); on = False
            buf.append(tok.decode([t]))
        if on:
            buf.append("]]")
        print("".join(buf))
        return

    model, targets = wrap_lora(model, a)

    train_cfg = dict(
        output_dir=str(out), num_train_epochs=a.epochs, learning_rate=a.lr,
        per_device_train_batch_size=a.batch, per_device_eval_batch_size=a.batch,
        gradient_accumulation_steps=a.grad_accum, lr_scheduler_type="cosine", warmup_ratio=a.warmup,
        weight_decay=0.0, bf16=a.bf16, fp16=False, logging_steps=5, logging_first_step=True,
        eval_strategy="epoch" if eval_ds is not None else "no", save_strategy="epoch", save_total_limit=2,
        report_to=["tensorboard"], remove_unused_columns=False,  # keep completion_mask for the collator
        gradient_checkpointing=a.grad_ckpt, gradient_checkpointing_kwargs={"use_reentrant": False},
        optim="paged_adamw_8bit" if a.qlora else "adamw_torch", seed=a.seed, dataloader_num_workers=2,
        group_by_length=True,  # fewer pad tokens per batch
    )
    collator = PadCollator(tok.pad_token_id)

    try:
        from trl import SFTConfig, SFTTrainer
        cfg = SFTConfig(**train_cfg, max_length=a.max_len, packing=False,
                        dataset_kwargs={"skip_prepare_dataset": True})
        trainer = SFTTrainer(model=model, args=cfg, train_dataset=train_ds, eval_dataset=eval_ds,
                             data_collator=collator, processing_class=tok)
        print("[trainer] trl SFTTrainer (pre-tokenized, assistant-only labels via collator)")
    except ImportError:
        # fallback: plain hf trainer. functionally identical because the loss
        # masking lives in the collator, not in trl.
        from transformers import Trainer, TrainingArguments
        cfg = TrainingArguments(**train_cfg)
        trainer = Trainer(model=model, args=cfg, train_dataset=train_ds, eval_dataset=eval_ds,
                          data_collator=collator, processing_class=tok)
        print("[trainer] transformers Trainer (trl not installed)")

    t0 = time.time()
    result = trainer.train()
    print(f"[train] done in {(time.time()-t0)/60:.1f} min: {result.metrics}")
    if eval_ds is not None:
        print(f"[eval] final: {trainer.evaluate()}")

    adapter_dir = out / "adapter"
    trainer.model.save_pretrained(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))
    config = {k: v for k, v in vars(a).items()}
    config.update(target_modules=targets, train_examples=len(train_ds),
                  eval_examples=len(eval_ds) if eval_ds is not None else 0,
                  metrics=result.metrics, adapter=str(adapter_dir),
                  versions={m: __import__(m).__version__ for m in ("torch", "transformers", "peft")})
    (out / "train-config.json").write_text(json.dumps(config, indent=2, default=str))
    json.dump(trainer.state.log_history, open(out / "log-history.json", "w"), indent=1)
    print(f"[save] adapter -> {adapter_dir}\n[save] config  -> {out/'train-config.json'}")


if __name__ == "__main__":
    main()
