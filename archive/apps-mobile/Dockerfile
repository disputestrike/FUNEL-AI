# --------------------------------------------------------------------
# GoFunnelAI mobile — CI build image.
#
# This image is used for CI lint / typecheck / unit tests only. The actual
# iOS and Android binary builds happen on EAS (eas.json) because they need
# Xcode / Gradle and signing keys that we don't manage on Railway.
#
# To build locally:
#   docker build -t funnelai-mobile-ci -f apps/mobile/Dockerfile .
#   docker run --rm funnelai-mobile-ci pnpm --filter @funnel/mobile typecheck
# --------------------------------------------------------------------
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /workspace

# Copy lockfiles + workspace metadata first for cached install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages packages
COPY tools tools

RUN pnpm install --frozen-lockfile --filter @funnel/mobile...

# Now the source.
COPY apps/mobile apps/mobile

WORKDIR /workspace/apps/mobile
RUN pnpm typecheck && pnpm test --watchAll=false

CMD ["pnpm", "test"]
