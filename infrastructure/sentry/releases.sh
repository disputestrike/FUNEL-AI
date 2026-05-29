#!/usr/bin/env bash
###############################################################################
# GoFunnelAI — Sentry release tracking integration.
#
# Used by:
#   - scripts/deploy.sh       (creates the release + uploads source maps)
#   - .github/workflows/deploy-production.yml (calls this after a green deploy)
#
# Required env:
#   SENTRY_AUTH_TOKEN     scoped: project:releases, project:write, org:read
#   SENTRY_ORG=funnel-ai
#   SENTRY_PROJECTS       space-separated list, defaults to all 5
#   GITHUB_SHA            (set by GH Actions, or passed in)
#   RELEASE_VERSION       (defaults to GITHUB_SHA short, or build epoch)
###############################################################################

set -euo pipefail

SENTRY_ORG="${SENTRY_ORG:-funnel-ai}"
SENTRY_PROJECTS="${SENTRY_PROJECTS:-funnel-web funnel-api funnel-grader funnel-renderer funnel-workers}"
RELEASE_VERSION="${RELEASE_VERSION:-${GITHUB_SHA:-$(date +%s)}}"
ENVIRONMENT="${ENVIRONMENT:-production}"

[[ -z "${SENTRY_AUTH_TOKEN:-}" ]] && { echo "SENTRY_AUTH_TOKEN not set" >&2; exit 1; }

command -v sentry-cli >/dev/null || npm i -g @sentry/cli

short="${RELEASE_VERSION:0:12}"
echo ">> Creating Sentry release $short for [$SENTRY_PROJECTS] env=$ENVIRONMENT"

for project in $SENTRY_PROJECTS; do
  sentry-cli releases \
    --org "$SENTRY_ORG" \
    --project "$project" \
    new "$RELEASE_VERSION"

  sentry-cli releases \
    --org "$SENTRY_ORG" \
    --project "$project" \
    set-commits "$RELEASE_VERSION" --auto

  # Upload source maps for the appropriate build directory.
  case "$project" in
    funnel-web|funnel-grader)
      app_dir=$(echo "$project" | sed 's/^funnel-//')
      if [[ -d "apps/$app_dir/.next" ]]; then
        sentry-cli sourcemaps \
          --org "$SENTRY_ORG" --project "$project" \
          upload --release "$RELEASE_VERSION" \
          --validate \
          --strip-prefix "$(pwd)" \
          "apps/$app_dir/.next/static" \
          "apps/$app_dir/.next/server"
      fi
      ;;
    funnel-api|funnel-renderer)
      app_dir=$(echo "$project" | sed 's/^funnel-//')
      if [[ -d "apps/$app_dir/dist" ]]; then
        sentry-cli sourcemaps \
          --org "$SENTRY_ORG" --project "$project" \
          upload --release "$RELEASE_VERSION" \
          --validate \
          "apps/$app_dir/dist"
      fi
      ;;
    funnel-workers)
      if [[ -d "apps/workers/dist" ]]; then
        sentry-cli sourcemaps \
          --org "$SENTRY_ORG" --project "$project" \
          upload --release "$RELEASE_VERSION" \
          --validate \
          "apps/workers/dist"
      fi
      ;;
  esac

  sentry-cli releases \
    --org "$SENTRY_ORG" --project "$project" \
    deploys "$RELEASE_VERSION" new -e "$ENVIRONMENT"

  sentry-cli releases \
    --org "$SENTRY_ORG" --project "$project" \
    finalize "$RELEASE_VERSION"
done

echo ">> Sentry release $short finalized."
