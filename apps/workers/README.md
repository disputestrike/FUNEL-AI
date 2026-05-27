# @funnel/workers

BullMQ workers service for GoFunnelAI. Long-running Node process; owns every
cron, async job, and webhook delivery that should not run inside the
request-handling API (`apps/api`).

## What lives here

| Worker | Trigger | Concurrency | Retries |
|---|---|---:|---:|
| `generation` | enqueue | 20 | 3 |
| `ad-publishing` | enqueue | 10 | 5 |
| `email` | enqueue | 50 | 3 |
| `sms` | enqueue | 30 | 3 |
| `webhooks-outbound` | enqueue | 50 | 5 (1m/5m/30m/2h/12h) |
| `speed-to-lead` | enqueue | 100 | 3 |
| `dunning` | hourly cron | 10 | 5 |
| `activation` | hourly cron | 20 | 3 |
| `ingestion` | daily 02:00 UTC | 5 | 3 |
| `reconciliation` | hourly cron | 5 | 3 |
| `bias-audit` | quarterly cron | 2 | 1 |
| `analytics` | enqueue | 20 | 3 |
| `ts-classifier` | enqueue | 10 | 3 |
| `backups-restore-drill` | monthly cron | 1 | 1 |
| `domain-reputation` | monthly cron | 5 | 3 |
| `model-version-promote` | monthly cron | 1 | 1 |
| `recursive-learning` | nightly 03:00 UTC | 1 | 1 |
| `card-expiring-alerts` | daily 09:00 UTC | 5 | 3 |
| `dlq` | enqueue (from failed handlers) | 5 | 1 |

## Run locally

```bash
# from repo root
docker compose -f apps/workers/docker-compose.yml up
```

Or without Docker:

```bash
# from repo root
pnpm install
pnpm --filter @funnel/workers dev
```

Required env vars:

| Var | Purpose |
|---|---|
| `REDIS_URL` | BullMQ backing store (use `redis://...` locally, `rediss://...` on Upstash) |
| `DATABASE_URL` | Postgres connection string for `@funnel/db` |
| `SENTRY_DSN` | Optional. Errors are captured + scrubbed of PII. |
| `HEALTH_PORT` | Defaults to `8080`. |
| `CONCURRENCY_OVERRIDE` | JSON, e.g. `{"generation":40}` to bump a single queue. |
| `SHUTDOWN_DRAIN_TIMEOUT_MS` | Defaults to `30000`. |

## Deploy

Three supported targets (any one of which gives us SIGTERM, persistent TCP,
horizontal scale):

- **Railway** â€” add a new service from this repo, point the build at
  `apps/workers/Dockerfile`. Set the env vars above. Railway sends SIGTERM on
  deploy and waits for the process to exit (we drain in â‰¤30s).

- **Fly.io** â€” `fly launch --dockerfile apps/workers/Dockerfile`. Provision a
  `fly redis` (Upstash under the hood) and bind `REDIS_URL`. Scale per region
  with `fly scale count 2 --region iad`.

- **Render** â€” create a *Background Worker* (not a Web Service). Build command:
  `pnpm --filter @funnel/workers... build`. Start command: `node apps/workers/dist/index.js`.

## Scaling

Each worker is independently concurrent within a single process. Horizontal
scaling = run more pods. BullMQ keeps state in Redis so any pod can pick up any
job; cron schedulers are coordinated via Redis (no leader election needed).

Scaling triggers we monitor in the Grafana "Workers" dashboard:

- Per-queue depth (waiting + delayed). > 1000 for generation = add pods.
- Job latency p95. > 2Ã— baseline = add pods or investigate downstream provider.
- LLM cost burn. Inspect the recursive-learning + bias-audit lines monthly.

## Observability

- `/healthz` â€” liveness. Returns 200 once the process is up.
- `/readyz` â€” readiness. Returns 200 iff Redis + DB are both reachable.
- `/metrics` â€” Prometheus format. Grafana Cloud scrapes this.

All logs are structured JSON to stdout. Datadog Logs picks them up via the host
agent. Each line carries `timestamp`, `level`, `service=workers`, `queue`,
`job_id`, plus context fields.

## Where features live

- Worker code: `src/workers/<name>.ts`
- Queue config: `src/queues.ts`
- Cron schedules: `src/cron.ts`
- DLQ: `src/dlq-handler.ts`
- Idempotency: `src/idempotency.ts`
- Health server: `src/health.ts`
- Metrics + Sentry: `src/monitoring.ts`
- Graceful shutdown: `src/graceful-shutdown.ts`

## Testing

```bash
pnpm --filter @funnel/workers test
```

Unit tests live in `tests/`. Each worker has at minimum:
- A happy path.
- A failure path (retry behaviour).
- A DLQ routing test on terminal failure.
- An idempotency test (second enqueue is a no-op).

The cron schedule + concurrency + graceful-shutdown tests live in
`tests/system/`.
