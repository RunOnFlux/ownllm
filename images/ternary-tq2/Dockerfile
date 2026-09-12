# Round two of research/cpu-native-models.md: the same BitNet-b1.58-2B-4T
# weights converted to TQ2_0 and served by upstream llama.cpp (one activation
# fix, see stage 2), plus the production
# granite embedder (ollama's exact blob). Two questions, one image:
#   1. Does the 2/9 grounding score belong to the model or to our I2_S kernel
#      build? Same weights, an independent ternary implementation.
#   2. Is the leaky embedding server the bitnet.cpp fork's? Here the fork is
#      gone entirely.
# The embedder is reported under its production name, so the docs bot loads
# its precomputed vectors and boots in a minute - no re-indexing on this rig.
#
# Build context is the repository root (see .github/workflows/gate.yml), so
# the shim is shared with images/ternary rather than copied.

# --- stage 1: convert bf16 master weights -> TQ2_0 with the stock converter
FROM python:3.11-bookworm AS convert
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git .
# CPU torch only - the converter needs it to read safetensors, nothing more.
RUN pip install --no-cache-dir -r requirements/requirements-convert_hf_to_gguf.txt "huggingface_hub[cli]"
RUN hf download microsoft/bitnet-b1.58-2B-4T-bf16 --local-dir /hf/bitnet
# The stock converter's bitnet tensor map was written for the 1bitLLM
# reproductions, which name the two sub-layer norms inner_attn_ln and
# ffn_layernorm; Microsoft's checkpoint calls them attn_sub_norm and
# ffn_sub_norm. Same tensors, so the map is extended rather than the weights
# renamed - the build fails loudly if upstream changes the lines.
RUN grep -q 'self_attn.inner_attn_ln' gguf-py/gguf/tensor_mapping.py \
  && sed -i 's|"model.layers.{bid}.self_attn.inner_attn_ln",  # bitnet|"model.layers.{bid}.self_attn.inner_attn_ln",  # bitnet\n            "model.layers.{bid}.self_attn.attn_sub_norm",  # bitnet-b1.58-2B-4T|' gguf-py/gguf/tensor_mapping.py \
  && sed -i 's|"model.layers.{bid}.mlp.ffn_layernorm",  # bitnet|"model.layers.{bid}.mlp.ffn_layernorm",  # bitnet\n            "model.layers.{bid}.mlp.ffn_sub_norm",  # bitnet-b1.58-2B-4T|' gguf-py/gguf/tensor_mapping.py \
  && grep -c "sub_norm" gguf-py/gguf/tensor_mapping.py
# Same vintage problem in the converter's vocab step: it assumes a
# sentencepiece tokenizer.model (the reproductions'); 2B-4T ships a Llama-3
# style BPE tokenizer.json, which the gpt2-style loader reads. The
# pre-tokenizer is Llama-3's, whose hash the converter knows as "llama-bpe";
# should upstream not recognise it, the fallback pins that name.
RUN grep -q '_set_vocab_sentencepiece()' conversion/bitnet.py \
  && sed -i 's/self._set_vocab_sentencepiece()/self._set_vocab_gpt2()/' conversion/bitnet.py \
  && grep -n '_set_vocab_gpt2' conversion/bitnet.py
RUN mkdir -p /models/chat && python convert_hf_to_gguf.py /hf/bitnet --outtype tq2_0 \
      --outfile /models/chat/bitnet-2b-4t-tq2_0.gguf && rm -rf /hf && ls -la /models/chat
# The exact GGUF ollama serves as granite-embedding:278m (a blob is the GGUF).
RUN mkdir -p /models/embed && curl -fsSL -o /models/embed/granite-embedding-278m.gguf \
      https://registry.ollama.ai/v2/library/granite-embedding/blobs/sha256:a658c903bf83a9d84fe1b9869874229ddfdfc1c88b04f958f17dd24e243d262c \
  && ls -la /models/embed

# --- stage 2: upstream llama-server with a one-line graph fix
# Upstream's bitnet graph (src/models/bitnet.cpp) hardcodes SiLU in the FFN,
# which is what the 2024 1bitLLM reproductions used. Microsoft's 2B-4T uses
# squared ReLU (config.json: hidden_act = relu2). Served unpatched, TQ2_0
# would produce garbage for a reason that has nothing to do with the ternary
# kernel - exactly the confound this image exists to remove - so the
# activation is switched to LLM_FFN_RELU_SQR and llama-server built from
# source. GGML_NATIVE=OFF pins AVX2 so a CI build cannot SIGILL on a node.
FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git cmake build-essential libcurl4-openssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git .
RUN grep -q 'LLM_FFN_SILU, LLM_FFN_PAR' src/models/bitnet.cpp \
  && sed -i 's/LLM_FFN_SILU, LLM_FFN_PAR/LLM_FFN_RELU_SQR, LLM_FFN_PAR/' src/models/bitnet.cpp \
  && grep -n 'LLM_FFN_RELU_SQR' src/models/bitnet.cpp
RUN cmake -B build -DGGML_NATIVE=OFF -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
      -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_CURL=ON \
  && cmake --build build --config Release --target llama-server -j "$(nproc)" \
  && mkdir -p /opt/llama && cp build/bin/llama-server /opt/llama/ && find build -name '*.so*' -exec cp -P {} /opt/llama/ \; \
  && ls -la /opt/llama

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 libcurl4 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/llama /opt/llama
COPY --from=convert /models /models
COPY images/ternary/shim.js /opt/llama/shim.js
ENV PORT=11434 THREADS=8 CTX=4096 BIN=/opt/llama LD_LIBRARY_PATH=/opt/llama \
    CHAT_GGUF=/models/chat/bitnet-2b-4t-tq2_0.gguf \
    EMBED_GGUF=/models/embed/granite-embedding-278m.gguf \
    CHAT_NAME=bitnet-2b-4t-tq2 CHAT_QUANT=TQ2_0 \
    EMBED_NAME=granite-embedding:278m EMBED_FAMILY=xlm-roberta EMBED_QUANT=F16 EMBED_PARAMS=278M EMBED_SIZE=563000000 \
    EMBED_POOLING=none
EXPOSE 11434
ENTRYPOINT ["node", "/opt/llama/shim.js"]
