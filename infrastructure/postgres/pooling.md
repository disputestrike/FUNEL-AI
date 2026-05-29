# Postgres pooling — Hyperdrive vs PgBouncer

## TL;DR

| Workload | Use |
|---|---|
| Cloudflare Workers (api, renderer, grader) | **Hyperdrive** — already pooled, latency-aware, baked into wrangler bindings. |
| Long-running Node workers (apps/workers on Fly/Railway) | **PgBouncer** (transaction mode) sidecar in front of Neon. |
| Migrations + admin DDL | **Neon direct connection** (no pooler) so prepared statements and advisory locks behave. |
| Local dev | Direct connection to the docker-compose Postgres. |

## Why both

Hyperdrive is the right answer for Workers: the connection pool lives outside the Worker process (which has no concept of long-lived sockets), it caches read queries at the edge, and it solves the "100 PoPs each holding their own pool" connection-storm problem. We use it in every wrangler.toml.

But Hyperdrive only works *from* a Worker. Our BullMQ workers, the migration runner, and any scheduled batch job run on Node and need a real pooler. Neon ships its own PgBouncer endpoint (`-pooler` host suffix) but it operates in `transaction` pooling mode, which forbids prepared statements and a few session-level features Prisma uses. So:

- **From Workers:** wrangler binding `[[hyperdrive]] binding = "DB"`, code reads `env.DB.connectionString` and passes it to `postgres` (the `postgres.js` driver, no prepared statements).
- **From Node workers:** point Prisma at `DATABASE_URL=postgres://...-pooler.neon.tech/...?pgbouncer=true&connection_limit=20`, which sets `pgbouncer=true` so Prisma disables prepared statements transparently.
- **From migrations:** `DIRECT_DATABASE_URL=postgres://...neon.tech/...` (no `-pooler`), used by `pnpm migrate:apply` only.

## Connection limits

Neon plan limits (as of 2026-05):

| Plan | Max connections (direct) | Pooled connections (PgBouncer) |
|---|---|---|
| Launch | 100 | 10,000 |
| Scale | 500 | 10,000 |
| Business | 1,000 | 10,000 |

GoFunnelAI prod is on the Business plan. Direct connections are reserved for migrations and admin-only tools; everything else flows through pooled.

## Hyperdrive cache policy

In wrangler.toml the Hyperdrive caching block is:

```toml
caching = { disabled = false, max_age = 60, stale_while_revalidate = 30 }
```

Why these numbers:

- `max_age = 60`: the renderer reads workspace + funnel rows that change at most every few minutes; a 60s freshness window cuts the read load on Postgres by ~95% during a viral traffic spike.
- `stale_while_revalidate = 30`: if a write invalidates the cached row, in-flight readers will still get a stale read for up to 30s — acceptable because the renderer doesn't show write-after-read consistency to users (we're a CDN, not a bank ledger).

**Hot-path writes never hit Hyperdrive cache**: any `INSERT` / `UPDATE` / `DELETE` automatically bypasses cache; only `SELECT` is cached. We additionally annotate queries that must be uncached with a `/* no-cache */` comment that Hyperdrive respects.

## Failure modes

- **Hyperdrive cache poisoning by a long-lived transaction**: not possible — Hyperdrive only caches `SELECT` outside of explicit transactions.
- **Stale read after delete**: a deleted row can be served from cache up to `max_age + stale_while_revalidate` after deletion. For tenant-deletion flows we issue a `DELETE FROM ... RETURNING` and then forcibly purge the renderer's `PAGE_CACHE` KV entry, so customer-visible deletion completes within seconds.
- **Connection storm during a Neon region failover**: Hyperdrive holds the pool, so a Worker spike does not cascade into a Postgres-connection spike. PgBouncer-fronted Node workers may temporarily fail; their BullMQ retries cover this.

## Health checks

- `/readyz` on every app issues `SELECT 1` through the same path the rest of the app uses (Hyperdrive on Workers, PgBouncer on Node).
- Grafana panel "Postgres pool depth" alerts when pooler concurrency > 80% of plan limit.
