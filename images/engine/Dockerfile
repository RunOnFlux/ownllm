# Self-pulling Ollama image.
#
# Why a custom image at all: Flux sets only the container's Cmd, never its
# Entrypoint (dockerService.js createAppContainer). ollama/ollama's entrypoint
# is /bin/ollama, so a stock deployment can only ever run `ollama <args>` -
# there is no shell in which to pull a model first. Owning the entrypoint fixes
# that and lets the "boot" helper component be dropped from the spec.
FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/models \
    MODELS="gpt-oss:20b qwen3:4b"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
