# FunelAI â€” Engineering Operational Spec

**Owner:** Engineering
**Status:** Authoritative pre-launch baseline
**Target:** Day 90 public launch
**Audience:** Founding four engineers, plus every engineer who joins the team through month 12 (~25 engineers)
**Stack assumptions:** Next.js (App Router) on Cloudflare Pages/Workers, Cloudflare R2 for object storage, Postgres (Neon or Supabase) with pgvector, Prisma ORM, BullMQ on Redis (Upstash) for queues, Claude + OpenAI for generation, RevTry for outbound voice.

This document is the single source of truth for how FunelAI tests, ships, and runs its software. It is split into three parts:

- **Part A â€” Testing Strategy:** what we test, how, and where the bar sits.
- **Part B â€” CI/CD Pipeline:** how code gets from a laptop to production safely.
- **Part C â€” Observability:** how we know the system is healthy and how we respond when it isn't.

If you are an engineer joining FunelAI, you should be able to set up the entire operational stack from this document plus the linked secrets in 1Password. If something is missing, fix the doc.

---

## PART A â€” Testing Strategy

FunelAI's product promise is "a paying customer gets a published, lead-capturing funnel in 60 seconds." Every test we write either protects that promise or protects the customer's money. We do not write tests for vanity coverage.

### A.1 The Testing Pyramid

The pyramid below is enforced in CI. Numbers in parentheses are the floor â€” exceeding them is encouraged, falling below them blocks merge.

```
                  /\
                 /E2\         ~30 specs   (Playwright)
                /----\
               /Regr- \       ~200 cases  (Agent regression suite)
              / ession \
             /----------\
            / Integration\    ~80 suites  (one per external integration)
           /--------------\
          /                \
         /     Unit         \  ~2000+ tests, 80% coverage on critical paths
        /____________________\
```

#### A.1.1 Unit Tests

**Framework:** Vitest (chosen over Jest for native ESM + Workers compat + speed).

**Coverage floor:** 80% line + 80% branch on critical-path modules. The set of critical-path modules is enforced by an explicit allow-list at `tooling/coverage/critical-paths.json` so we don't accidentally lose the floor when files move. The list:

- `packages/billing/**` â€” Stripe + PayPal adapters, plan enforcement, proration, dunning state machine, idempotency keys, webhook signature verification, refund flows.
- `packages/auth/**` â€” session validation, permission checks, plan-gated capability checks.
- `packages/rls/**` â€” every RLS policy has a unit test that asserts both the allow case and the deny case across tenant boundaries.
- `packages/agents/orchestrator/**` â€” agent graph traversal, retry policies, partial-failure handling, cost ceiling enforcement.
- `packages/agents/fact-check/**` â€” claim extraction, claim verification, rewrite triggers.
- `packages/agents/compliance/**` â€” disallowed-claims classifier, geographic gating, FTC + Meta + Google policy rules.
- `packages/agents/brand-guard/**` â€” voice + visual brand-drift detection.
- `packages/webhooks/**` â€” signature verification per provider (Stripe, PayPal, Meta, Google, TikTok, LinkedIn, RevTry, SendGrid, Twilio), idempotency dedupe, replay protection.

**Run trigger:** every PR, every merge to main, every nightly.

**Local command:** `pnpm test:unit` (watches by default), `pnpm test:unit:ci` (single pass with coverage).

**Conventions:**

- One file per module: `foo.ts` -> `foo.test.ts` colocated.
- No live network. No live DB. Use `vitest-mock-extended` for collaborator stubs.
- Time is injected via `@/lib/clock` â€” never `Date.now()` directly. Tests advance the clock with `vi.useFakeTimers()`.
- Money is `Money` (bigint, currency tag). Tests that pass `number` to billing code fail typecheck.
- Snapshot tests are banned for anything except deterministic markdown rendering and prompt templates. Snapshot diffs on logic are a smell.

**RLS policy testing:** every policy has a paired test in `packages/rls/__tests__/policies.test.ts` that uses a SQL-level harness (pgTAP-style assertions executed through a throwaway local Postgres) â€” a unit-level mock is not sufficient because the policy lives in the database. These run in CI against a fresh container, take ~12 seconds, and are non-negotiable.

#### A.1.2 Integration Tests

Every external integration ships with a dedicated suite. The matrix:

| Integration | Sandbox available | Test mode |
|---|---|---|
| Stripe | yes | sandbox + recorded replays |
| PayPal | yes (sandbox.paypal.com) | sandbox |
| Meta Ads | partial (Graph API test users) | sandbox where possible, contract mocks otherwise |
| Google Ads | yes (test manager account) | sandbox |
| TikTok Ads | yes (sandbox) | sandbox |
| LinkedIn Ads | no real sandbox | contract mocks + nightly canary against a dummy live account |
| RevTry | yes (staging tenant) | staging |
| SendGrid | yes (sandbox flag) | sandbox |
| Twilio | yes (test credentials) | sandbox |
| ElevenLabs | no sandbox | contract mocks + cost-capped live canary |
| Flux | no sandbox | contract mocks + cost-capped live canary |
| Runway | no sandbox | contract mocks + cost-capped live canary |

