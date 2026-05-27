#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” initial production data seed.
#
# Idempotent â€” re-running will upsert rather than duplicate. Designed to be
# run ONCE at go-live, then never again. Seeds:
#   - industries (per 02a-kb-pack-template + 02b solar example)
#   - KB packs (vertical knowledge bases referenced by the agents)
#   - default funnel templates
#   - default email/SMS templates
#   - first admin user (prompts for email)
#   - default cost-governor limits
#   - feature-flag baseline (mirroring infrastructure/feature-flags/launchdarkly.yml)
###############################################################################

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

: "${DATABASE_URL:?must be set (production direct connection)}"
: "${LAUNCHDARKLY_API_KEY:?must be set}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32mâœ“ %s\033[0m\n" "$1"; }
read_required() { local v; read -r -p "$1: " v; echo "$v"; }

bold "GoFunnelAI â€” production seed."
bold "This script is destructive only if --reset is passed."

RESET=0
if [[ "${1:-}" == "--reset" ]]; then RESET=1; fi

# Industries + KB packs + templates ----------------------------------------
bold "[1/6] industries + KB packs + templates"
RESET=$RESET pnpm --filter @funnel/db tsx scripts/seed-prod-industries.ts
RESET=$RESET pnpm --filter @funnel/kb tsx scripts/seed-prod-kb-packs.ts
RESET=$RESET pnpm --filter @funnel/orchestrator tsx scripts/seed-prod-templates.ts

# Cost governor defaults ---------------------------------------------------
bold "[2/6] cost-governor defaults"
pnpm --filter @funnel/cost-governor tsx scripts/seed-prod-cost-limits.ts

# Email + SMS templates ----------------------------------------------------
bold "[3/6] email + sms templates"
pnpm --filter @funnel/email tsx scripts/seed-prod-templates.ts
pnpm --filter @funnel/notifications tsx scripts/seed-prod-sms-templates.ts

# First admin user ---------------------------------------------------------
bold "[4/6] first admin user"
admin_email=$(read_required "Admin email")
admin_password=$(read_required "Admin password (will be hashed)")
ADMIN_EMAIL="$admin_email" ADMIN_PASSWORD="$admin_password" \
  pnpm --filter @funnel/auth tsx scripts/seed-prod-admin.ts

# Feature flags ------------------------------------------------------------
bold "[5/6] feature flags (LaunchDarkly)"
node tooling/launchdarkly-sync/sync.mjs --file infrastructure/feature-flags/launchdarkly.yml --apply

# Compliance rules library -------------------------------------------------
bold "[6/6] compliance rules library"
pnpm --filter @funnel/compliance tsx scripts/seed-prod-rules.ts

ok "Production seed complete. First admin can log in at https://app.gofunnelai.com with the credentials you just set."
