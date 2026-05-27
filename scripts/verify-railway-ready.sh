#!/usr/bin/env bash
# scripts/verify-railway-ready.sh
#
# Single-command pre-flight check before clicking "Deploy" on Railway.
# Exits 0 with "READY FOR RAILWAY DEPLOY" iff every gate passes.
# Exits 1 with a checklist of failures otherwise.

set -uo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

# ----- pretty output --------------------------------------------------------
GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
pass() { printf "  ${GREEN}OK${RESET}  %s\n" "$1"; }
fail() { printf "  ${RED}FAIL${RESET} %s\n" "$1"; FAILURES+=("$1"); }
warn() { printf "  ${YELLOW}WARN${RESET} %s\n" "$1"; }
sect() { printf "\n${DIM}── %s ──${RESET}\n" "$1"; }

FAILURES=()

SERVICES=(api web admin grader renderer workers)

# ----- 1. railway.json present + parseable ----------------------------------
sect "1. Root railway.json"
if [[ -f railway.json ]]; then
  if python3 -c "import json,sys; json.load(open('railway.json'))" 2>/dev/null \
     || node -e "JSON.parse(require('fs').readFileSync('railway.json'))" 2>/dev/null; then
    pass "railway.json present and valid JSON"
  else
    fail "railway.json present but not valid JSON"
  fi
else
  fail "railway.json missing at repo root"
fi

# ----- 2. per-service railway.toml + Dockerfile -----------------------------
sect "2. Per-service Dockerfile + railway.toml"
for svc in "${SERVICES[@]}"; do
  d="apps/$svc/Dockerfile"
  t="apps/$svc/railway.toml"
  [[ -f "$d" ]] && pass "$d" || fail "$d missing"
  [[ -f "$t" ]] && pass "$t" || fail "$t missing"

  # Quick smell-test of the railway.toml.
  if [[ -f "$t" ]]; then
    if grep -q 'builder *= *"DOCKERFILE"' "$t"; then
      pass "$t declares DOCKERFILE builder"
    else
      fail "$t missing builder = \"DOCKERFILE\""
    fi
    if grep -q 'healthcheckPath' "$t"; then
      pass "$t has healthcheckPath"
    else
      fail "$t missing healthcheckPath"
    fi
  fi

  # Dockerfile smell-test: non-root user + HEALTHCHECK.
  if [[ -f "$d" ]]; then
    if grep -q '^USER ' "$d"; then
      pass "$d switches to non-root USER"
    else
      fail "$d never switches USER — running as root"
    fi
    if grep -q '^HEALTHCHECK' "$d"; then
      pass "$d declares HEALTHCHECK"
    else
      warn "$d has no HEALTHCHECK directive (Railway uses railway.toml healthcheckPath regardless)"
    fi
  fi
done

# ----- 3. Health endpoints exist in source ----------------------------------
sect "3. /healthz + /readyz endpoints"

# Hono services
for svc in api renderer workers; do
  if grep -rq "/healthz" "apps/$svc/src" 2>/dev/null; then
    pass "apps/$svc has /healthz handler"
  else
    fail "apps/$svc has no /healthz handler in src/"
  fi
  if grep -rq "/readyz" "apps/$svc/src" 2>/dev/null; then
    pass "apps/$svc has /readyz handler"
  else
    fail "apps/$svc has no /readyz handler in src/"
  fi
done

# Next.js services
for svc in web admin grader; do
  if [[ -f "apps/$svc/src/app/api/healthz/route.ts" ]]; then
    pass "apps/$svc/src/app/api/healthz/route.ts"
  else
    fail "apps/$svc/src/app/api/healthz/route.ts missing"
  fi
  if [[ -f "apps/$svc/src/app/api/readyz/route.ts" ]]; then
    pass "apps/$svc/src/app/api/readyz/route.ts"
  else
    fail "apps/$svc/src/app/api/readyz/route.ts missing"
  fi
done

