#!/usr/bin/env bash
###############################################################################
# GoFunnelAI — health check used by gradual rollouts + smoke verification.
#
# Modes:
#   --smoke-only --base-url <url>     One-shot HTTP smoke against public urls.
#   --window 5m --worker <name>       Poll Cloudflare + Sentry + Prometheus
#                                     for the given window; fail on breach.
#   --window 5m --baseline-error 0.005 --baseline-p95 800
#
# Breach conditions (matches spec 08 Â§B.3.1):
#   - error rate on v(N) > 0.5% absolute OR > 2x v(N-1)
#   - p95 latency > 2x baseline
#   - smoke synthetic fails 3 consecutive runs
###############################################################################

set -euo pipefail

# ----------------------------------------------------------------------------
# Convenience entrypoint: `scripts/health-check.sh production` (or staging)
# runs the Railway smoke battery against every public service. Falls through
# to the legacy flag-parsed mode for the gradual-rollout caller below.
# ----------------------------------------------------------------------------
if [[ $# -eq 1 && "$1" =~ ^(production|staging)$ ]]; then
  ENVIRON="$1"
  if [[ "$ENVIRON" == "staging" ]]; then
    BASE_API="https://api.staging.gofunnelai.com"
    BASE_WEB="https://staging.gofunnelai.com"
    BASE_ADMIN="https://admin.staging.gofunnelai.com"
    BASE_GRADER="https://grade.staging.gofunnelai.com"
    BASE_RENDERER="https://pages.staging.gofunnelai.com"
  else
    BASE_API="https://api.gofunnelai.com"
    BASE_WEB="https://gofunnelai.com"
    BASE_ADMIN="https://admin.gofunnelai.com"
    BASE_GRADER="https://grade.gofunnelai.com"
    BASE_RENDERER="https://pages.gofunnelai.com"
  fi
  FAIL=0
  hit() {
    local label="$1" url="$2"
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$url" || echo 000)"
    if [[ "$code" =~ ^2 ]]; then
      printf "\033[32m  OK\033[0m   %-22s %s -> %s\n" "$label" "$url" "$code"
    else
      printf "\033[31m  FAIL\033[0m %-22s %s -> %s\n" "$label" "$url" "$code"
      FAIL=$((FAIL+1))
    fi
  }
  echo "Railway smoke: $ENVIRON"
  hit "api/healthz"      "$BASE_API/healthz"
  hit "api/readyz"       "$BASE_API/readyz"
  hit "web/healthz"      "$BASE_WEB/api/healthz"
  hit "web/readyz"       "$BASE_WEB/api/readyz"
  hit "admin/healthz"    "$BASE_ADMIN/api/healthz"
  hit "admin/readyz"     "$BASE_ADMIN/api/readyz"
  hit "grader/healthz"   "$BASE_GRADER/api/healthz"
  hit "grader/readyz"    "$BASE_GRADER/api/readyz"
  hit "renderer/healthz" "$BASE_RENDERER/healthz"
  hit "renderer/readyz"  "$BASE_RENDERER/readyz"
  if [[ "$FAIL" -gt 0 ]]; then
    echo
    echo "  $FAIL endpoint(s) failed"
    exit 1
  fi
  echo
  echo "  all good"
  exit 0
fi

WINDOW=""
WORKER=""
BASE_URL=""
SMOKE_ONLY=0
BASELINE_ERROR="0.005"
BASELINE_P95="800"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --window) WINDOW="$2"; shift 2 ;;
    --worker) WORKER="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --smoke-only) SMOKE_ONLY=1; shift ;;
    --baseline-error) BASELINE_ERROR="$2"; shift 2 ;;
    --baseline-p95) BASELINE_P95="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

