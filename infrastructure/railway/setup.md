# Railway setup â€” GoFunnelAI

End-to-end runbook for spinning up the GoFunnelAI project on Railway.
Every step is idempotent â€” safe to re-run.

> Assumes you already have a Railway account and the CLI installed:
> `curl -fsSL https://railway.app/install.sh | sh` then `railway login`.

---

## 1. Create the project and link the repo

```bash
# From the repo root (C:\Users\benxp\funnel-ai)
railway init                       # name: "funnel-ai-production"
railway link                       # attach this repo to the project
```

In the dashboard:

1. **Settings â†’ Source** â†’ connect the GitHub repo.
2. **Settings â†’ Environments** â†’ create `production` and `staging`.
3. **Settings â†’ Region** â†’ pick the region closest to your customers
   (`us-east` is the default; `eu-west` for EU-focused deployments).

---

## 2. Provision the Postgres plugin

```bash
railway add --plugin postgres
```

Railway returns a connection string and auto-injects `DATABASE_URL`,
`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` into every
service in this project.

### Enable pgvector

`pgvector` is required for the KB embeddings table (`packages/kb`).
Railway Postgres ships with it available but not enabled by default.

```bash
# Open a psql shell against the plugin DB.
railway connect postgres

# Then in the psql prompt:
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
\q
```

The `migrate-on-deploy.sh` script also runs `CREATE EXTENSION IF NOT
EXISTS vector;` on every deploy as a safety net (it logs a warning if
the role lacks superuser).

### Connection pooling

Railway Postgres exposes both a direct connection and a PgBouncer
endpoint. Use the pooler for serverless / per-request services and
direct for long-running workers:

| Service           | Use                                        |
| ----------------- | ------------------------------------------ |
| funnel-api        | `DATABASE_URL` (pooled, `?pgbouncer=true`) |
| funnel-web        | `DATABASE_URL` (pooled)                    |
| funnel-admin      | `DATABASE_URL` (pooled)                    |
| funnel-grader     | `DATABASE_URL` (pooled)                    |
| funnel-renderer   | `DATABASE_URL` (pooled)                    |
| funnel-workers    | `DATABASE_URL_DIRECT` (unpooled)           |

To get the direct URL, click **Postgres â†’ Connect** in the dashboard
and use the "Direct" tab. Set it as `DATABASE_URL_DIRECT` on the
`funnel-workers` service.

### Backups

Railway runs daily snapshots automatically for Pro projects. Configure:

1. **Postgres plugin â†’ Backups â†’ Enable daily**.
2. **Retention** â†’ 14 days (matches doc 09 retention policy).
3. **Test restore** at least once before go-live â€” restore into a
   separate Railway project, run `pnpm --filter @funnel/db db:migrate`,
   and verify rows count.

### Manual snapshot before risky migrations

```bash
railway connect postgres
\! pg_dump --no-owner --no-privileges -Fc -f /tmp/funnel-$(date +%Y%m%d).dump $DATABASE_URL
\q
# Then upload /tmp/funnel-*.dump to R2 for cold storage.
```

---

## 3. Provision the Redis plugin

```bash
railway add --plugin redis
```

Injects `REDIS_URL` (and `REDISHOST/PORT/USER/PASSWORD`) into every
service.

The shared Redis is used for:

- **BullMQ queues** (`funnel-workers`) â€” see `apps/workers/src/queues.ts`.
- **Idempotency keys** (`apps/api`, `apps/workers`) â€” 24-72h TTL.
- **Rate limits** (`apps/api`) â€” sliding-window counters.
- **Session store** (`apps/api`, `apps/admin`) â€” short-lived only.

### Upgrade to dedicated Redis (post-Series-A)

The plugin is fine for the first ~1k users. For >10 ops/sec sustained
queue depth or sub-ms read latency, upgrade to **Railway Redis Cloud
addon** (dedicated nodes) or migrate to **Upstash Redis** (per-request
pricing, edge-replicated). Either way the env var stays `REDIS_URL` â€”
swap the value and redeploy.

---

## 4. Create the six application services

In the dashboard: **+ New Service â†’ GitHub Repo â†’ funnel-ai**.
For each service, set:

| Field                   | Value                                             |
| ----------------------- | ------------------------------------------------- |
| Service name            | `funnel-api` / `funnel-web` / `funnel-admin` / `funnel-grader` / `funnel-renderer` / `funnel-workers` |
| Root directory          | `/`                                               |
| Builder                 | Dockerfile                                        |
| Dockerfile path         | `apps/<name>/Dockerfile`                          |
| Branch                  | `main` (production env), `staging` (staging env)  |
| Watch paths             | `apps/<name>/**`, `packages/**`, `pnpm-lock.yaml` |

