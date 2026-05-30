# syntax=docker/dockerfile:1.7
#
# funnel-grader — Next.js (standalone) + grader worker that emulates the
# Cloudflare Worker grader path via node-runtime. Single container; the
# worker code runs inside Next's API routes.

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/grader ./apps/grader
RUN pnpm install --frozen-lockfile --filter @funnel/grader...

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @funnel/db db:generate
RUN pnpm --filter @funnel/grader... build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=funnel:funnel /repo/apps/grader/.next/standalone ./
COPY --from=build --chown=funnel:funnel /repo/apps/grader/.next/static ./apps/grader/.next/static
COPY --from=build --chown=funnel:funnel /repo/apps/grader/public ./apps/grader/public
USER funnel
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/grader/server.js"]
