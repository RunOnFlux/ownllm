# Round two of research/cpu-native-models.md: the same BitNet-b1.58-2B-4T
# weights converted to TQ2_0 and served by STOCK llama.cpp, plus the production
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
RUN mkdir -p /models/chat && python convert_hf_to_gguf.py /hf/bitnet --outtype tq2_0 \
      --outfile /models/chat/bitnet-2b-4t-tq2_0.gguf && rm -rf /hf && ls -la /models/chat
# The exact GGUF ollama serves as granite-embedding:278m (a blob is the GGUF).
RUN mkdir -p /models/embed && curl -fsSL -o /models/embed/granite-embedding-278m.gguf \
      https://registry.ollama.ai/v2/library/granite-embedding/blobs/sha256:a658c903bf83a9d84fe1b9869874229ddfdfc1c88b04f958f17dd24e243d262c \
  && ls -la /models/embed

# --- stage 2: stock llama-server + the shim
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 libcurl4 \
  && rm -rf /var/lib/apt/lists/*
# /app in the upstream image holds llama-server and its shared libraries.
COPY --from=ghcr.io/ggml-org/llama.cpp:server /app /opt/llama
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
