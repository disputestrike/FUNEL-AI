#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” instant rollback.
#
# Usage:
#   ./scripts/rollback.sh                    # rollback prod to previous
#   ./scripts/rollback.sh --target staging   # rollback staging
#   ./scripts/rollback.sh --to <version-id>  # rollback to specific version
#
# Per spec Â§B.3.4 the target end-to-end SLA is 60 seconds from invocation to
# 100% traffic on the previous version.
###############################################################################

set -euo pipefail

# ----------------------------------------------------------------------------
# Railway convenience entrypoint:
#   scripts/rollback.sh production         # rolls every Railway svc back one
#   scripts/rollback.sh staging
# Falls through to the legacy Cloudflare + Fly flag-parsed mode otherwise.
# ----------------------------------------------------------------------------
if [[ $# -eq 1 && "$1" =~ ^(production|staging)$ ]] && command -v railway >/dev/null 2>&1; then
  ENVIRON="$1"
  SERVICES=(funnel-api funnel-workers funnel-web funnel-admin funnel-grader funnel-renderer)
  for svc in "${SERVICES[@]}"; do
    prev="$(railway deployments list --service "$svc" --json 2>/dev/null \
      | jq -r '[.[] | select(.status=="SUCCESS")] | .[1].id' 2>/dev/null || echo "")"
    if [[ -n "$prev" && "$prev" != "null" ]]; then
      echo "rolling back $svc â†’ $prev"
      railway redeploy --deployment "$prev" --service "$svc" --environment "$ENVIRON" \
        || echo "  WARN: rollback of $svc failed; investigate manually"
    else
      echo "  WARN: no previous successful deployment found for $svc"
    fi
  done
  exit 0
fi

TARGET="production"
TO_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --to)     TO_VERSION="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

: "${CLOUDFLARE_API_TOKEN:?must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?must be set}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32mâœ“ %s\033[0m\n" "$1"; }

declare -a WORKERS=()
case "$TARGET" in
  production) WORKERS=(funnel-api funnel-renderer) ;;
  staging)    WORKERS=(funnel-api-staging funnel-renderer-staging) ;;
  *) echo "unknown target $TARGET" >&2; exit 64 ;;
esac

rollback_worker() {
  local w="$1"
  bold "  -> $w"
  local target="${TO_VERSION:-previous}"
  curl -fsS -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$w/deployments" \
    -d "{\"versions\":[{\"percentage\":100,\"version_id\":\"$target\"}],\"annotations\":{\"workers/triggered_by\":\"scripts/rollback.sh\",\"reason\":\"manual rollback\"}}" \
    >/dev/null
}

bold "Rolling back $TARGET..."
for w in "${WORKERS[@]}"; do
  rollback_worker "$w"
done

# Pages: redeploy previous deployment.
bold "Rolling back Pages projects..."
for project in funnel-web funnel-grader funnel-admin; do
  # Find previous successful production deployment.
  prev_id="$(curl -fsS \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$project/deployments?per_page=20&env=production" \
    | jq -r '.result[] | select(.latest_stage.name=="deploy" and .latest_stage.status=="success") | .id' \
    | sed -n '2p')"
  if [[ -n "$prev_id" ]]; then
    curl -fsS -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$project/deployments/$prev_id/rollback" \
      >/dev/null
    ok "$project rolled back to $prev_id"
  fi
done

# Fly: workers redeploy the previous image.
if command -v flyctl >/dev/null; then
  bold "Rolling back apps/workers (Fly)..."
  app_name="funnel-workers"
  [[ "$TARGET" == "staging" ]] && app_name="funnel-workers-staging"
  prev_release=$(flyctl releases list --app "$app_name" --json | jq -r '.[] | select(.Status=="succeeded") | .Version' | sed -n '2p')
  if [[ -n "$prev_release" ]]; then
    flyctl releases rollback --app "$app_name" "$prev_release"
  fi
fi

ok "Rollback complete."

# File incident + post to #ops.
curl -fsS -X POST "${SLACK_OPS_WEBHOOK:-}" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \":rewind: Manual rollback of $TARGET executed by $USER at $(date -u +%FT%TZ)\"}" \
  || true

curl -fsS -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d "{
    \"routing_key\": \"${PAGERDUTY_ROUTING_KEY_PLATFORM:-}\",
    \"event_action\": \"trigger\",
    \"payload\": {
      \"summary\": \"Manual rollback of $TARGET\",
      \"severity\": \"warning\",
      \"source\": \"scripts/rollback.sh\"
    }
  }" \
  || true
