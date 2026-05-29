# GoFunnelAI Status

What is implemented in this repo today versus what still needs configuration or external work before launch.

## Complete (code in repo)

- **Monorepo** — Turborepo + pnpm workspace, 11 apps, 26 packages.
- **Brand single source of truth** — `packages/ui/src/brand/index.ts` exports `BRAND_NAME = 'GoFunnelAI'`, `BRAND_DOMAIN = 'gofunnelai.com'`, logo URLs, React `<Logo>`.
- **Database schema** — Prisma schema, migrations, RLS policies, seed scripts (`packages/db`).
- **Auth** — signup, login, MFA, sessions, SSO, workspace membership, API keys, admin role (`packages/auth`).
- **16-agent orchestrator** — planner → hook → page → lead magnet → image → video → ad copy → audience → email → sms → voice → upsell → fact-check → compliance → qa → brand guardian (`packages/agents`, `packages/orchestrator`).
- **Knowledge Base** — 30 vertical packs × geo × language, nightly ingestion, pgvector retrieval (`packages/kb`).
- **Native CRM + Lead Engine** — contacts, leads, pipelines, scoring, bookings, speed-to-lead enforcer (`packages/crm`).
- **Transactional email** — Resend-backed, 47 React Email templates, suppression list, audit log (`packages/email`).
- **Billing** — PayPal (primary) + Stripe (secondary), subscriptions, dunning, refunds (`packages/billing`).
- **RevTry voice agent** — outbound dialer, inbound handler, scripts, TCPA state rules, SignalWire telephony (`packages/revtry`).
- **Compliance** — regulated-vertical detection, audit log, AI disclosure, consent SDK, human review queue (`packages/compliance`).
- **Trust & Safety** — 10 risk-class classifiers, suspension workflow, transparency report (`packages/trust-safety`).
- **Cost Governor** — per-generation budgets, per-workspace ledger, graceful degradation (`packages/cost-governor`).
- **Notifications** — in-app, email, push, SMS, Slack, Discord with retry+DLQ (`packages/notifications`).
- **Marketplace** — creator-economy templates, purchases, clones, reviews, payouts (`packages/marketplace`).
- **Academy, Awards, Affiliate, Challenge, Community, Activation** — viral-loop packages (`packages/{academy,awards,affiliate,challenge,community,activation}`).
- **PAL + integrations** — Meta, Google, TikTok, LinkedIn, X, Resend, SignalWire, PayPal, Stripe adapters (`packages/integrations`).
- **apps/web** — marketing site, signup, onboarding, dashboard, generation UI (206 source files).
- **apps/api** — Hono + tRPC v11 on Cloudflare Workers (75 source files).
- **apps/admin** — staff console for support, billing, queues, incidents, T&S (33 source files).
- **apps/renderer** — Cloudflare Worker that serves published funnel JSON as HTML.
- **apps/grader** — public funnel grader at gofunnelai.com/grade (62 source files).
- **apps/short-links** — `gofnl.co/[code]` redirect worker.
- **apps/workers** — long-running Node BullMQ worker service for Railway.
- **apps/extension, apps/shopify-app, apps/wordpress-plugin, apps/mobile** — channel surfaces.
- **E2E test** — `tools/testing/e2e/full-flow.spec.ts` Playwright happy path.
- **Smoke route script** — `scripts/smoke-routes.ps1` pings every public route.
- **CI/CD config** — `railway.json`, per-app `railway.toml` and `wrangler.toml`, `.github/` workflows.

## Needs configuration before launch

These have code, but require external accounts, secrets, or DNS:

- **Environment variables** — copy `.env.example` to `.env` and fill: Google OAuth client + secret, Anthropic API key, Replicate token, Resend API key + verified sending domain, SignalWire project + token + space URL, PayPal client + secret, Stripe secret key (optional), Sentry DSN, OpenAI key (fallback).
- **Postgres** — provision Neon or Railway Postgres, set `DATABASE_URL`, run `pnpm db:migrate` then `pnpm db:seed`.
- **Redis** — provision Upstash or Railway Redis for BullMQ (`REDIS_URL`).
- **Cloudflare** — create R2 bucket for image/video storage, set `R2_*` env, deploy `apps/renderer` and `apps/short-links` via `wrangler deploy`.
- **DNS** — point `gofunnelai.com`, `admin.gofunnelai.com`, `gofnl.co` at Railway / Cloudflare, set up Resend domain auth (SPF, DKIM, DMARC).
- **OAuth callbacks** — register `https://gofunnelai.com/api/auth/callback/google` with Google Cloud Console.
- **Webhook receivers** — register PayPal IPN, Stripe webhook secret, SignalWire status callback URLs against `/api/webhooks/*`.
- **Brand logos** — drop the three PNG variants in `packages/ui/src/brand/logos/` and run `scripts/install-logos.ps1`. Filenames are load-bearing (`funelai_primary_logo.png` etc.) — do not rename.
- **Sentry** — create project, set DSN per app.

## Needs work before launch (open)

- **CRM imports** — CSV/contact upload UI is stubbed in `apps/web/src/dashboard/crm/import` but not finished.
- **Mobile app store builds** — `apps/mobile` is a React Native scaffold; Xcode/Android Studio project files not committed.
- **WordPress plugin** — directory has assets and shim; full plugin zip + WP.org listing not in repo.
- **Live data verification** — `pnpm enterprise:preflight` should pass against a real staging environment; not yet exercised end-to-end here.

## Verification

```bash
# 1. Mojibake-free
pwsh -File scripts/fix-mojibake.ps1   # idempotent, should report 0 on a clean tree

# 2. Brand consistency
grep -r "MyFunnelAI\|myfunnelai\.com" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" .

# 3. Routes
pnpm dev                              # in one shell
pwsh -File scripts/smoke-routes.ps1   # in another

# 4. Full E2E
pnpm --filter @funnel/web exec playwright test tools/testing/e2e/full-flow.spec.ts
```
