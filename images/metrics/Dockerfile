# Conversation metrics for the Flux AI assistant: one record per turn from the
# hub, thumbs up/down from the web app, SQLite on the app's g: volume.
# Node 24 for the built-in node:sqlite. No dependencies.
FROM node:24-alpine
WORKDIR /app
COPY server.js /app/server.js
ENV PORT=8080 DB_PATH=/data/metrics.db
EXPOSE 8080
CMD ["node", "/app/server.js"]