ok()   { printf "\033[32mâœ“ %s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }
die()  { printf "\033[31mâœ— %s\033[0m\n" "$1" >&2; exit 1; }

smoke_check() {
  local base="$1"
  local fail_count=0
  local urls=(
    "$base/healthz"
    "$base/_status/healthz"
  )
  for url in "${urls[@]}"; do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$url" || echo "000")"
    if [[ "$code" =~ ^2 ]]; then
      ok "GET $url -> $code"
    else
      warn "GET $url -> $code"
      fail_count=$((fail_count+1))
    fi
  done
  [[ "$fail_count" -gt 0 ]] && return 1
  return 0
}

if [[ "$SMOKE_ONLY" == 1 ]]; then
  [[ -z "$BASE_URL" ]] && die "--smoke-only requires --base-url"
  smoke_check "$BASE_URL" || die "smoke failed"
  exit 0
fi

[[ -z "$WINDOW" ]] && die "--window required (e.g. 5m)"
seconds=0
case "$WINDOW" in
  *m) seconds=$(( ${WINDOW%m} * 60 )) ;;
  *s) seconds=${WINDOW%s} ;;
  *)  die "unknown window: $WINDOW (expected Nm or Ns)" ;;
esac

# Query a Prometheus endpoint exposed by Grafana Cloud. We require these to
# be set in the deployment environment.
: "${PROMETHEUS_URL:?must be set in GH Actions secrets}"
: "${PROMETHEUS_USER:?must be set}"
: "${PROMETHEUS_PASSWORD:?must be set}"

query() {
  local q="$1"
  curl -fsS -u "$PROMETHEUS_USER:$PROMETHEUS_PASSWORD" \
    --get "$PROMETHEUS_URL/api/v1/query" \
    --data-urlencode "query=$q" \
    | jq -r '.data.result[0].value[1] // "0"'
}

start=$(date +%s)
deadline=$(( start + seconds ))
consecutive_smoke_fail=0

while [[ $(date +%s) -lt $deadline ]]; do
  # Error rate on the new version.
  err_v_n=$(query "sum(rate(funnel_http_requests_total{version=\"canary\",service=\"$WORKER\",status_class=\"5xx\"}[2m])) / clamp_min(sum(rate(funnel_http_requests_total{version=\"canary\",service=\"$WORKER\"}[2m])),1e-9)")
  err_v_prev=$(query "sum(rate(funnel_http_requests_total{version=\"previous\",service=\"$WORKER\",status_class=\"5xx\"}[2m])) / clamp_min(sum(rate(funnel_http_requests_total{version=\"previous\",service=\"$WORKER\"}[2m])),1e-9)")
  p95_v_n=$(query "histogram_quantile(0.95, sum by (le) (rate(funnel_http_request_duration_seconds_bucket{version=\"canary\",service=\"$WORKER\"}[2m]))) * 1000")
  p95_baseline_ms="$BASELINE_P95"

  printf "  err v(N)=%.4f err v(N-1)=%.4f p95 v(N)=%.0fms (baseline %sms)\n" \
    "$err_v_n" "$err_v_prev" "$p95_v_n" "$p95_baseline_ms"

  # Breach: absolute > 0.5%.
  if awk -v a="$err_v_n" -v b="$BASELINE_ERROR" 'BEGIN{exit !(a > b)}'; then
    die "error rate breached: ${err_v_n} > ${BASELINE_ERROR}"
  fi
  # Breach: > 2x previous.
  twox=$(awk -v p="$err_v_prev" 'BEGIN{printf "%.6f", p*2}')
  if awk -v a="$err_v_n" -v b="$twox" 'BEGIN{exit !(a > b && b > 0)}'; then
    die "error rate breached: ${err_v_n} > 2x previous (${err_v_prev})"
  fi
  # Breach: p95 > 2x baseline.
  twox_p95=$(awk -v p="$p95_baseline_ms" 'BEGIN{printf "%.0f", p*2}')
  if awk -v a="$p95_v_n" -v b="$twox_p95" 'BEGIN{exit !(a > b)}'; then
    die "p95 latency breached: ${p95_v_n}ms > ${twox_p95}ms"
  fi

  if smoke_check "https://app.gofunnelai.com" >/dev/null; then
    consecutive_smoke_fail=0
  else
    consecutive_smoke_fail=$((consecutive_smoke_fail+1))
    if [[ "$consecutive_smoke_fail" -ge 3 ]]; then
      die "synthetic smoke failed 3 consecutive runs"
    fi
  fi

  sleep 30
done

ok "Health check window $WINDOW passed for $WORKER"