The per-app `apps/<name>/railway.toml` carries the rest (start command,
healthcheck, replicas, preDeploy migration step).

### CLI alternative (one-shot)

```bash
for svc in api web admin grader renderer workers; do
  railway service create "funnel-$svc"
done
```

Then commit any subsequent change to `apps/<name>/Dockerfile` or
`railway.toml` and Railway re-deploys automatically.

---

## 5. Set environment variables

Use `infrastructure/railway/env-template.txt` as the source of truth.
Bulk-set shared vars:

```bash
# Shared across every service (run once):
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info
railway variables set JWT_SECRET="$(openssl rand -base64 48)"
railway variables set SESSION_SECRET="$(openssl rand -base64 48)"
railway variables set COOKIE_SIGNING_KEY="$(openssl rand -base64 32)"
# ... continue per env-template.txt
```

Per-service overrides:

```bash
railway variables set --service funnel-api  CORS_ALLOWED_ORIGINS="https://gofunnelai.com,https://admin.gofunnelai.com"
railway variables set --service funnel-web  NEXT_PUBLIC_API_URL="https://api.gofunnelai.com"
railway variables set --service funnel-workers WORKERS_CONCURRENCY=16
```

---

## 6. Wire custom domains

In the dashboard: **<service> â†’ Settings â†’ Domains â†’ Add**.

| Service           | Domain (prod)         | Domain (staging)              |
| ----------------- | --------------------- | ----------------------------- |
| funnel-web        | gofunnelai.com, www        | staging.gofunnelai.com             |
| funnel-api        | api.gofunnelai.com         | api.staging.gofunnelai.com         |
| funnel-admin      | admin.gofunnelai.com       | admin.staging.gofunnelai.com       |
| funnel-grader     | grade.gofunnelai.com       | grade.staging.gofunnelai.com       |
| funnel-renderer   | pages.gofunnelai.com (+ *.funnel.page CNAME) | pages.staging.gofunnelai.com |
| funnel-workers    | (internal â€” no domain)                  |                       |

For each:

1. Add domain in Railway â†’ copy the CNAME target.
2. In your DNS provider, create the CNAME â†’ Railway's edge.
3. Wait for cert provisioning (Railway handles Let's Encrypt).

---

## 7. Staging environment / branching strategy

Two patterns supported:

### A. Single Railway project, two environments (recommended)

- Production: tracks `main` branch.
- Staging: tracks `staging` branch.

Both environments use the **same Postgres + Redis plugins** with
**different databases**:

```sql
-- In Railway connect postgres (production plugin):
CREATE DATABASE funnel_staging;
```

Then on the staging environment, override `DATABASE_URL` to point at
the `funnel_staging` database. Single plugin bill, full isolation at
the schema layer.

### B. Two separate Railway projects (full isolation)

`funnel-ai-production` and `funnel-ai-staging` as separate projects.
Each gets its own Postgres + Redis plugins. Costs more but guarantees
zero blast-radius between staging and prod.

The migration script never destructively drops, so option (A) is safe
for the first 12 months. Re-evaluate before Series A.

---

## 8. Smoke tests after first deploy

```bash
# Check every public health endpoint:
for svc in api web admin grader renderer; do
  curl -sf "https://$(echo $svc | sed s/funnel-//).gofunnelai.com/healthz" \
    || curl -sf "https://$(echo $svc | sed s/funnel-//).gofunnelai.com/api/healthz" \
    && echo "$svc OK" || echo "$svc FAIL"
done

# Check internal worker via private network from the api service shell:
railway run --service funnel-api -- curl -sf http://funnel-workers.railway.internal:8080/healthz
```

Or just run:

```bash
bash scripts/health-check.sh production
```

---

## 9. Day-2 operations

- **View logs:** `railway logs --service funnel-api`
- **Redeploy:** push to `main` (or `railway redeploy --service funnel-api`)
- **Rollback:** `railway redeploy --deployment <previous-deployment-id>`
- **Scale up:** `railway service update --service funnel-workers --replicas 5`
- **Open a psql shell:** `railway connect postgres`
- **Open a Redis shell:** `railway connect redis`

Full incident playbook: `../../scripts/rollback.sh` and doc 11.
