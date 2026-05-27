#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” one-command deploy.
#
# Usage:
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production            # gradual rollout (1->10->50->100)
#   ./scripts/deploy.sh production --hotfix   # compressed 1->100 over 10min
#   ./scripts/deploy.sh production --skip-rollout  # full deploy immediately
###############################################################################

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---- arg parsing ----
TARGET="${1:-}"
shift || true
HOTFIX=0
SKIP_ROLLOUT=0
SKIP_TESTS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hotfix) HOTFIX=1 ;;
    --skip-rollout) SKIP_ROLLOUT=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
  shift
done

[[ "$TARGET" != "staging" && "$TARGET" != "production" ]] && {
  echo "usage: $0 {staging|production} [--hotfix] [--skip-rollout] [--skip-tests]" >&2
  exit 64
}

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
ok()    { printf "\033[32mâœ“ %s\033[0m\n" "$1"; }
warn()  { printf "\033[33m! %s\033[0m\n" "$1"; }
die()   { printf "\033[31mâœ— %s\033[0m\n" "$1" >&2; exit 1; }

bold "Deploying to $TARGET (hotfix=$HOTFIX skip_rollout=$SKIP_ROLLOUT)"

# 1. Validate env vars
bold "[1/7] env-check"
./scripts/env-check.sh --env "$TARGET" || die "env-check failed"

# 2. Run pre-deploy tests (skipped on --skip-tests or hotfix per ops spec)
if [[ "$SKIP_TESTS" == 0 && "$HOTFIX" == 0 ]]; then
  bold "[2/7] tests"
  pnpm lint
  pnpm typecheck
  pnpm test:unit:ci
elif [[ "$HOTFIX" == 1 ]]; then
  bold "[2/7] hotfix mode â€” running unit + smoke only"
  pnpm test:unit:ci
  pnpm test:integration:mocked
else
  warn "[2/7] tests skipped (--skip-tests)"
fi

# 3. Build
bold "[3/7] build"
case "$TARGET" in
  staging)    export NEXT_PUBLIC_ENV=staging    NEXT_PUBLIC_API_BASE_URL=https://api.staging.gofunnelai.com ;;
  production) export NEXT_PUBLIC_ENV=production NEXT_PUBLIC_API_BASE_URL=https://api.gofunnelai.com ;;
esac
pnpm build

# 4. Migrations (forward-compatible only on prod)
bold "[4/7] migrations"
if [[ "$TARGET" == "production" ]]; then
  pnpm --filter @funnel/db db:migrate:deploy:safe
else
  pnpm --filter @funnel/db db:migrate:deploy
fi

# 5. Deploy Workers + Pages + Node workers
bold "[5/7] deploy workers + pages + node workers"

cf_env="$TARGET"
[[ "$TARGET" == "production" ]] && cf_env="production"

deploy_worker() {
  local app="$1"
  bold "  -> $app"
  (
    cd "apps/$app"
    pnpm exec wrangler deploy --env "$cf_env"
  )
}

deploy_pages() {
  local app="$1"
  local project="$2"
  bold "  -> $app (pages)"
  (
    cd "apps/$app"
    # next-on-pages emits .vercel/output/static
    if [[ ! -d ".vercel/output/static" ]]; then
      pnpm exec @cloudflare/next-on-pages
    fi
    local branch="main"
    [[ "$TARGET" == "staging" ]] && branch="staging"
    pnpm exec wrangler pages deploy .vercel/output/static \
      --project-name "$project" \
      --branch "$branch" \
      --commit-dirty=true
  )
}

if [[ "$SKIP_ROLLOUT" == 1 || "$TARGET" == "staging" ]]; then
  deploy_worker api
  deploy_worker renderer
else
  bold "  -> api  (gradual rollout)"
  ./scripts/_gradual-rollout.sh funnel-api    "$HOTFIX"
  bold "  -> renderer (gradual rollout)"
  ./scripts/_gradual-rollout.sh funnel-renderer "$HOTFIX"
fi

deploy_pages web   funnel-web
deploy_pages grader funnel-grader
deploy_pages admin funnel-admin

# Node workers on Fly
if command -v flyctl >/dev/null; then
  bold "  -> apps/workers (Fly)"
  app_name="funnel-workers"
  [[ "$TARGET" == "staging" ]] && app_name="funnel-workers-staging"
  flyctl deploy --app "$app_name" --config "apps/workers/fly.${TARGET}.toml" --remote-only
else
  warn "flyctl not installed â€” skipping apps/workers deploy. Install: https://fly.io/docs/hands-on/install-flyctl/"
fi

# 6. Smoke + health check
bold "[6/7] smoke test + health check"
base="https://app.staging.gofunnelai.com"
[[ "$TARGET" == "production" ]] && base="https://app.gofunnelai.com"
./scripts/health-check.sh --smoke-only --base-url "$base"

# 7. Tag Sentry release
bold "[7/7] sentry release tag"
export ENVIRONMENT="$TARGET"
export RELEASE_VERSION="$(git rev-parse HEAD)"
bash infrastructure/sentry/releases.sh

ok "Deploy to $TARGET complete: $RELEASE_VERSION"
