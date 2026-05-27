# Neon branching strategy

## Branches we maintain

| Branch | Purpose | Lifetime | Refresh |
|---|---|---|---|
| `production` | Live tenant data. | Forever. | n/a |
| `staging` | Production-mirror, anonymized. | Forever. | Nightly at 02:00 UTC. |
| `preview-template` | Parent for all PR previews. | Forever. | Weekly from production. |
| `preview-pr-<N>` | One per open PR. | Until PR close + 7 days. | Created at PR open. |
| `migration-rehearsal` | Spawned ad-hoc for "would this migration take >30s?". | Hours. | Discarded after rehearsal. |

## Per-PR preview branches

The GitHub Action `.github/workflows/preview-deploy.yml` calls `infrastructure/postgres/branch.sh open <pr-number>` which:

1. POSTs `/projects/{id}/branches` with `parent_id = preview-template` (copy-on-write, ~3s).
2. Retrieves the pooled connection URI.
3. Writes the URI as a Cloudflare secret on the per-PR Worker.

On PR close, `branch.sh close <pr-number>` deletes the branch.

## Nightly staging refresh

The `staging-refresh` GitHub Action runs at 02:00 UTC:

1. Drops the existing `staging` branch.
2. Forks a new `staging` branch from `production` (copy-on-write, ~3s — no data copy).
3. Runs `tooling/anonymizer` against the new branch. Anonymization is destructive on the new branch only; production is untouched.
4. Restores the per-env app config (the role passwords on the staging branch are re-randomized and re-stored in 1Password).

This costs effectively zero Neon storage because branches are copy-on-write — only diverged blocks are billed.

## Migration rehearsal

For schema-changing PRs, CI calls `branch.sh rehearse <pr-number>` which:

1. Forks a branch from the previous-night `staging` dump.
2. Runs the pending migration with `\timing` enabled.
3. Reports wall-clock + lock-holding time as a PR comment.
4. Deletes the branch.

Migrations forecast > 30s on production data block the PR until rewritten with `CREATE INDEX CONCURRENTLY`, batched updates, or `pg_repack`-style maintenance.

## Multi-region branches

The primary region is `aws-us-east-2`. We also maintain `read_replica` compute instances (not branches) in `aws-eu-central-1` and `aws-sa-east-1` so EU and Brazil customer reads stay in-region.

Read replicas are configured via `infrastructure/postgres/regions.md` and exposed to Workers as a separate Hyperdrive binding `DB_REPLICA`.
