# syntax=docker/dockerfile:1.7
#
# funnel-renderer — Hono server. Same code as the Cloudflare Worker; the
# Node entrypoint (apps/renderer/dist/server.js) wraps the Hono app with
# @hono/node-server and listens on $PORT.

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/renderer ./apps/renderer
RUN pnpm install --frozen-lockfile --filter @funnel/renderer...

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /repo
RUN pnpm --filter @funnel/db db:generate
RUN pnpm --filter @funnel/renderer... build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    PORT=8787 \
    HEALTH_PORT=8787
WORKDIR /app
COPY --from=build --chown=funnel:funnel /repo/node_modules ./node_modules
COPY --from=build --chown=funnel:funnel /repo/packages ./packages
COPY --from=build --chown=funnel:funnel /repo/apps/renderer/dist ./apps/renderer/dist
COPY --from=build --chown=funnel:funnel /repo/apps/renderer/package.json ./apps/renderer/package.json
USER funnel
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/renderer/dist/server.js"]
