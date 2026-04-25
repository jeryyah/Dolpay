# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1 — builder: install deps, build the Vite frontend and the API server
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

# Required so corepack can write to /root/.cache
ENV CI=1 \
    SKIP_BUNDLE=1 \
    NODE_ENV=production

# Enable pnpm via corepack (matches "packageManager" in package.json)
RUN corepack enable

WORKDIR /app

# 1) Install deps with maximum cache hits.
#    Copy only the manifests + lockfile first so Docker can cache the install
#    layer when sources change but deps don't.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Workspace package manifests
COPY scripts/package.json ./scripts/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY artifacts/viorelvar-market/package.json ./artifacts/viorelvar-market/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/

# Some lockfiles reference more lib packages — copy them all if they exist.
# (The trailing wildcard is harmless if the dirs aren't there.)
COPY lib/ ./lib/

RUN pnpm install --frozen-lockfile --prefer-offline

# 2) Copy the rest of the source tree
COPY . .

# 3) Build the viorelvar-market frontend (Vite static bundle)
#    BASE_PATH=/ — Railway serves at the domain root.
#    PORT — required by vite.config.ts even though it's unused at build time.
RUN BASE_PATH=/ PORT=3000 NODE_ENV=production SKIP_BUNDLE=1 \
    pnpm --filter @workspace/viorelvar-market run build

# 4) Build the API server bundle
RUN pnpm --filter @workspace/api-server run build

# 5) Prune dev dependencies to slim the runtime image
RUN pnpm --filter @workspace/api-server --prod deploy /out/api-server


# ---------------------------------------------------------------------------
# Stage 2 — runner: small image with only the artifacts we need
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public

WORKDIR /app

# Built API bundle + its production node_modules
COPY --from=builder /out/api-server/dist ./dist
COPY --from=builder /out/api-server/node_modules ./node_modules
COPY --from=builder /out/api-server/package.json ./package.json

# Built static frontend
COPY --from=builder /app/artifacts/viorelvar-market/dist/public ./public

# Persistent data directory (mount a Railway Volume here for chat/sync persistence)
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080

# Built file lives at dist/index.mjs (see artifacts/api-server/build.mjs)
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
