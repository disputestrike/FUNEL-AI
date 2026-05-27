# syntax=docker/dockerfile:1.7
#
# funnel-web — Next.js 14 (standalone output).
# next.config.mjs must include `output: "standalone"` (added in this PR).

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter @funnel/web...

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @funnel/db db:generate
RUN pnpm --filter @funnel/web... build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Next standalone output bundles only the files needed at runtime.
COPY --from=build --chown=funnel:funnel /repo/apps/web/.next/standalone ./
COPY --from=build --chown=funnel:funnel /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=funnel:funnel /repo/apps/web/public ./apps/web/public
USER funnel
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
