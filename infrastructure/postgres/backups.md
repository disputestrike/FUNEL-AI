# Backups and Point-in-Time Recovery

## Neon-native PITR

Neon's Business plan gives us **30-day point-in-time recovery** at the branch level. To restore:

```bash
# Restore production to a specific timestamp into a new branch
curl -X POST "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -d '{"branch":{"name":"pitr-2026-05-26-15-30","parent_id":"'$PROD_BRANCH_ID'","parent_timestamp":"2026-05-26T15:30:00Z"}}'
```

This creates a new branch at the requested timestamp without touching production. To cut over:

1. Verify the new branch (`psql` + spot-check rows).
2. Swap the Hyperdrive config's `connection_string` to the new branch.
3. Promote the new branch to be the primary by renaming.

## External backups to R2

Even though Neon's own PITR is 30 days, we keep a **separate** weekly logical dump in `r2://funnel-backups/` so a hypothetical Neon outage doesn't kill our DR posture.

- **Schedule:** Sunday 04:00 UTC, run by the GitHub Action `.github/workflows/backup.yml`.
- **Tool:** `pg_dump --format=directory --jobs=8 --no-owner --no-acl`, then `tar | zstd -19 | aws s3 cp` to R2 with `--checksum-algorithm SHA256`.
- **Encryption:** dump file is symmetrically encrypted with AGE before upload; the AGE private key lives in 1Password, the public key in the GitHub Action secret store.
- **Retention:** 12 weekly + 12 monthly + 3 yearly.
- **Restore test:** quarterly. Restore the latest dump into a scratch Neon branch and run a smoke E2E suite against it.

## Object storage backups

R2 buckets `funnel-assets`, `funnel-audits`, `funnel-recordings`, `funnel-backups` themselves are replicated to a second R2 jurisdiction nightly via `rclone sync` (running in a Cloudflare Worker cron). The destination is `funnel-backups-replica` in the EU jurisdiction.

## What to restore for which failure

| Failure | Restore from |
|---|---|
| A bad migration drops a column. | Neon PITR — fork prod at the timestamp just before the migration deployed; reconcile differences. |
| An ops engineer accidentally truncates `tenants`. | Neon PITR — same as above. |
| Neon-side data loss event. | R2 weekly dump → fresh Neon project. RTO 4 hours, RPO 7 days. |
| A single tenant requests data restoration (paid feature). | Neon PITR fork → SELECT tenant rows → INSERT INTO live prod with a fresh tenant id. Manual operator runbook in `runbooks/tenant-data-restore.md`. |

## DR drill cadence

- **Quarterly**: restore the latest R2 weekly dump into a scratch project, run smoke tests, document RTO/RPO actually observed.
- **Annually**: full failover drill — pretend production is gone, restore from R2 into a fresh region, repoint Hyperdrive, run the full E2E suite against the restored stack.

Drill results live in `incidents/dr-drill-<date>.md`.
