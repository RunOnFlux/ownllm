# Grounded docs bot. The corpus is baked in: no volume, no vector database, so
# every instance is identical and a migration costs one re-index at boot.
FROM node:22-alpine
WORKDIR /app
COPY server.js /app/server.js
COPY docs /app/docs
ENV PORT=8080 DOCS_DIR=/app/docs
EXPOSE 8080
# Tell V8 the ceiling. Without it Node sizes its heap from the host's memory,
# not the cgroup limit, so it grows past the container's allowance and is
# killed rather than collecting garbage.
CMD ["node", "--max-old-space-size=2048", "/app/server.js"]
