# Hub: one OpenAI-compatible endpoint with API keys, routing each model to its
# own pool of Flux instances. No dependencies.
FROM node:22-alpine
WORKDIR /app
COPY server.js /app/server.js
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.js"]
