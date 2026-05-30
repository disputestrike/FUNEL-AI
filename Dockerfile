# syntax=docker/dockerfile:1.7
#
# GoFunnelAI — single Next.js 14 app (standalone output).
# Built and deployed as ONE Railway service. No monorepo, no workspaces.

# -------- Stage 1: install ---------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ openssl \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate
RUN pnpm build
# pnpm stores packages in a content-addressable store under node_modules/.pnpm/.
# The runtime stage expects node_modules/.prisma and node_modules/@prisma at the
# top level. Materialise them as real directories so COPY --from=build works.
RUN mkdir -p node_modules/.prisma node_modules/@prisma && \
    cp -rL node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/* node_modules/.prisma/ 2>/dev/null || true && \
    cp -rL node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/* node_modules/@prisma/ 2>/dev/null || true

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget openssl \
 && addgroup -S -g 1001 funnel \
 && adduser -S -G funnel -u 1001 -h /home/funnel funnel
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Next standalone output bundles only the files needed at runtime.
COPY --from=build --chown=funnel:funnel /app/.next/standalone ./
COPY --from=build --chown=funnel:funnel /app/.next/static ./.next/static
COPY --from=build --chown=funnel:funnel /app/public ./public
COPY --from=build --chown=funnel:funnel /app/prisma ./prisma
COPY --from=build --chown=funnel:funnel /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=funnel:funnel /app/node_modules/@prisma ./node_modules/@prisma
USER funnel
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

