#!/usr/bin/env bash
# packages/db/scripts/migrate-on-deploy.sh
#
# Production-safe migration runner. Invoked from Railway/Render preDeploy.
#
# Contract:
#   - Waits up to 60s for Postgres TCP to be reachable.
#   - Runs `prisma migrate deploy` (NOT `migrate dev` — that path opens an
#     interactive prompt and is unsafe on production data).
#   - Runs `prisma generate` so the client matches the new schema.
#   - Idempotent: rerunning on a fully-migrated DB is a no-op.
#   - Exits non-zero on any failure so Railway halts the deploy before the
#     new container takes traffic.
#   - Logs to stdout in single-line JSON for Railway's log viewer.

set -Eeuo pipefail

log() {
  # shellcheck disable=SC2155
  local ts="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  printf '{"ts":"%s","service":"migrate-on-deploy","level":"%s","msg":"%s"}\n' \
    "$ts" "$1" "$2"
}

fail() {
  log "fatal" "$1"
  exit 1
}

# ---------------------------------------------------------------------------
# 0. Sanity: must have DATABASE_URL.
# ---------------------------------------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is not set — Railway Postgres plugin not provisioned?"
fi

log "info" "starting db migration"

# ---------------------------------------------------------------------------
# 1. Wait for Postgres TCP — Railway brings the plugin up first, but on a
#    cold project there's a brief window where the new service tries to
#    connect before the DB is listening.
# ---------------------------------------------------------------------------
WAIT_DEADLINE=$(( $(date +%s) + 60 ))

# Strip credentials + path so we get host/port only. Works for
# postgres://, postgresql://, and IPv6 hosts.
DB_HOST_PORT=$(node -e "
const u = new URL(process.env.DATABASE_URL);
process.stdout.write(\`\${u.hostname} \${u.port || 5432}\`);
")
DB_HOST=${DB_HOST_PORT%% *}
DB_PORT=${DB_HOST_PORT##* }

log "info" "waiting for postgres at ${DB_HOST}:${DB_PORT}"
while ! (echo > "/dev/tcp/${DB_HOST}/${DB_PORT}") 2>/dev/null; do
  if [[ $(date +%s) -ge $WAIT_DEADLINE ]]; then
    fail "postgres unreachable after 60s — ${DB_HOST}:${DB_PORT}"
  fi
  sleep 1
done
log "info" "postgres reachable"

# ---------------------------------------------------------------------------
# 2. Run prisma migrate deploy. This is the production command — it applies
#    pending migrations and does NOT prompt, generate, or reset.
# ---------------------------------------------------------------------------
log "info" "running prisma migrate deploy"
if ! pnpm --filter @funnel/db exec prisma migrate deploy; then
  fail "prisma migrate deploy failed — Railway will halt the deploy"
fi
log "info" "prisma migrate deploy succeeded"

# ---------------------------------------------------------------------------
# 3. Regenerate the Prisma client to match the (possibly) new schema.
#    Inside Docker the client was generated at build time, but on Render or
#    on a partial rebuild the runtime image may carry a stale client.
# ---------------------------------------------------------------------------
log "info" "running prisma generate"
if ! pnpm --filter @funnel/db exec prisma generate; then
  fail "prisma generate failed"
fi
log "info" "prisma generate succeeded"

# ---------------------------------------------------------------------------
# 4. Optional: ensure pgvector exists. Idempotent — IF NOT EXISTS.
# ---------------------------------------------------------------------------
log "info" "ensuring pgvector extension"
if ! pnpm --filter @funnel/db exec prisma db execute --stdin <<< "CREATE EXTENSION IF NOT EXISTS vector;"; then
  log "warn" "could not ensure pgvector — may need superuser; run via Railway connect"
fi

log "info" "migration step complete"
exit 0
