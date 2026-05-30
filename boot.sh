#!/bin/sh
# GoFunnelAI runtime boot script.
#
# Goals:
#   1. ALWAYS start the Next.js server, even if migrations or env vars are
#      missing — so Railway can health-check the container and we can see
#      real logs in the dashboard instead of cryptic preDeploy failures.
#   2. Run prisma migrate deploy if DATABASE_URL is set. Log success or
#      failure loudly. Do NOT exit non-zero on migration failure.
#   3. Print env-var inventory at boot so we can see what's configured
#      without exposing secret values.

set -u

echo "=================================================================="
echo "GoFunnelAI boot — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================================="

# Env-var inventory (names only, no values)
echo ""
echo "[boot] env vars present:"
for var in DATABASE_URL REDIS_URL NEXTAUTH_URL NEXTAUTH_SECRET \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
           ANTHROPIC_API_KEY OPENAI_API_KEY REPLICATE_API_TOKEN \
           R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_ENDPOINT \
           SIGNALWIRE_PROJECT_ID SIGNALWIRE_API_TOKEN SIGNALWIRE_SPACE_URL \
           ELEVENLABS_API_KEY REVTRY_API_KEY \
           STRIPE_SECRET_KEY PAYPAL_CLIENT_ID PAYPAL_SECRET \
           PORT HOSTNAME NODE_ENV RAILWAY_ENVIRONMENT \
           ENABLE_EMBEDDED_WORKERS RAILWAY_PUBLIC_DOMAIN
do
  eval val=\"\$$var\"
  if [ -n "${val:-}" ]; then
    echo "  [+] $var (set)"
  else
    echo "  [-] $var (MISSING)"
  fi
done
echo ""

# Run migrations if DATABASE_URL is set. Non-fatal.
#
# If a previous deploy left a migration marked "failed" in _prisma_migrations
# (e.g. the BOM-in-SQL bug we just fixed), prisma migrate deploy refuses to
# proceed. Auto-recover by rolling back the failed marker first, then retry.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[boot] DATABASE_URL is set — running prisma migrate deploy..."
  if prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 | tee /tmp/migrate.log; then
    echo "[boot] migrations OK"
  else
    rc=$?
    echo "[boot] migrations FAILED (exit=$rc) — attempting recovery..."
    # Detect a "failed migration" lockout and roll it back so the next
    # deploy attempt can re-apply the (now-fixed) SQL.
    if grep -q "following migration(s) have failed" /tmp/migrate.log 2>/dev/null \
       || grep -q "P3009" /tmp/migrate.log 2>/dev/null; then
      stuck=$(grep -oE '20[0-9]{12}_[a-z_]+' /tmp/migrate.log | head -1)
      if [ -n "$stuck" ]; then
        echo "[boot] rolling back stuck migration: $stuck"
        prisma migrate resolve --rolled-back "$stuck" --schema=./prisma/schema.prisma || true
        echo "[boot] re-running migrate deploy after rollback..."
        if prisma migrate deploy --schema=./prisma/schema.prisma; then
          echo "[boot] migrations OK (after recovery)"
        else
          echo "[boot] migrations still failing after recovery — starting server anyway"
        fi
      fi
    fi
  fi
else
  echo "[boot] DATABASE_URL is NOT set — skipping migrations"
  echo "[boot] set DATABASE_URL in Railway Variables tab, then redeploy"
fi

echo ""
echo "[boot] starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
echo "=================================================================="
exec node server.js