**Contract mocks:** lives in `packages/integrations/<provider>/__contracts__/`. The contract is a versioned JSON schema of every request/response the integration sends/receives, generated from real captured traffic (scrubbed) and reviewed when the provider releases a new API version. The mock layer (`@funnel/integration-test-server`) replays these contracts and verifies our outbound requests match the expected shape.

**Webhook replay testing:** for every webhook-emitting provider we maintain a corpus of real, sanitized webhook payloads at `packages/webhooks/__fixtures__/<provider>/*.json` covering at minimum: success, idempotent-replay, signature-invalid, malformed-body, out-of-order delivery, duplicate-event-id. Each payload is fed through the actual webhook handler against a test Postgres + Redis.

**Run trigger:**
- PR: mocked-only (~90 seconds).
- Nightly: full sandbox run against every provider (~25 minutes). Failures page the on-call.
- Pre-release: full sandbox run before any deploy that touches `packages/integrations/**`.

**Cost-capped live canaries** (ElevenLabs, Flux, Runway): a single small generation per nightly run, hard-budgeted at $0.50/provider/day via a circuit breaker that refuses to spend over budget. The canary asserts the response shape and approximate latency. If a provider raises prices and we'd exceed budget, the canary fails loudly rather than silently overspending.

#### A.1.3 End-to-End Tests

**Framework:** Playwright (TypeScript, Chromium + WebKit, mobile viewport for the funnel renderer).

**Required E2E flows** â€” these are the customer journeys we contractually guarantee:

1. **The 60-second journey:** signup -> onboarding wizard -> generate funnel -> publish -> first lead. Asserts time-to-publish < 60s in CI. Runs against a fixture set of "Plumber in Austin", "Yoga studio in Brooklyn", "B2B SaaS in SF" to catch vertical-specific regressions.
2. **The upgrade path:** free signup -> trigger Pro Boost CTA -> Stripe Checkout (test card) -> plan upgrade reflected in DB + UI -> paid-only features unlocked.
3. **The dunning path:** active sub -> Stripe webhook simulates failed payment -> retry schedule advances on fake clock -> suspension state -> successful retry -> full restoration.
4. **The data deletion path:** logged-in user requests deletion -> grace email sent -> fake clock advances 30 days -> purge job runs -> assertions that user row, generated assets, leads, embeddings, R2 objects, and analytics records are all gone or anonymized per the data-deletion spec.
5. **The custom domain path:** add domain -> CNAME instructions shown -> simulated DNS record -> SSL provisioning -> funnel serves on the new domain.
6. **The agent-block path:** generate with input that triggers Compliance ("guaranteed results") -> compliance block surfaces in UI with explanation -> user edits input -> regeneration succeeds.

