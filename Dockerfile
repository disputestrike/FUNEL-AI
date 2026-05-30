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
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# -------- Stage 2: build -----------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client. pnpm writes it into the .pnpm content-addressable
# store at .pnpm/@prisma+client@*/node_modules/.prisma — not at the top level.
# Materialize a real top-level node_modules/.prisma so the runtime stage can
# COPY a deterministic path. Fail LOUDLY if the source isn't where we expect.
RUN pnpm prisma generate \
 && PRISMA_GEN_DIR="$(find /app/node_modules/.pnpm -maxdepth 4 -type d -path '*@prisma+client@*/node_modules/.prisma' | head -n1)" \
 && test -n "$PRISMA_GEN_DIR" || (echo "ERROR: generated .prisma not found in .pnpm store" && exit 1) \
 && rm -rf /app/node_modules/.prisma \
 && cp -RL "$PRISMA_GEN_DIR" /app/node_modules/.prisma \
 && PRISMA_NS_DIR="$(find /app/node_modules/.pnpm -maxdepth 4 -type d -path '*@prisma+client@*/node_modules/@prisma' | head -n1)" \
 && test -n "$PRISMA_NS_DIR" || (echo "ERROR: @prisma namespace not found in .pnpm store" && exit 1) \
 && rm -rf /app/node_modules/@prisma \
 && cp -RL "$PRISMA_NS_DIR" /app/node_modules/@prisma \
 && echo "Hoisted .prisma + @prisma to top-level node_modules" \
 && ls /app/node_modules/.prisma /app/node_modules/@prisma | head -20

RUN pnpm build

# -------- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini wget openssl \
 && npm install -g prisma@5.22.0 \
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
# Prisma client + namespace — public-hoisted via .npmrc so these are real
# directories at top-level node_modules, not pnpm symlinks.
COPY --from=build --chown=funnel:funnel /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=funnel:funnel /app/node_modules/@prisma ./node_modules/@prisma
USER funnel
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
