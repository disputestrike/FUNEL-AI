#!/usr/bin/env bash
###############################################################################
# GoFunnelAI — Neon Postgres one-shot setup.
#
# Idempotent: re-running this script is safe. It will:
#   1. Create the Neon project + databases for prod/staging/preview if missing.
#   2. Create branches: main, staging, preview-template.
#   3. Enable pgvector + pg_stat_statements + pg_trgm + uuid-ossp extensions.
#   4. Provision Cloudflare Hyperdrive entries for each connection string.
#   5. Run @funnel/db migrations against every branch.
#
# Required env (set via 1Password CLI or direnv before running):
#   NEON_API_KEY                Personal API key from https://console.neon.tech
#   NEON_ORG_SLUG               Org slug, e.g. "funnel-ai"
#   CLOUDFLARE_API_TOKEN        scoped: Hyperdrive:Edit
#   CLOUDFLARE_ACCOUNT_ID
#   FUNNEL_DB_PASSWORD          Strong password (printed once + saved to 1Password)
#
# Usage:
#   ./infrastructure/postgres/setup.sh
#   ./infrastructure/postgres/setup.sh --env staging
###############################################################################

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

NEON_API="https://console.neon.tech/api/v2"
PROJECT_NAME="funnel-ai"
PG_VERSION=16
PRIMARY_REGION="aws-us-east-2"
EU_REGION="aws-eu-central-1"
BR_REGION="aws-sa-east-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

env_target="all"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) env_target="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

req() { command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 1; }; }
req curl
req jq
req psql
req pnpm

[[ -z "${NEON_API_KEY:-}" ]] && { echo "NEON_API_KEY not set" >&2; exit 1; }
[[ -z "${NEON_ORG_SLUG:-}" ]] && { echo "NEON_ORG_SLUG not set" >&2; exit 1; }
[[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] && { echo "CLOUDFLARE_API_TOKEN not set" >&2; exit 1; }
[[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]] && { echo "CLOUDFLARE_ACCOUNT_ID not set" >&2; exit 1; }
[[ -z "${FUNNEL_DB_PASSWORD:-}" ]] && { echo "FUNNEL_DB_PASSWORD not set" >&2; exit 1; }

neon() {
  curl -fsS -H "Authorization: Bearer $NEON_API_KEY" \
       -H "Content-Type: application/json" \
       -H "Accept: application/json" \
       "$@"
}

cf() {
  curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
       -H "Content-Type: application/json" \
       "$@"
}

#------------------------------------------------------------------------------
# 1. Project
#------------------------------------------------------------------------------
echo ">> Ensuring Neon project '$PROJECT_NAME' exists..."

project_id="$(neon "$NEON_API/projects?limit=400" | jq -r --arg n "$PROJECT_NAME" \
  '.projects[] | select(.name==$n) | .id' | head -n1)"

if [[ -z "$project_id" ]]; then
  echo ">> Creating Neon project (primary region $PRIMARY_REGION)..."
  project_id="$(neon -X POST "$NEON_API/projects" \
    -d "$(jq -nc \
      --arg name "$PROJECT_NAME" \
      --arg region "$PRIMARY_REGION" \
      --argjson pg_version "$PG_VERSION" \
      --arg org "$NEON_ORG_SLUG" \
      '{project:{name:$name,region_id:$region,pg_version:$pg_version,org_id:$org}}')" \
    | jq -r '.project.id')"
  echo ">> Created project_id=$project_id"
else
  echo ">> Project already exists: $project_id"
fi

#------------------------------------------------------------------------------
# 2. Branches: production / staging / preview-template
#------------------------------------------------------------------------------
ensure_branch() {
  local branch_name="$1"
  local parent_branch_id="${2:-}"
  local existing
  existing="$(neon "$NEON_API/projects/$project_id/branches" \
    | jq -r --arg n "$branch_name" '.branches[] | select(.name==$n) | .id' | head -n1)"
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  local payload
  if [[ -n "$parent_branch_id" ]]; then
    payload="$(jq -nc --arg n "$branch_name" --arg p "$parent_branch_id" \
      '{branch:{name:$n,parent_id:$p}}')"
  else
    payload="$(jq -nc --arg n "$branch_name" '{branch:{name:$n}}')"
  fi
  neon -X POST "$NEON_API/projects/$project_id/branches" -d "$payload" \
    | jq -r '.branch.id'
}

main_id="$(ensure_branch production || true)"
staging_id="$(ensure_branch staging "$main_id")"
preview_id="$(ensure_branch preview-template "$main_id")"
echo ">> Branches: production=$main_id staging=$staging_id preview=$preview_id"

#------------------------------------------------------------------------------
# 3. Connection strings
#------------------------------------------------------------------------------
fetch_uri() {
  local branch_id="$1"
  neon "$NEON_API/projects/$project_id/connection_uri?branch_id=$branch_id&database_name=funnel&role_name=funnel_app&pooled=true" \
    | jq -r '.uri'
}

prod_uri="$(fetch_uri "$main_id")"
staging_uri="$(fetch_uri "$staging_id")"
preview_uri="$(fetch_uri "$preview_id")"

# Replace the role's auto-generated password with our managed one so it lives
# in 1Password instead of Neon's vault.
update_password() {
  local branch_id="$1"
  neon -X POST "$NEON_API/projects/$project_id/branches/$branch_id/roles/funnel_app/reset_password" \
    >/dev/null
}
update_password "$main_id"
update_password "$staging_id"
update_password "$preview_id"

#------------------------------------------------------------------------------
# 4. Extensions
#------------------------------------------------------------------------------
enable_extensions() {
  local uri="$1"
  local name="$2"
  echo ">> Enabling extensions on $name..."
  psql "$uri" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
}

if [[ "$env_target" == "all" || "$env_target" == "production" ]]; then
  enable_extensions "$prod_uri" production
fi
if [[ "$env_target" == "all" || "$env_target" == "staging" ]]; then
  enable_extensions "$staging_uri" staging
fi
if [[ "$env_target" == "all" || "$env_target" == "preview" ]]; then
  enable_extensions "$preview_uri" preview
fi

#------------------------------------------------------------------------------
# 5. Hyperdrive configs in Cloudflare for each connection string
#------------------------------------------------------------------------------
upsert_hyperdrive() {
  local name="$1"
  local uri="$2"
  local existing
  existing="$(cf "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs" \
    | jq -r --arg n "$name" '.result[] | select(.name==$n) | .id' | head -n1)"

  local payload
  payload="$(jq -nc --arg name "$name" --arg uri "$uri" \
    '{name:$name,origin:{scheme:"postgres",connection_string:$uri},
      caching:{disabled:false,max_age:60,stale_while_revalidate:30}}')"

  if [[ -z "$existing" ]]; then
    cf -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs" \
       -d "$payload" | jq -r '.result.id'
  else
    cf -X PATCH "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs/$existing" \
       -d "$payload" | jq -r '.result.id'
  fi
}

