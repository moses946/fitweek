# FitWeek API — multi-stage build for Google Cloud Run (linux/amd64)
# Build: docker build --platform linux/amd64 -t fitweek-api .
# Run:   docker run -p 8080:8080 --env-file artifacts/api-server/.env fitweek-api

FROM node:24-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY lib/db/package.json lib/db/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/outfit-recommender/package.json lib/outfit-recommender/
COPY artifacts/api-server/package.json artifacts/api-server/

COPY lib/db lib/db
COPY lib/api-zod lib/api-zod
COPY lib/outfit-recommender lib/outfit-recommender
COPY artifacts/api-server artifacts/api-server

RUN pnpm approve-builds --all \
  && pnpm install --frozen-lockfile --filter @workspace/api-server...

ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build

RUN pnpm --filter @workspace/api-server --prod deploy --legacy /app/deploy

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Native image deps (sharp, onnxruntime-node) need glibc — bookworm-slim provides it
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/deploy/ ./

EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