**Run trigger:**
- PR: smoke set (flows #1 and #2) â€” ~3 minutes.
- Every deploy to staging: full set â€” ~12 minutes.
- Nightly against production: read-only subset (synthetic monitoring).

**Data isolation:** every E2E test runs in its own tenant created in `beforeAll` and torn down in `afterAll`. Tests share zero state. Test tenants are tagged with `e2e_run_id=<uuid>` and a nightly sweep deletes any tenant older than 24h that still carries that tag (safety net against flaky teardown).

**Flake policy:** a test that fails twice in a 7-day window on main is auto-quarantined (skipped with a tag, ticket auto-filed). The owner has 5 business days to fix or delete. No quarantined test stays in the suite longer than 10 business days.

#### A.1.4 Agent Regression Suite

This is unique to FunelAI and is the single most important quality gate after RLS. The four agents â€” **Compliance**, **Fact-Check**, **Brand Guard**, **QA** â€” interact, and a change to any one of them can silently degrade the others.

**Corpus:** `eval/agents/corpus/`
- 100 known-good generation inputs with the expected pass-through outputs (or, where exact match is impossible, a Claude-as-judge rubric pinned to a model snapshot).
- 100 known-bad inputs covering: disallowed claims, FTC + Meta + Google + TikTok policy violations, factually false claims, brand-voice violations, low-quality QA failures, prompt-injection attempts, jailbreaks, multi-language hostile inputs.

**Format:** each case is a YAML file with `input`, `expected_verdict` (pass | block | rewrite), `expected_violations` (list of rule IDs), and `notes`.

**Run trigger:** any PR that touches `packages/agents/**` or any prompt under `prompts/`. Also nightly.

**Pass criteria:**
- Zero regression on known-good (a previously-passing input cannot suddenly be blocked).
- Zero regression on known-bad (a previously-blocked input cannot suddenly pass).
- New diffs require a human reviewer to approve in the PR. The CI bot posts a table of "newly blocked" and "newly allowed" cases.

**Model version pinning:** the regression suite pins exact model snapshots (e.g. `claude-opus-4-7@20260201`) so a silent provider rollout cannot break the suite. Model upgrades are explicit PRs that update the pin and update the corpus baseline together.

#### A.1.5 Load Tests

**Tool:** k6 (preferred â€” JS scripts, prom output) with Artillery as fallback for the WebSocket-heavy generation status stream.

**Scenarios** â€” each must pass at **5x expected launch traffic**:

| Scenario | Target | Pass criteria |
|---|---|---|
| Funnel Grader API | 10,000 simultaneous requests | p95 < 800ms, error rate < 0.1% |
| Generation queue | 500 in-flight jobs | no queue starvation, p95 wall-clock < 45s, no cost circuit-breaker trips |
| Lead capture spike | 1,000 leads in 60s on a single funnel | zero loss, p99 form-submit < 500ms, SMS auto-reply within 10s |
| RevTry dial spike | 200 dials queued in 30s | RevTry-side p95 dial-initiated < 60s, zero dropped from our side |
| Funnel rendering | 50,000 RPS sustained for 10 min | Worker CPU < 70%, cache hit rate > 95%, no R2 throttling |

**Run trigger:** weekly on Sunday 03:00 UTC against a load-test environment that mirrors production capacity. Also manually before any Major Feature launch (see Part B release cadence).

**Reports:** k6 output -> Prometheus -> Grafana "Load Test" dashboard. Each run produces a comparison vs. the previous run. Regressions > 20% in any p95 page the perf-lead.

#### A.1.6 Security Tests

Three layers:

1. **Automated SAST/DAST in CI** â€” Semgrep (with custom Funnel ruleset for tenant-id leakage, raw SQL, missing RLS), `npm audit` + Snyk on dependencies, OWASP ZAP baseline scan against preview environments.
2. **Targeted security tests in the regular test suite** â€” explicit Playwright + Vitest tests for:
   - SQLi probes across every search/filter input.
   - XSS probes across every rich-text + user-supplied content rendering point.
   - CSRF on every state-changing endpoint (verify the SameSite + token defense).
   - IDOR: brute-force URL ID enumeration across tenant boundaries. The test creates Tenant A + Tenant B, captures every public-looking ID from A's session, then asserts B's session gets 404/403 on every one.
   - Permission escalation: low-privilege user attempting every admin endpoint.
3. **External pen test** â€” monthly automated scan via a contracted firm, plus a quarterly manual deep pen test. Findings get tracked in `security/findings/` with severity, owner, deadline.

**Run trigger:** layers 1 + 2 on every PR. Layer 3 on cadence.

#### A.1.7 Accessibility Tests

- **axe-core** wired into every Playwright spec via `@axe-core/playwright`. Each page-level test asserts zero serious or critical violations. Moderate violations file an a11y ticket but don't fail the build.
- **Lighthouse CI** runs on every PR against preview environments. Score floors:
  - Performance: 85 on mobile, 95 on desktop.
  - Accessibility: 95.
  - Best Practices: 95.
  - SEO: 95 on public marketing + funnel renderer pages.

Below-floor scores block merge. Engineers can request a budget waiver from the perf-lead, recorded in `tooling/lighthouse/waivers.yaml` with an expiry date.

#### A.1.8 Performance Budgets

Budgets are encoded in `tooling/perf-budgets.yaml`, asserted in CI via Lighthouse + synthetic monitoring, and surfaced on the Grafana "SLO" dashboard.

| Metric | Budget | Measured where |
|---|---|---|
| Page load (LCP) | < 1.5s p75 (mobile, 4G throttle) | Lighthouse CI + RUM |
| TTFB | < 300ms p75 | RUM + Cloudflare analytics |
| Generation wall-clock | < 30s p95 | OTel span `generation.total` |
| RevTry first-dial latency | < 60s p95 | OTel span `revtry.dial.latency` |
| Funnel renderer edge response | < 100ms p95 cached, < 400ms p95 uncached | Cloudflare analytics |
| Lead capture form submit | < 500ms p95 | RUM |
| Stripe webhook ingest -> state update | < 2s p95 | OTel span |

Budget regressions on main page the perf-lead via Slack and open a ticket. Two consecutive weeks of regression escalate to a perf-fix sprint.

### A.2 CI Integration

**Every PR runs (parallel where possible):**

1. `pnpm lint` (eslint + prettier check)
2. `pnpm typecheck` (tsc --noEmit on all packages)
3. `pnpm test:unit:ci` with coverage report uploaded to Codecov
4. `pnpm test:integration:mocked`
5. `pnpm test:e2e:smoke` against the PR's preview deploy
6. `pnpm lighthouse:ci` against the preview deploy
7. `pnpm test:a11y` (axe inside Playwright)
8. Semgrep + Snyk

Wall-clock target: < 8 minutes from "PR pushed" to "all checks green" at p75. Anything slower is a perf-team problem.

**Pre-merge gate (enforced by GitHub branch protection):**

- All checks green.
- 80% coverage maintained on critical-path files (Codecov status check).
- At least one human approval from a code-owner of every modified package.
- No unresolved comments.
- PR linked to a Linear ticket (enforced by the linear-ci bot).
- Conventional commit title (enforced by commitlint).

**Post-merge to main:**

- Full E2E suite against staging.
- Full integration suite against provider sandboxes.
- Deploy to canary if all green (see Part B).

**Weekly (Sunday 03:00 UTC):**

- Load test full battery.
- Full dependency audit + outdated report.
- Stale-flag report.

**Failed tests block deploy.** No exceptions. A red main is a Sev-2 incident â€” the merger fixes or reverts within 30 minutes.

---

## PART B â€” CI/CD Pipeline

### B.1 Source Control

- **Host:** GitHub, single monorepo `funnel-ai/funnel`, pnpm workspaces.
- **Default branch:** `main`. Protected. No direct pushes. Force-push disabled. Linear history enforced (rebase-merge or squash-merge only).
- **Code review:** required, minimum one approval from a code-owner. Code-owners defined in `.github/CODEOWNERS` per package. Self-approval forbidden.
- **PR size guideline:** aim for < 400 net lines changed. PRs > 800 lines require a second reviewer and a paragraph in the description explaining why a split wasn't possible.
- **Commit signing:** all commits to main must be signed (GPG or SSH). Enforced by branch protection.
- **Conventional commits:** commitlint enforces the conventional commit spec on PR titles. The squash commit message uses the PR title, so this directly drives the auto-generated changelog.
- **Branching model:** trunk-based. Short-lived feature branches. No long-lived release branches. Hotfix branches live < 24 hours.

### B.2 Environments

Four environments, four DNS namespaces, four Cloudflare projects, four Postgres clusters. No environment cross-talk. Secrets per environment in Cloudflare Secrets + 1Password. No secret is shared across environments.

| Env | URL pattern | Database | Data | Who deploys |
|---|---|---|---|---|
| Local | localhost:3000 | docker-compose Postgres | seed fixtures | each engineer |
| Preview | `<branch-slug>.preview.funelai.com` | shared preview cluster, schema-per-PR | anonymized seed | auto on PR open |
| Staging | `staging.funelai.com` | dedicated cluster, prod-mirror schema | nightly anonymized prod copy | auto on merge to main |
| Production | `funelai.com` + `app.funelai.com` + `*.funnels.live` | prod cluster (multi-AZ) | real | gradual rollout (see B.3) |

**Local dev:** `pnpm dev` boots Next, Workers (via `wrangler dev`), Postgres, Redis, MinIO (R2 stand-in), and a `mock-integrations` server replaying contract fixtures. First-run takes < 5 minutes from clean clone.

**Preview environment:**
- Created automatically by a GitHub Action on PR open. Torn down on PR close or after 7 days of inactivity.
- Each preview gets its own Postgres schema (not its own cluster) inside the shared preview cluster, seeded from `seed/anonymized.sql.gz`.
- Each preview gets its own Worker, its own KV namespace, and a scoped R2 bucket prefix.
- Each preview is gated by Cloudflare Access â€” must be authenticated as a FunelAI engineer or guest reviewer.
- Preview URLs are commented on the PR by a bot, along with login credentials for a seeded admin + member user.

**Staging:**
- Production-mirror infrastructure (same Worker config, same Postgres version, same Redis version, same R2 region).
- Data refreshed nightly via the `staging-refresh` job: `pg_dump prod | anonymize | psql staging`. Anonymization rules in `tooling/anonymizer/rules.yaml` â€” every PII column is rewritten with deterministic faker (so foreign keys stay valid). The job is idempotent and runs at 02:00 UTC.
- Used by QA, customer support runbook drills, and pre-release manual acceptance.
- Public read-only status accessible to investors / pilot customers via `staging.funelai.com/demo` (separate tenant, hand-curated).

**Production:**
- Multi-region for the renderer (Cloudflare's edge â€” every PoP).
- Single primary Postgres in us-east-1 with read replicas in us-west-2 and eu-west-1.
- R2 buckets in `auto` location with replication policies for compliance-sensitive data (per data-residency spec).

### B.3 Deployment

#### B.3.1 Cloudflare Workers â€” gradual rollout

Every production deploy goes through the same four-stage rollout, gated on automated health checks.

```
deploy v(N) -> 1% -> 10% -> 50% -> 100%
                  5m     5m    10m    10m    (= 30 min total)
```

Rollout is driven by Cloudflare's gradual deployments feature plus a custom `funnel-rollout` GitHub Action that:

1. Deploys v(N) as a new version, routed to 1% of traffic.
2. Waits 5 minutes, querying Prometheus + Sentry for:
   - Error rate on v(N) vs. v(N-1) baseline.
   - p95 latency on v(N) vs. baseline.
   - Generation success rate.
   - Webhook delivery success rate.
3. **Automatic rollback** if any of these breach during the rollout window:
   - Error rate on v(N) > 0.5% absolute, **or** > 2x v(N-1).
   - p95 latency on v(N) > 2x baseline.
   - Critical span error budget (generation, billing, webhooks) breached.
   - Smoke synthetic on production fails 3 consecutive runs.
4. If healthy, advances to the next stage. If unhealthy, routes 100% back to v(N-1), files an incident, pages the on-call.

The 1% stage routes specifically to a cohort tagged `canary=true` rather than uniformly random â€” these are internal team tenants + a hand-picked set of pilot customers who've opted in to early bits. This catches workflow regressions that uniform random sampling misses.

#### B.3.2 Database migrations

**Tooling:** Prisma Migrate, with a custom wrapper `pnpm migrate:apply` that enforces our policies.

**Forward-compatible rule:** the migration ships before the code that uses it. Concretely, a schema-changing PR is split:

1. PR(N): add new column / table / index. Code does not yet read or write it. Merges and deploys.
2. PR(N+1): code reads + writes the new schema. Merges and deploys.
3. PR(N+2) (only after â‰¥ 30 days): drop old column / table.

**Backward-compatible rule:** within a 30-day window after a release, no destructive drops. `DROP COLUMN`, `DROP TABLE`, `DROP INDEX`, type narrowing, and `NOT NULL` constraint additions on existing columns are all "destructive" under this rule.

**Pre-flight check:** every migration PR runs the migration against a fresh restore of the previous-night staging dump in CI. The CI step measures wall-clock time and reports it; migrations expected to take > 30s on production must use `CREATE INDEX CONCURRENTLY`, batched updates, or `pg_repack`-style offline maintenance â€” never a long-locking statement on the hot path.

**RLS migrations:** any migration that adds/modifies an RLS policy requires a paired test in the same PR (see Part A.1.1). The CI step fails if the policy file changed but the test file didn't.

**Rollback:** every migration ships with a tested `down.sql`. The down migration is verified in CI by running `up; down; up` and asserting the schema is identical to baseline.

#### B.3.3 Static assets

- All static assets (JS bundles, CSS, fonts, images, generated funnel templates) are content-hashed at build (`asset.<hash>.<ext>`).
- Uploaded to R2 with `Cache-Control: public, max-age=31536000, immutable`.
- Served via Cloudflare CDN with a worker route that maps `/static/*` to the R2 bucket.
- Old versions retained for 30 days after a new deploy to handle in-flight sessions referencing old asset URLs. After 30 days a cleanup job purges them.

#### B.3.4 One-click rollback

For every deploy we tag the previous version in Cloudflare and keep it warm. The `funnel-rollback` action takes a single argument (the target version) and:

1. Reroutes 100% of traffic to the target version in < 30 seconds.
2. Posts a notice to `#ops`.
3. Files an incident.

End-to-end "I noticed a problem -> traffic is on the previous version" target: **60 seconds**.

Database migrations are *not* rolled back automatically â€” see B.3.2. Because we deploy forward-compatibly, the previous code version is always compatible with the current schema, so a code-only rollback is always safe.

### B.4 Feature Flags

**Tool:** OpenFeature SDK with a LaunchDarkly provider. We chose LaunchDarkly for the launch year for its UI maturity; OpenFeature keeps us provider-portable.

**Mandatory flag coverage:**
- Every agent prompt change.
- Every billing rule change (new plan, new dunning step, new pricing tier, currency change).
- Every new external integration.
- Every new top-level UI surface.
- Every schema-touching feature.

**Three flag types:**

| Type | Use | Default lifetime | Owner |
|---|---|---|---|
| **Release flag** | Gradual exposure of a finished feature | 30 days | feature owner |
| **Kill switch** | Instant disable of a risky path during incidents | indefinite | platform team |
| **Experiment flag** | A/B test with a measurement plan | tied to experiment, max 60 days | growth team |

**Naming:** `<type>.<area>.<feature>`, e.g. `release.agents.new-fact-check-v2`, `killswitch.billing.paypal`, `experiment.funnel.hero-cta-variant`.

**Flag debt:**
- A weekly job (`flag-audit`) reports every flag older than 90 days. Each one needs a justification or a cleanup PR within 14 days.
- Flags older than 180 days without justification are auto-converted to a "scheduled removal" ticket assigned to the owning team's lead.
- The audit report is posted to `#eng-leads` every Monday 09:00 UTC.

**Flag changes are deploys:** flipping a flag in production is logged to the audit trail with actor + reason. Killswitch flips page the on-call (so an incident-mode flag flip is always visible).

### B.5 Release Cadence

**Continuous deploy** is the default. Any merge to main that passes the pipeline reaches 100% of production within ~45 minutes (8 min CI + 30 min rollout + buffer).

**Two exceptions:**

1. **Major Feature launches** â€” anything tagged `release-type: major` in the PR (new vertical, new integration, plan structure change, agent overhaul) requires a launch-readiness scorecard signed off before the rollout starts. The scorecard lives at `docs/launch-readiness.md` and covers: dashboards built, alerts configured, on-call briefed, runbook written, kill switch in place, rollback plan documented, customer comms drafted, support team briefed, load test passed, security review signed off.
2. **Schema migrations affecting hot tables** â€” paused during peak traffic windows (defined as 09:00â€“22:00 in any of US-East, US-West, EU-West, regardless of which region the migration runs in). Off-peak deploy window only.

**Weekly release notes** are auto-generated from conventional commit messages by the `release-notes` action every Friday at 18:00 UTC. The bot posts a draft to `#release-notes` for the eng-lead-on-duty to edit, then publishes to:

- Internal: `#all-hands` Slack channel.
- External: `changelog.funelai.com` (public), `funnel-ai/changelog` email list.

**Customer-impacting changes** (new pricing, breaking API change, deprecated feature) follow the customer-comms playbook and are never bundled into the auto-generated notes.

### B.6 Hotfix Path

For Sev-1 or Sev-2 incidents requiring a code change:

1. Branch from the current production tag, not from main (main may contain undeployed work).
2. Apply the minimal fix.
3. Open a hotfix PR. CI runs the full unit + integration-mocked + smoke E2E suite â€” the long-tail tests are skipped to save time. Allowed only with the `hotfix` label.
4. Deploy to staging for a 15-minute smoke window (real synthetic monitoring against staging plus a human smoke check by the incident commander).
5. Deploy to production via the standard gradual rollout but compressed (1% -> 100% over 10 minutes instead of 30) â€” guarded by the same automated health checks.
6. Forward-merge the hotfix branch back into main immediately. No exceptions.
7. **Post-incident review** within 48 hours, written up in `incidents/<date>-<slug>.md`. Required sections: timeline, root cause, customer impact, what worked, what didn't, action items with owners + deadlines.

Hotfixes that bypass any step above are themselves a Sev-2 incident the next business day.

---

## PART C â€” Observability

The observability stack is intentionally boring. Boring tools mean engineers stay paged, not paging themselves to debug the monitoring.

### C.1 Stack

| Layer | Tool | Why |
|---|---|---|
| Metrics | Prometheus (managed via Grafana Cloud) | Standard, push gateway works with Workers, cheap |
| Dashboards | Grafana (Grafana Cloud) | Co-located with metrics |
| Errors | Sentry | Best DX, deep stack traces, source-mapped, performance tab |
| Tracing | OpenTelemetry -> Honeycomb | Honeycomb's BubbleUp is invaluable for AI pipelines |
| APM | Honeycomb (primary) + Datadog APM (fallback for non-trace queries) | Honeycomb for the AI pipeline; Datadog APM kept warm as a backup but not load-bearing |
| Logs | Datadog Logs | Pairs cleanly with Datadog APM for the cases we use it |
| RUM | Cloudflare Web Analytics + Sentry Browser SDK | Cloudflare for aggregate, Sentry for per-session traces |
| Synthetic monitoring | Checkly | Multi-region scripted browser + API checks |
| Status page | statuspage.io | Public, integrates with Slack incident tooling |

**Why two tracing tools sound:** Honeycomb is primary because the generation pipeline is "wide events" territory and BubbleUp is the right tool for "why are some generations slow." Datadog is kept around because some teams reach for traditional APM views; we re-evaluate at month 6 whether to consolidate.

**Cost discipline:** all observability tools are budgeted in the cost-governor doc. Sampling is aggressive on hot paths (head-based sampling at 5% for funnel-render spans, 100% for billing + agent spans). Tail-based sampling at the OTel Collector keeps every errored or slow trace.

### C.2 Instrumentation Standards

- **Every service exposes** `/healthz` (liveness, no deps) and `/readyz` (readiness, checks DB + Redis).
- **Every external call** (Stripe, Meta, Claude, OpenAI, RevTry, etc.) is wrapped in an OTel client span with attributes: `provider`, `endpoint`, `tenant_id` (hashed), `cost_usd` (where applicable), `tokens_in`, `tokens_out`, `cache_hit`.
- **Every agent invocation** is its own span with: `agent.name`, `agent.version`, `agent.model`, `agent.tokens_in`, `agent.tokens_out`, `agent.cost_usd`, `agent.verdict`, `agent.violations` (array).
- **Every webhook receipt** is its own span with: `provider`, `event_type`, `event_id`, `signature_valid`, `idempotent_hit`.
- **Every queue job** carries trace context across the Redis boundary so the producer span and consumer span are linked.
- **No PII in spans or logs.** Tenant IDs and user IDs are hashed via `hash(salt + id)` where the salt is per-environment. The reverse lookup is only available to engineers with the `pii-lookup` role and is audited.
- **Every log line** is structured JSON: `timestamp`, `level`, `service`, `trace_id`, `span_id`, `tenant_id_hash`, `message`, plus context fields. No free-form `console.log` reaches production.

### C.3 Mandatory Dashboards (built before Day 90)

Every dashboard lives in `observability/dashboards/<name>.json` and is provisioned by the `grafana-sync` GitHub Action â€” dashboards are code, not click-ops. Ownership column = team responsible for keeping it green.

| Dashboard | Key panels | Owner |
|---|---|---|
| **Generation pipeline** | Latency per agent (p50/p95/p99), cost per generation, quality score distribution, regeneration rate, compliance block rate, fact-check rewrite rate, brand-guard rewrite rate, queue depth, queue age, agent error rate by model | AI team |
| **Funnel rendering** | Edge response time per PoP, cache hit rate, custom-domain SSL provisioning success rate, 5xx rate, R2 throughput, Worker CPU + memory | Platform team |
| **Lead capture** | Form-submit latency, SMS auto-reply latency, RevTry dial latency p50/p95, lead-to-CRM sync success rate per integration, failed-sync queue depth | Growth team |
| **Billing** | Subscription state distribution (active/grace/suspended/cancelled), dunning step completion funnel, webhook delivery rate per provider, reconciliation discrepancy count, MRR estimate, churn rate, failed-payment volume | Billing team |
| **Integration health** | Per-provider availability, rate-limit headroom %, error rate, retry success rate, p95 latency, webhook lag | Integrations team |
| **Activation funnel** | Signups -> first-generation -> publish -> first-lead -> paid, by cohort, by acquisition source, conversion rate at each step, time-to-step distribution | Growth team |
| **Cost** | Daily spend by category (compute, storage, AI providers, voice, SMS, email), anomaly bands, per-tenant outlier list, projected month-end | Finance + Platform |
| **SLO** | Live SLO burn rate for each public SLA + perf budget. Highlighted red if 30-day budget is more than 50% consumed | Platform team |

Every dashboard has a `?env=` template variable and works for `preview`, `staging`, and `production`.

### C.4 Service Level Agreements

Publicly committed on `funelai.com/sla` and on `status.funelai.com`. SLA = customer-facing promise; SLO = internal target, set tighter than the SLA so we have headroom.

| Service | SLA | SLO | Error budget (30d) |
|---|---|---|---|
| Funnel rendering | 99.9% | 99.95% | 21.6 min |
| Generation engine | 99.5% | 99.7% | 3h 36m |
| Ad publishing | 99% | 99.3% | 7h 12m |
| RevTry voice | 99.5% (joint with RevTry) | 99.7% | 3h 36m |

**Why funnel rendering is 99.9%:** every minute of downtime is leads our customers do not receive. This is the contractual core promise. Renderer code paths must be ruthlessly simple â€” no DB read on the hot path, everything served from edge KV + R2.

**Ad publishing has the lowest SLA** because we depend on third-party APIs (Meta, Google, TikTok, LinkedIn) whose own availability is below 99%. We make this explicit to customers.

**SLO burn:** when a 30-day error budget hits 50% consumed, we freeze non-critical deploys in that service area until it recovers. Tracked on the SLO dashboard.

### C.5 Alerting

**Page on-call (PagerDuty, 24/7):**

| Condition | Threshold | Why |
|---|---|---|
| Error rate (any service) | > 1% for 5 min | Customer-visible failure |
| Latency p95 (any service) | > 2x baseline for 10 min | Customer-visible degradation |
| Queue depth (generation) | > 10,000 jobs | Backlog forming, will compound |
| Payment webhook failure rate | > 5% for 15 min | Revenue at risk |
| Generation cost | > 1.5x daily budget | Abuse or runaway loop |
| Funnel renderer 5xx | > 0.1% for 2 min | Tightest SLA, lowest tolerance |
| RevTry connectivity | down for 2 min | Voice SLA |
| RLS audit anomaly | any cross-tenant query detected | Security boundary breach |
| Database primary CPU | > 80% for 10 min | Capacity risk |
| Redis memory | > 85% | Queue at risk |

**Slack `#ops`:**
- All warnings (50-80% of page thresholds).
- Daily 09:00 UTC summary: deploys, incidents, SLO burn, top errors, cost.
- Every deploy event.
- Every feature flag flip.

**Email only:**
- Weekly trend report (Mondays).
- Monthly reliability + cost report.
- Weekly stale-flag report.

**Alert hygiene:**
- Every paging alert has a runbook linked in the alert payload (`runbooks/<alert>.md`).
- Every alert that fires more than 3 times in 30 days without being a real incident is reviewed by the platform team â€” either tighten the alert or fix the underlying flake.
- The "alert review" is a weekly 30-min meeting; the agenda is auto-generated from PagerDuty + alert history.

**On-call rotation:**
- Weeks 1â€“4 of launch: rotation among the four founders, one-week shifts.
- Month 2â€“5: rotation expands to all engineers comfortable with the stack, one-week shifts, secondary on-call always paired with primary.
- Month 6+: dedicated SRE hired and joins the rotation. SRE owns the alerting hygiene + runbooks.
- Rotation managed in PagerDuty. Compensation per on-call shift per the people-ops doc.
- A pager during business hours gets a 5-min response target; after-hours 15-min response target.

### C.6 Status Page

**URL:** `status.funelai.com`, public, hosted on statuspage.io.

**Components:**

- Generation
- Publishing
- Billing
- RevTry (voice)
- Email (SendGrid)
- SMS (Twilio)
- Admin (app.funelai.com)
- API

Each component's status is driven *automatically* by the SLO dashboard â€” a component goes yellow when its 1-hour error rate exceeds 5x its 24h baseline, and red when an incident is declared. Manual override available to the incident commander.

**Incident posts:** required within 15 minutes of a Sev-1 or Sev-2 incident, updated every 30 minutes until resolved, with a post-mortem link added within 5 business days.

**Subscribers:** email + SMS + webhook + Atom feed. The customer success team is automatically subscribed.

**History:** 12 months retained, publicly browsable. We do not edit history â€” corrections happen as updates to the original post.

### C.7 Cost Monitoring

**Daily cost report** is generated at 08:00 UTC, posted to `#cost`, and broken down by:

- Compute (Cloudflare, any non-Workers compute).
- Storage (R2, Postgres, Redis).
- AI providers (Claude, OpenAI, ElevenLabs, Flux, Runway) â€” split by tenant cohort.
- Voice (RevTry).
- SMS (Twilio).
- Email (SendGrid).
- Observability tools (Sentry + Honeycomb + Datadog + Grafana Cloud).
- Other SaaS (LaunchDarkly, statuspage.io, etc.).

**Anomaly detection:** spend > 1.5x the 7-day moving average in any category fires a Slack alert; > 2x pages the on-call (this catches runaway-loop generation bugs, prompt-injection abuse, and ad-spend mistakes within an hour rather than at month-end).

**Per-account guardrails:** each tenant has a daily generation-cost ceiling, daily voice-minute ceiling, and daily SMS ceiling per the cost-governor doc (`07-cost-governor.md`). The guardrails are enforced inside the agent orchestrator (hard refuse + user-visible message) rather than at the bill cycle (silently absorb). Tripping a guardrail emits a metric and a Slack notice in `#cost`.

**Per-tenant outlier list:** the daily report surfaces the top 10 tenants by spend, with a comparison to their 30-day average. The growth team reviews this for abuse patterns and for early signs that a free-tier user should be sold an enterprise tier.

### C.8 Capacity Planning

- **Quarterly capacity review** (last Friday of each quarter). Platform team produces a memo covering:
  - Current headroom on every constrained resource: Postgres connections, Postgres CPU + IOPS, Redis memory + ops/sec, Cloudflare Worker invocations, R2 storage + ops, AI provider rate limits, voice channel concurrency, SMS throughput per long code / short code / toll-free.
  - 90-day forecast based on the actual growth curve from the activation funnel dashboard.
  - Items breaching forecast.
- **Provider escalations:** for any limit forecast to breach within 60 days, the platform lead opens a rate-limit-increase ticket with the provider that quarter, not the quarter the breach is forecast for. Providers reliably take 4â€“6 weeks for non-trivial limit increases.
- **Pre-launch capacity bake:** in the two weeks before Day 90, we run the load-test battery (Part A.1.5) every weekday morning and review the deltas. Any regression vs. the prior day blocks the launch checklist item.

---

## Appendix: Where to find things

| Thing | Path |
|---|---|
| Coverage allow-list | `tooling/coverage/critical-paths.json` |
| Perf budgets | `tooling/perf-budgets.yaml` |
| Lighthouse waivers | `tooling/lighthouse/waivers.yaml` |
| Anonymizer rules | `tooling/anonymizer/rules.yaml` |
| Agent regression corpus | `eval/agents/corpus/` |
| Integration contracts | `packages/integrations/<provider>/__contracts__/` |
| Webhook fixtures | `packages/webhooks/__fixtures__/<provider>/` |
| Runbooks | `runbooks/<alert>.md` |
| Incident write-ups | `incidents/<date>-<slug>.md` |
| Launch readiness scorecard | `docs/launch-readiness.md` |
| Dashboards (as code) | `observability/dashboards/*.json` |
| Secrets index | 1Password vault `funnel-ai-engineering` |
| Cost governor | `funnel-ai-docs/07-cost-governor.md` |
| Data deletion | `funnel-ai-docs/<data-deletion-spec>` |

## Appendix: Open items for review

- Confirm Honeycomb vs. Datadog APM after 90 days â€” consolidate if Datadog APM hasn't earned its keep.
- Decide between LaunchDarkly and a self-hosted OpenFeature backend at month 9 based on cost.
- Decide whether to bring SRE in-house or contract via a managed-SRE vendor for months 4-6 before the full-time hire.
