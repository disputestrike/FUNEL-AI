#!/usr/bin/env bash
###############################################################################
# GoFunnelAI â€” first-time setup.
#
# Run once on a fresh clone. Idempotent on re-run.
#
#   ./scripts/setup.sh             # interactive
#   ./scripts/setup.sh --ci        # non-interactive (skips prompts)
###############################################################################

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NON_INTERACTIVE=0
[[ "${1:-}" == "--ci" ]] && NON_INTERACTIVE=1

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }
ok()   { printf "\033[32mâœ“ %s\033[0m\n" "$1"; }
die()  { printf "\033[31mâœ— %s\033[0m\n" "$1" >&2; exit 1; }

bold "GoFunnelAI dev setup"

# --- node + pnpm ----------------------------------------------------------
node_ver=$(node -v 2>/dev/null || echo "")
if [[ -z "$node_ver" ]] || [[ ! "$node_ver" =~ ^v(2[0-9]|[3-9][0-9]) ]]; then
  die "Node >= 20 required (have: $node_ver). Install from https://nodejs.org or via fnm/nvm."
fi
ok "Node $node_ver"

if ! command -v pnpm >/dev/null; then
  bold "Installing pnpm@9..."
  npm i -g pnpm@9
fi
ok "pnpm $(pnpm -v)"

# --- workspace deps -------------------------------------------------------
bold "Installing workspace dependencies..."
pnpm install --frozen-lockfile

# --- husky / commitlint ---------------------------------------------------
if [[ -f .husky/install.mjs ]]; then
  node .husky/install.mjs || true
fi

# --- env file -------------------------------------------------------------
if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    die ".env.example missing â€” repo state is broken"
  fi
  bold "Creating .env from .env.example..."
  cp .env.example .env
  ok ".env created"
else
  ok ".env already exists"
fi

# --- docker-compose stack -------------------------------------------------
if [[ -f docker-compose.yml ]] && command -v docker >/dev/null; then
  bold "Booting local stack (Postgres + Redis + MinIO + Mailhog)..."
  docker compose up -d postgres redis minio mailhog
  bold "Waiting for postgres ready..."
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      ok "Postgres ready"
      break
    fi
    sleep 1
  done
else
  warn "docker not available â€” skipping local stack. Install Docker Desktop for full dev experience."
fi

# --- DB migrate + seed ----------------------------------------------------
if command -v docker >/dev/null && docker compose ps -q postgres >/dev/null 2>&1; then
  bold "Applying @funnel/db migrations to local Postgres..."
  pnpm --filter @funnel/db db:migrate
  bold "Seeding local data..."
  pnpm --filter @funnel/db db:seed
fi

# --- prompt for required secrets -----------------------------------------
prompt_secret() {
  local key="$1"
  local desc="$2"
  if grep -q "^${key}=" .env && [[ -n "$(grep "^${key}=" .env | cut -d= -f2-)" ]]; then
    ok "$key already set"
    return
  fi
  if [[ "$NON_INTERACTIVE" == "1" ]]; then
    warn "$key missing (skipping in --ci mode)"
    return
  fi
  bold "Set $key ($desc)"
  read -r -s -p "  > " val
  echo
  if [[ -n "$val" ]]; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" .env || true
    grep -q "^${key}=" .env || echo "${key}=${val}" >> .env
    rm -f .env.bak
  fi
}

if [[ "$NON_INTERACTIVE" == "0" ]]; then
  bold "Optional: paste keys for the providers you have. Leave blank to skip."
  prompt_secret ANTHROPIC_API_KEY "Anthropic Claude API key (sk-ant-â€¦)"
  prompt_secret OPENAI_API_KEY "OpenAI API key (sk-â€¦)"
  prompt_secret RESEND_API_KEY "Resend (email) API key (re_â€¦)"
  prompt_secret CLOUDFLARE_API_TOKEN "Cloudflare API token (scoped: Workers Scripts, KV, R2, Hyperdrive, Pages Edit)"
  prompt_secret CLOUDFLARE_ACCOUNT_ID "Cloudflare Account ID"
fi

bold "Done. Next steps:"
echo "  pnpm dev                 # launch the full local stack"
echo "  pnpm test                # run unit + integration mocked"
echo "  ./scripts/env-check.sh   # verify connectivity to providers"
echo "  ./scripts/deploy.sh staging   # deploy to staging"