# ----- 4. Migration script + script entry -----------------------------------
sect "4. Migration script"
if [[ -x packages/db/scripts/migrate-on-deploy.sh || -f packages/db/scripts/migrate-on-deploy.sh ]]; then
  pass "packages/db/scripts/migrate-on-deploy.sh present"
else
  fail "packages/db/scripts/migrate-on-deploy.sh missing"
fi
if grep -q '"db:migrate:deploy"' packages/db/package.json; then
  pass "packages/db/package.json declares db:migrate:deploy"
else
  fail "packages/db/package.json missing db:migrate:deploy script"
fi

# ----- 5. env-template completeness -----------------------------------------
sect "5. env-template.txt"
ENV_TPL="infrastructure/railway/env-template.txt"
if [[ -f "$ENV_TPL" ]]; then
  pass "$ENV_TPL exists"
  REQUIRED_KEYS=(
    DATABASE_URL REDIS_URL JWT_SECRET SESSION_SECRET COOKIE_SIGNING_KEY
    ANTHROPIC_API_KEY RESEND_API_KEY SIGNALWIRE_PROJECT_ID PAYPAL_CLIENT_ID
    STRIPE_SECRET_KEY SENTRY_DSN R2_ACCOUNT_ID
  )
  for k in "${REQUIRED_KEYS[@]}"; do
    if grep -q "$k" "$ENV_TPL"; then
      pass "$ENV_TPL mentions $k"
    else
      fail "$ENV_TPL missing $k"
    fi
  done
else
  fail "$ENV_TPL missing"
fi

# ----- 6. Validate Dockerfiles parse (best-effort) --------------------------
sect "6. Dockerfile syntax (best-effort)"
if command -v docker >/dev/null 2>&1; then
  for svc in "${SERVICES[@]}"; do
    d="apps/$svc/Dockerfile"
    if [[ -f "$d" ]]; then
      if docker buildx build --check -f "$d" . >/dev/null 2>&1; then
        pass "$d passes buildx --check"
      else
        warn "$d failed buildx --check (may just be missing buildx; rerun with Docker Engine to validate)"
      fi
    fi
  done
else
  warn "docker CLI not on PATH — skipped Dockerfile syntax check"
fi

# ----- 7. Render fallback ---------------------------------------------------
sect "7. Render fallback"
if [[ -f infrastructure/render/render.yaml ]]; then
  pass "infrastructure/render/render.yaml present (fallback PaaS)"
else
  warn "infrastructure/render/render.yaml missing — Render fallback unavailable"
fi

# ----- 8. Go-live checklist updated -----------------------------------------
sect "8. Go-live checklist"
if [[ -f scripts/go-live-checklist.md ]]; then
  if grep -q "Railway" scripts/go-live-checklist.md; then
    pass "scripts/go-live-checklist.md has Railway section"
  else
    fail "scripts/go-live-checklist.md exists but no Railway section"
  fi
else
  fail "scripts/go-live-checklist.md missing"
fi

# ----- summary --------------------------------------------------------------
echo
if [[ ${#FAILURES[@]} -eq 0 ]]; then
  printf "${GREEN}===========================================${RESET}\n"
  printf "${GREEN}    READY FOR RAILWAY DEPLOY${RESET}\n"
  printf "${GREEN}===========================================${RESET}\n"
  echo
  echo "Next steps:"
  echo "  1. railway login"
  echo "  2. railway link            (attach this repo to a project)"
  echo "  3. railway add --plugin postgres"
  echo "  4. railway add --plugin redis"
  echo "  5. bash scripts/env-check.sh infrastructure/railway/env-template.txt"
  echo "  6. git push origin main    (triggers .github/workflows/railway-deploy.yml)"
  echo
  exit 0
else
  printf "${RED}===========================================${RESET}\n"
  printf "${RED}    NOT READY — %d gate(s) failed${RESET}\n" "${#FAILURES[@]}"
  printf "${RED}===========================================${RESET}\n"
  echo
  for f in "${FAILURES[@]}"; do printf "  - %s\n" "$f"; done
  echo
  exit 1
fi