hd_prod="$(upsert_hyperdrive funnel-prod "$prod_uri")"
hd_staging="$(upsert_hyperdrive funnel-staging "$staging_uri")"
hd_preview="$(upsert_hyperdrive funnel-preview "$preview_uri")"

echo ">> Hyperdrive IDs: prod=$hd_prod staging=$hd_staging preview=$hd_preview"

#------------------------------------------------------------------------------
# 6. Migrations
#------------------------------------------------------------------------------
run_migrations() {
  local uri="$1"
  local name="$2"
  echo ">> Running @funnel/db migrations on $name..."
  ( cd "$REPO_ROOT" && DATABASE_URL="$uri" pnpm --filter @funnel/db db:migrate )
}

if [[ "$env_target" == "all" || "$env_target" == "production" ]]; then
  run_migrations "$prod_uri" production
fi
if [[ "$env_target" == "all" || "$env_target" == "staging" ]]; then
  run_migrations "$staging_uri" staging
fi
if [[ "$env_target" == "all" || "$env_target" == "preview" ]]; then
  run_migrations "$preview_uri" preview
fi

#------------------------------------------------------------------------------
# 7. Write back to .env.deploy.generated so wrangler can find the IDs.
#------------------------------------------------------------------------------
mkdir -p "$REPO_ROOT/infrastructure/.generated"
cat > "$REPO_ROOT/infrastructure/.generated/postgres.env" <<EOF
# Generated by infrastructure/postgres/setup.sh on $(date -u +%FT%TZ)
NEON_PROJECT_ID=$project_id
NEON_BRANCH_PRODUCTION=$main_id
NEON_BRANCH_STAGING=$staging_id
NEON_BRANCH_PREVIEW=$preview_id
HYPERDRIVE_ID=$hd_prod
HYPERDRIVE_ID_STAGING=$hd_staging
HYPERDRIVE_ID_PREVIEW=$hd_preview
EOF

echo ">> Done. Outputs written to infrastructure/.generated/postgres.env"
