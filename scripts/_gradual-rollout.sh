#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” Cloudflare Worker gradual rollout helper.
#
# Implements the 1% -> 10% -> 50% -> 100% rollout from spec 08 Â§B.3.1.
# Hotfix mode compresses to 1% -> 100% over 10min.
#
# Usage:
#   ./scripts/_gradual-rollout.sh <worker-script-name> [hotfix=0|1]
###############################################################################
set -euo pipefail

WORKER="${1:-}"
HOTFIX="${2:-0}"
[[ -z "$WORKER" ]] && { echo "usage: $0 <worker> [hotfix]" >&2; exit 64; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

: "${CLOUDFLARE_API_TOKEN:?must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?must be set}"

# Detect the app directory.
case "$WORKER" in
  funnel-api)      app=api ;;
  funnel-renderer) app=renderer ;;
  *) echo "unknown worker: $WORKER" >&2; exit 64 ;;
esac

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

bold "Uploading new version of $WORKER..."
canary_id="$(cd "apps/$app" && pnpm exec wrangler versions upload --env production --tag "deploy-$(date +%s)" 2>&1 | grep -oE 'Version ID:.*' | awk '{print $NF}' | tail -n1)"
[[ -z "$canary_id" ]] && { echo "could not parse version id" >&2; exit 1; }
echo "  new version: $canary_id"

route_percentage() {
  local pct="$1"
  local rest=$((100 - pct))
  curl -fsS -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$WORKER/deployments" \
    -d "{\"versions\":[{\"percentage\":$rest,\"version_id\":\"previous\"},{\"percentage\":$pct,\"version_id\":\"$canary_id\"}],\"annotations\":{\"workers/triggered_by\":\"scripts/_gradual-rollout.sh\"}}" \
    >/dev/null
}

observe_window() {
  local minutes="$1"
  bold "Observing for ${minutes}min..."
  if ! ./scripts/health-check.sh --window "${minutes}m" --worker "$WORKER"; then
    bold "ROLLBACK â€” health check failed at $pct%"
    curl -fsS -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$WORKER/deployments" \
      -d '{"versions":[{"percentage":100,"version_id":"previous"}],"annotations":{"workers/triggered_by":"scripts/_gradual-rollout.sh rollback"}}' \
      >/dev/null
    exit 1
  fi
}

if [[ "$HOTFIX" == "1" ]]; then
  # 1% -> 100% over 10 min
  bold "[hotfix] 1%"; route_percentage 1
  observe_window 3
  bold "[hotfix] 50%"; route_percentage 50
  observe_window 3
  bold "[hotfix] 100%"; route_percentage 100
  observe_window 4
else
  # 1 -> 10 -> 50 -> 100 over 30 min
  bold "stage 1%"; route_percentage 1
  observe_window 5
  bold "stage 10%"; route_percentage 10
  observe_window 5
  bold "stage 50%"; route_percentage 50
  observe_window 10
  bold "stage 100%"; route_percentage 100
  observe_window 10
fi

bold "Rollout of $WORKER complete ($canary_id)"
