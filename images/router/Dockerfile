# Load-aware router. FDM balances round-robin and pins browsers to one instance
# for eight hours, which is wrong when instances differ by 6x in speed.
FROM node:22-alpine
WORKDIR /app
COPY server.js /app/server.js
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.js"]
