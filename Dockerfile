# Chacarero: one Bun process serving the built client and the room server.
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Runtime: only production dependencies (the server itself just needs zod).
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9902
ENV STATIC_DIR=/app/dist
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src/game ./src/game
COPY src/net ./src/net
EXPOSE 9902
CMD ["bun", "run", "server/index.ts"]
