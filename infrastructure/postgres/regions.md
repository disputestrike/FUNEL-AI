# Multi-region Postgres topology

## Layout

```
                Cloudflare Workers (every PoP)
                     |
                     | Hyperdrive (region-aware routing)
                     v
  ┌──────────────────────────────────────────────────┐
  │ Neon project: funnel-ai                          │
  │                                                  │
  │  Primary compute   us-east-2 (Ohio)              │
  │   - branch: production                           │
  │   - branch: staging                              │
  │   - branch: preview-template                     │
  │                                                  │
  │  Read replica     eu-central-1 (Frankfurt)       │
  │   - alias DB_REPLICA_EU                          │
  │                                                  │
  │  Read replica     sa-east-1 (São Paulo)          │
  │   - alias DB_REPLICA_BR                          │
  └──────────────────────────────────────────────────┘
```

## Why us-east-2 for primary

- Lowest latency (~12ms) to Cloudflare's largest US PoP cluster.
- Same region as Upstash Redis primary (us-east).
- One AZ-failure away from us-east-1; the cost of cross-region failover is acceptable for our RTO.

## Read replica policy

- Replicas are **read-only** — every write hits the primary regardless of which Worker called.
- Replication is asynchronous; lag is monitored and alerted on > 5s (renderer hot path tolerates seconds of staleness, billing does not).
- Renderer + grader reads route to the closest replica; api writes always go to the primary.
- Hyperdrive's smart routing picks the right endpoint based on the Worker's PoP region.

## Per-tenant region pinning (data residency)

Tenants in the EU jurisdiction set `tenant.data_region='eu'`. The application layer enforces:

- **Reads**: route to `DB_REPLICA_EU` only.
- **Writes**: route to a dedicated EU-only branch of the primary (a separate Neon project, `funnel-ai-eu`, in `aws-eu-central-1`).
- **R2**: store all blobs in `funnel-assets-eu` / `funnel-audits-eu`.
- **Backups**: stay in EU R2 jurisdiction.

We currently keep a separate Neon project per residency region (US + EU + BR) rather than try to make one project span. The cross-project query path is a service-level concern — there is no SQL join across residency regions; the application layer does the data fetch and the join in code if needed (rare).

## Adding a new region

Procedure (template; takes ~2 hours of operator time):

1. `infrastructure/postgres/setup.sh --region <aws-region>` provisions a new Neon project.
2. Add to `infrastructure/cloudflare/r2-buckets.tf` a new bucket pair in the chosen jurisdiction.
3. Add a Hyperdrive config pointing at the new project.
4. Add `tenant.data_region` enum value.
5. Update onboarding wizard to surface the new region.
6. Brief support team + update privacy policy region list.
