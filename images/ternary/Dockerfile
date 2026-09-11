# Ternary (1.58-bit) inference engine for the CPU-native model research
# project - see research/cpu-native-models.md.
#
# Runs microsoft/bitnet.cpp's llama-server with the official BitNet-b1.58-2B-4T
# and bitnet-embedding-270m weights in I2_S format, behind a small shim that
# speaks ollama's /api/generate and /api/embed. The shim is what lets the gate,
# the docs bot, bench-models.js and eval-quality.js run against this engine
# with no changes: the whole point is to measure ternary against granite4 on
# the same harness, on the same Flux nodes.
#
# Both models are MIT licensed and baked in, so an instance has nothing to pull
# and a migration costs nothing but the image download (~1.7 GB, under the
# 5 GB limit). x86-64 only: bitnet.cpp's I2_S kernel is a different code path
# on ARM, and every Flux node this is meant for is x86.

FROM python:3.11-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends cmake clang git \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir "huggingface_hub[cli]"
WORKDIR /src
RUN git clone --recursive --depth 1 https://github.com/microsoft/BitNet.git .
# The pre-converted I2_S GGUFs, so no torch, no converter, no 2 GB of pip.
RUN hf download microsoft/bitnet-b1.58-2B-4T-gguf ggml-model-i2_s.gguf --local-dir /models/chat \
  && hf download microsoft/bitnet-embedding-270m bitnet-embeddings-270m-bf16-i2_s.gguf --local-dir /models/embed
# Mirrors setup_env.py compile() for x86_64 (-DBITNET_X86_TL2=OFF, clang),
# with two deliberate differences. GGML_NATIVE=OFF pins the ISA to AVX2/FMA
# rather than whatever the CI runner has - a build that uses AVX-512 dies with
# SIGILL on the nodes that lack it. GGML_OPENMP=OFF drops the libomp runtime
# dependency; ggml's own thread pool is used instead.
RUN cmake -B build -DBITNET_X86_TL2=OFF \
      -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++ \
      -DGGML_NATIVE=OFF -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_OPENMP=OFF \
      -DLLAMA_BUILD_TOOLS=ON -DLLAMA_BUILD_EXAMPLES=ON -DLLAMA_BUILD_COMMON=ON -DLLAMA_BUILD_SERVER=ON \
  && cmake --build build --config Release --target llama-server -j "$(nproc)" \
  && ls -la build/bin

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/bin /opt/bitnet/bin
COPY --from=build /models /models
COPY shim.js entrypoint.sh /opt/bitnet/
ENV PORT=11434 THREADS=8 CTX=4096 \
    CHAT_GGUF=/models/chat/ggml-model-i2_s.gguf \
    EMBED_GGUF=/models/embed/bitnet-embeddings-270m-bf16-i2_s.gguf
EXPOSE 11434
# Flux only sets Cmd, never Entrypoint, so the process supervisor is the
# entrypoint and the spec's commands stay empty.
ENTRYPOINT ["/bin/sh", "/opt/bitnet/entrypoint.sh"]
