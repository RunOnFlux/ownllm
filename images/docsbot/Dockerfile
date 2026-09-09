# Grounded docs bot. The corpus is baked in: no volume, no vector database, so
# every instance is identical and a migration costs one re-index at boot.
FROM node:22-alpine
WORKDIR /app
COPY server.js /app/server.js
COPY docs /app/docs
ENV PORT=8080 DOCS_DIR=/app/docs
EXPOSE 8080
CMD ["node", "/app/server.js"]
