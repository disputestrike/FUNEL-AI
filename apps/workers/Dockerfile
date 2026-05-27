# syntax=docker/dockerfile:1.7
#
# funnel-workers — long-running BullMQ workers (Node 20).

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/workers ./apps/workers
RUN pnpm install --frozen-lockfile --filter @funnel/workers...

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /repo
RUN pnpm --filter @funnel/db db:generate
RUN pnpm --filter @funnel/workers... build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    HEALTH_PORT=8080
WORKDIR /app
COPY --from=build --chown=funnel:funnel /repo/node_modules ./node_modules
COPY --from=build --chown=funnel:funnel /repo/packages ./packages
COPY --from=build --chown=funnel:funnel /repo/apps/workers/dist ./apps/workers/dist
COPY --from=build --chown=funnel:funnel /repo/apps/workers/package.json ./apps/workers/package.json
USER funnel
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/workers/dist/index.js"]
