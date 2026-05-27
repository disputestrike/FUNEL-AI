#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” verify required env vars + connectivity to providers.
#
# Usage:
#   ./scripts/env-check.sh                    # local
#   ./scripts/env-check.sh --env staging
#   ./scripts/env-check.sh --env production
###############################################################################

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_NAME="local"
[[ "${1:-}" == "--env" ]] && { ENV_NAME="$2"; shift 2; }

# Load .env (or .env.$ENV_NAME if present).
ENV_FILE=".env"
[[ -f ".env.$ENV_NAME" ]] && ENV_FILE=".env.$ENV_NAME"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m  âœ“ %s\033[0m\n" "$1"; }
warn() { printf "\033[33m  ! %s\033[0m\n" "$1"; }
err()  { printf "\033[31m  âœ— %s\033[0m\n" "$1"; }

failures=0

require() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    err "$key is missing"
    failures=$((failures+1))
  else
    ok "$key"
  fi
}

prefer() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    warn "$key not set (optional in $ENV_NAME)"
  else
    ok "$key"
  fi
}

ping_provider() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    ok "$label reachable"
  else
    err "$label NOT reachable"
    failures=$((failures+1))
  fi
}

bold "Required for any env:"
require NODE_ENV
require DATABASE_URL
require REDIS_URL
require JWT_SECRET
require ENCRYPTION_KEY
require INTERNAL_INGEST_SECRET
require ANTHROPIC_API_KEY
require OPENAI_API_KEY

if [[ "$ENV_NAME" != "local" ]]; then
  bold "Required for $ENV_NAME (cloud):"
  require CLOUDFLARE_API_TOKEN
  require CLOUDFLARE_ACCOUNT_ID
  require CLOUDFLARE_ZONE_ID
  require SENTRY_DSN
  require SENTRY_AUTH_TOKEN
  require RESEND_API_KEY
  require SIGNALWIRE_PROJECT_ID
  require SIGNALWIRE_TOKEN
  require SIGNALWIRE_FROM_NUMBER
  require STRIPE_SECRET_KEY
  require STRIPE_WEBHOOK_SECRET
  require PAYPAL_CLIENT_ID
  require PAYPAL_CLIENT_SECRET
  require PAYPAL_WEBHOOK_ID
  require REVTRY_API_KEY
  require UPSTASH_REDIS_REST_URL
  require UPSTASH_REDIS_REST_TOKEN
  require LAUNCHDARKLY_SDK_KEY
  require HONEYCOMB_API_KEY
  require DATADOG_API_KEY
fi

bold "Required for production:"
if [[ "$ENV_NAME" == "production" ]]; then
  require META_APP_ID
  require META_APP_SECRET
  require GOOGLE_CLIENT_ID
  require GOOGLE_CLIENT_SECRET
  require TIKTOK_APP_ID
  require TIKTOK_APP_SECRET
  require LINKEDIN_CLIENT_ID
  require LINKEDIN_CLIENT_SECRET
  require REPLICATE_API_TOKEN
  require RUNWAY_API_KEY
  require ELEVENLABS_API_KEY
  require CLEARBIT_API_KEY
  require WHOISXML_API_KEY
  require TURNSTILE_SECRET_KEY
  require PAGERDUTY_ROUTING_KEY_PLATFORM
  require PAGERDUTY_ROUTING_KEY_BILLING
  require PAGERDUTY_ROUTING_KEY_SECURITY
  require PAGERDUTY_ROUTING_KEY_VOICE
  require SLACK_OPS_WEBHOOK
fi

bold "Optional / nice-to-have:"
prefer FLY_API_TOKEN
prefer SNYK_TOKEN
prefer CODECOV_TOKEN
prefer TURBO_TOKEN
prefer LHCI_GITHUB_APP_TOKEN

bold "Connectivity:"

# Postgres
if [[ -n "${DATABASE_URL:-}" ]]; then
  ping_provider "Postgres" "psql \"$DATABASE_URL\" -c 'SELECT 1'"
fi
# Redis (Upstash REST)
if [[ -n "${UPSTASH_REDIS_REST_URL:-}" && -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]]; then
  ping_provider "Upstash Redis" "curl -fsS -H 'Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN' '$UPSTASH_REDIS_REST_URL/ping'"
elif [[ -n "${REDIS_URL:-}" ]]; then
  ping_provider "Redis" "redis-cli -u \"$REDIS_URL\" PING"
fi
# Anthropic
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ping_provider "Anthropic" "curl -fsS -H 'x-api-key: $ANTHROPIC_API_KEY' -H 'anthropic-version: 2023-06-01' 'https://api.anthropic.com/v1/messages' -X POST -d '{\"model\":\"claude-haiku-4-5\",\"max_tokens\":1,\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}'"
fi
# OpenAI
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  ping_provider "OpenAI" "curl -fsS -H 'Authorization: Bearer $OPENAI_API_KEY' 'https://api.openai.com/v1/models?limit=1'"
fi
# Resend
if [[ -n "${RESEND_API_KEY:-}" ]]; then
  ping_provider "Resend" "curl -fsS -H 'Authorization: Bearer $RESEND_API_KEY' 'https://api.resend.com/domains'"
fi
# Stripe
if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
  ping_provider "Stripe" "curl -fsS -u '$STRIPE_SECRET_KEY:' 'https://api.stripe.com/v1/customers?limit=1'"
fi
# PayPal
if [[ -n "${PAYPAL_CLIENT_ID:-}" && -n "${PAYPAL_CLIENT_SECRET:-}" ]]; then
  ping_provider "PayPal" "curl -fsS -u '$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET' 'https://api-m.paypal.com/v1/oauth2/token' -d 'grant_type=client_credentials'"
fi
# SignalWire (REST)
if [[ -n "${SIGNALWIRE_PROJECT_ID:-}" && -n "${SIGNALWIRE_TOKEN:-}" && -n "${SIGNALWIRE_SPACE_URL:-}" ]]; then
  ping_provider "SignalWire" "curl -fsS -u '$SIGNALWIRE_PROJECT_ID:$SIGNALWIRE_TOKEN' 'https://$SIGNALWIRE_SPACE_URL/api/laml/2010-04-01/Accounts/$SIGNALWIRE_PROJECT_ID.json'"
fi
# Cloudflare
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  ping_provider "Cloudflare" "curl -fsS -H 'Authorization: Bearer $CLOUDFLARE_API_TOKEN' 'https://api.cloudflare.com/client/v4/user/tokens/verify'"
fi
# Sentry
if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  ping_provider "Sentry" "curl -fsS -H 'Authorization: Bearer $SENTRY_AUTH_TOKEN' 'https://sentry.io/api/0/organizations/funnel-ai/'"
fi

if [[ "$failures" -gt 0 ]]; then
  printf "\n\033[31m%d failure(s) â€” fix before deploying.\033[0m\n" "$failures"
  exit 1
fi

printf "\n\033[32mAll checks passed.\033[0m\n"
