# Chacarero room server. The client lives on GitHub Pages, so the image only
# carries the server, the engine it runs and zod: no Vite build, which keeps
# the build light enough for the droplet itself (see deploy/README.md).
FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9902
RUN echo '{"name":"chacarero-server","private":true,"type":"module","dependencies":{"zod":"3.25.76"}}' > package.json \
  && bun install
COPY src/game ./src/game
COPY src/net ./src/net
COPY server ./server
EXPOSE 9902
CMD ["bun", "run", "server/index.ts"]
