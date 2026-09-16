#!/usr/bin/env python3
"""Put an mlx-lm fused granite hybrid MoE checkpoint back into HF layout.

mlx-lm's `sanitize()` splits HF's `block_sparse_moe.input_linear.weight`
(experts x 2*ffn x hidden) into `switch_mlp.gate_proj` / `up_proj` and renames
`output_linear` to `switch_mlp.down_proj`, and moves the conv1d kernel axis.
`mlx_lm.fuse` saves in that layout, which llama.cpp's converter does not know
("Can not map tensor ... switch_mlp.down_proj.weight"). This inverts it and
writes a directory the converter accepts, with the original HF config and
tokenizer files.

  finetune/.venv-hf/bin/python finetune/mlx_to_hf.py runs/tinyh-mac-v1/merged runs/tinyh-mac-v1/merged-hf \
      --hf-snapshot ~/.cache/huggingface/hub/models--ibm-granite--granite-4.0-h-tiny/snapshots/<hash>
"""
import argparse, glob, json, os, shutil, sys
import torch
from safetensors import safe_open
from safetensors.torch import save_file

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--hf-snapshot', default=None, help='original HF model dir for config/tokenizer (default: newest cached granite-4.0-h-tiny)')
a = ap.parse_args()
snap = a.hf_snapshot or sorted(glob.glob(os.path.expanduser('~/.cache/huggingface/hub/models--ibm-granite--granite-4.0-h-tiny/snapshots/*')), key=os.path.getmtime)[-1]
os.makedirs(a.dst, exist_ok=True)

weights = {}
for f in sorted(glob.glob(os.path.join(a.src, '*.safetensors'))):
    with safe_open(f, framework='pt') as s:
        for k in s.keys():
            weights[k] = s.get_tensor(k)
print(f'loaded {len(weights)} tensors from {a.src}')

out = {}
layers = sorted({int(k.split('.')[2]) for k in weights if k.startswith('model.layers.')})
for k, v in list(weights.items()):
    if '.block_sparse_moe.switch_mlp.' in k:
        continue  # handled per layer below
    if 'conv1d.weight' in k and v.ndim == 3 and v.shape[-1] == 1:
        v = v.movedim(2, 1).contiguous()  # (out, k, 1) -> (out, 1, k)
    out[k] = v
for l in layers:
    p = f'model.layers.{l}.block_sparse_moe'
    g, u, d = (weights.get(f'{p}.switch_mlp.{n}.weight') for n in ('gate_proj', 'up_proj', 'down_proj'))
    if g is None:
        continue
    out[f'{p}.input_linear.weight'] = torch.cat([g, u], dim=1).contiguous()   # (E, 2*ffn, hidden)
    out[f'{p}.output_linear.weight'] = d.contiguous()                        # (E, hidden, ffn)
print(f'writing {len(out)} tensors; sample shapes: input_linear {tuple(out[f"model.layers.{layers[0]}.block_sparse_moe.input_linear.weight"].shape)}, conv1d {tuple(out[f"model.layers.{layers[0]}.mamba.conv1d.weight"].shape)}')

# shard at ~5 GB so nothing is unwieldy
shards, cur, size = [], {}, 0
for k in sorted(out):
    n = out[k].numel() * out[k].element_size()
    if cur and size + n > 5 * 1024 ** 3:
        shards.append(cur); cur, size = {}, 0
    cur[k] = out[k]; size += n
shards.append(cur)
index = {'metadata': {'total_size': sum(t.numel() * t.element_size() for t in out.values())}, 'weight_map': {}}
for i, sh in enumerate(shards, 1):
    name = f'model-{i:05d}-of-{len(shards):05d}.safetensors'
    save_file(sh, os.path.join(a.dst, name), metadata={'format': 'pt'})
    for k in sh: index['weight_map'][k] = name
    print(f'  {name}: {len(sh)} tensors')
json.dump(index, open(os.path.join(a.dst, 'model.safetensors.index.json'), 'w'), indent=1)
for f in ('config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'added_tokens.json', 'chat_template.jinja', 'merges.txt', 'vocab.json'):
    src = os.path.join(snap, f)
    if os.path.exists(src): shutil.copy(src, os.path.join(a.dst, f))
print(f'HF-layout model in {a.dst} (config/tokenizer from {snap})')
