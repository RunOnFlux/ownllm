# Auth + readiness gate. Ollama has no authentication, so publishing its port
# straight to a node's public IP would hand free inference to anyone scanning.
FROM node:22-alpine
WORKDIR /app
COPY server.js /app/server.js
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.js"]
