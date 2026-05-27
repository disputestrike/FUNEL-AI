# syntax=docker/dockerfile:1.7
#
# funnel-admin — Next.js admin console (standalone output).

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN pnpm install --frozen-lockfile --filter @funnel/admin...

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @funnel/db db:generate
RUN pnpm --filter @funnel/admin... build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3010 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=funnel:funnel /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=funnel:funnel /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=funnel:funnel /repo/apps/admin/public ./apps/admin/public
USER funnel
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3010/api/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/admin/server.js"]
