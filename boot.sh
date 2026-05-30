#!/bin/sh
# GoFunnelAI runtime boot script.
#
# NEVER blocks server startup on anything. Even if every env var is unset
# and migrations would fail, the Next.js server starts and /api/healthz
# returns 200. Diagnostics print to stdout (visible in Railway Deploy Logs)
# so we can see what's missing without preventing the container from booting.
#
# Migrations run in the BACKGROUND — server is healthy in seconds.

# Intentionally NO `set -u` — we want unset vars to be empty strings, not
# fatal errors. Same reason no `set -e`.

echo "=================================================================="
echo "GoFunnelAI boot — $(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown-time)"
echo "=================================================================="
echo ""

# Env-var inventory — names only, no secret values.
echo "[boot] env vars present (set/MISSING):"
for var in DATABASE_URL DIRECT_DATABASE_URL REDIS_URL \
           NEXTAUTH_URL NEXTAUTH_SECRET AUTH_SECRET \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
           ANTHROPIC_API_KEY OPENAI_API_KEY REPLICATE_API_TOKEN \
           R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_ENDPOINT \
           SIGNALWIRE_PROJECT_ID SIGNALWIRE_API_TOKEN SIGNALWIRE_SPACE_URL \
           ELEVENLABS_API_KEY REVTRY_API_KEY \
           STRIPE_SECRET_KEY PAYPAL_CLIENT_ID PAYPAL_SECRET \
           PORT HOSTNAME NODE_ENV RAILWAY_ENVIRONMENT \
           ENABLE_EMBEDDED_WORKERS RAILWAY_PUBLIC_DOMAIN
do
  # Use parameter expansion that NEVER errors on unset vars.
  val=$(printenv "$var" 2>/dev/null || echo "")
  if [ -n "$val" ]; then
    echo "  [+] $var"
  else
    echo "  [-] $var (MISSING)"
  fi
done
echo ""

# Migrations run in BACKGROUND. Server boots immediately. If migrations
# fail (BOM-bug stuck row, network, missing DB, anything), they log but
# don't block /api/healthz from returning 200.
DATABASE_URL_VAL=$(printenv DATABASE_URL 2>/dev/null || echo "")
if [ -n "$DATABASE_URL_VAL" ]; then
  echo "[boot] DATABASE_URL set — running prisma migrate deploy in background"
  (
    echo "[migrate-bg] $(date -u +%H:%M:%S) starting prisma migrate deploy"
    OUT=$(prisma migrate deploy --schema=./prisma/schema.prisma 2>&1)
    RC=$?
    echo "$OUT"
    if [ $RC -ne 0 ]; then
      echo "[migrate-bg] migrate deploy exit=$RC — checking for stuck migration"
      # Detect P3009 / failed-migrations lockout and auto-recover.
      if echo "$OUT" | grep -qE "P3009|have failed|migration.* failed"; then
        STUCK=$(echo "$OUT" | grep -oE '20[0-9]{12}_[a-z_]+' | head -1)
        if [ -n "$STUCK" ]; then
          echo "[migrate-bg] rolling back stuck migration: $STUCK"
          prisma migrate resolve --rolled-back "$STUCK" --schema=./prisma/schema.prisma 2>&1
          echo "[migrate-bg] retrying migrate deploy after rollback"
          prisma migrate deploy --schema=./prisma/schema.prisma 2>&1
          echo "[migrate-bg] retry exit=$?"
        else
          echo "[migrate-bg] could not parse stuck migration name from error"
        fi
      fi
    else
      echo "[migrate-bg] migrate deploy OK"
    fi
    echo "[migrate-bg] $(date -u +%H:%M:%S) done"
  ) &
  MIGRATE_PID=$!
  echo "[boot] migrate background pid=$MIGRATE_PID"
else
  echo "[boot] DATABASE_URL NOT set — skipping migrations"
  echo "[boot] >>> set DATABASE_URL in Railway Variables tab and redeploy <<<"
fi

echo ""
PORT_VAL=$(printenv PORT 2>/dev/null || echo "3000")
HOSTNAME_VAL=$(printenv HOSTNAME 2>/dev/null || echo "0.0.0.0")
echo "[boot] starting Next.js standalone server on ${HOSTNAME_VAL}:${PORT_VAL}"
echo "=================================================================="

# Ensure server.js exists at expected location.
if [ ! -f /app/server.js ]; then
  echo "[boot] FATAL: /app/server.js not found"
  ls -la /app | head -30
  exit 1
fi

# exec replaces this shell with node so signals reach the server properly.
exec node /app/server.js
