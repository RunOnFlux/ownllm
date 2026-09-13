# Load-aware router. FDM balances round-robin and pins browsers to one instance
# for eight hours, which is wrong when instances differ by 6x in speed.
# Build context is the repository root so the widget ships inside the router
# and a site needs one script tag pointing here, no CDN.
FROM node:22-alpine
WORKDIR /app
COPY images/router/server.js /app/server.js
COPY widget/ownllm-widget.js /app/widget.js
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.js"]
