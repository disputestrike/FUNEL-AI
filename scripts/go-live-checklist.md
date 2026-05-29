# GoFunnelAI — Go-live checklist

Walks through every external provider you need an account with and every
Railway-side step required to flip the public domain. Tick items off in
order — later steps depend on earlier ones.

> Cross-references:
> - Infra runbook: `../infrastructure/railway/setup.md`
> - Env vars: `../infrastructure/railway/env-template.txt`
> - Pre-flight gate: `./verify-railway-ready.sh`

---

## 0. Code is ready to deploy

- [ ] `bash scripts/verify-railway-ready.sh` exits 0 ("READY FOR RAILWAY DEPLOY").
- [ ] `pnpm test && pnpm lint && pnpm typecheck` all green.
- [ ] Backward-compat check: no migration in the last 30 days drops a
      column, drops a table, or narrows a type (see doc 08 release policy).

---

## 1. Provider accounts

Sign-up URL + what to grab once you're in:

| Provider                | Why                                  | URL                                          | Grab                                                              |
| ----------------------- | ------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| Anthropic               | Primary LLM (Claude)                 | https://console.anthropic.com                | `ANTHROPIC_API_KEY`                                               |
| OpenAI                  | Realtime API + LLM fallback          | https://platform.openai.com                  | `OPENAI_API_KEY`                                                  |
| Together                | Llama 3 fallback                     | https://api.together.xyz                     | `TOGETHER_API_KEY`                                                |
| Replicate               | Image + video gen (Flux/Ideogram/Runway) | https://replicate.com                    | `REPLICATE_API_TOKEN`                                             |
| ElevenLabs              | TTS                                  | https://elevenlabs.io                        | `ELEVENLABS_API_KEY`                                              |
| RevTry                  | AI voice agent                       | https://revtry.ai                            | `REVTRY_API_KEY`                                                  |
| Cloudflare R2           | S3-compatible storage                | https://dash.cloudflare.com â†’ R2             | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`       |
| Resend                  | Transactional email (primary)        | https://resend.com                           | `RESEND_API_KEY`, verified domain (DKIM + SPF on `gofunnelai.com`)     |
| SignalWire              | SMS + voice (Twilio-compatible)      | https://signalwire.com                       | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_AUTH_TOKEN`, `SIGNALWIRE_SPACE_URL`, purchased E.164 number |
| PayPal                  | Subscriptions (primary)              | https://developer.paypal.com                 | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, webhook ID            |
| Stripe                  | Billing + Tax (secondary)            | https://dashboard.stripe.com                 | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, webhook secret     |
| Clerk                   | Auth (initial)                       | https://clerk.com                            | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, webhook secret       |
| Sentry                  | Errors + tracing                     | https://sentry.io                            | `SENTRY_DSN`                                                      |
| Meta (Facebook)         | OAuth + ad integration               | https://developers.facebook.com              | `META_APP_ID`, `META_APP_SECRET`                                  |
| Google Cloud            | OAuth + Google Ads                   | https://console.cloud.google.com             | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`            |
| TikTok                  | TikTok Ads OAuth                     | https://ads.tiktok.com/marketing_api/        | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`                              |
| LinkedIn                | LinkedIn Marketing OAuth             | https://www.linkedin.com/developers          | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`                    |
| X (Twitter)             | X Ads OAuth                          | https://developer.twitter.com                | `X_API_KEY`, `X_API_SECRET`                                       |

Tick off each row once you've copied the secret into your secret-manager
of choice (1Password vault, AWS Secrets Manager, etc.). Never paste raw
values into the repo or chat.

- [ ] All providers above provisioned.
- [ ] Domain `gofunnelai.com` owned + DNS edit access available.
- [ ] DKIM, SPF, DMARC records added for Resend on `gofunnelai.com`.

---

## 2. Railway project

- [ ] Railway account created (Pro plan — required for daily backups + private networking).
- [ ] GitHub repo `funnel-ai` connected to Railway.
- [ ] Project created (recommended name: `funnel-ai-production`).
- [ ] Environments `production` and `staging` created.
- [ ] Region selected (recommend `us-east` for primary).

---

## 3. Six services created

- [ ] `funnel-api` — root `/`, Dockerfile `apps/api/Dockerfile`, branch `main`.
- [ ] `funnel-web` — root `/`, Dockerfile `apps/web/Dockerfile`, branch `main`.
- [ ] `funnel-admin` — root `/`, Dockerfile `apps/admin/Dockerfile`, branch `main`.
- [ ] `funnel-grader` — root `/`, Dockerfile `apps/grader/Dockerfile`, branch `main`.
- [ ] `funnel-renderer` — root `/`, Dockerfile `apps/renderer/Dockerfile`, branch `main`.
- [ ] `funnel-workers` — root `/`, Dockerfile `apps/workers/Dockerfile`, branch `main`.

---

## 4. Postgres + Redis plugins

- [ ] Postgres plugin provisioned (`railway add --plugin postgres`).
- [ ] `CREATE EXTENSION vector;` executed via `railway connect postgres` (pgvector).
- [ ] Direct (unpooled) URL set as `DATABASE_URL_DIRECT` on `funnel-workers`.
- [ ] Daily backups enabled with 14-day retention.
- [ ] At least one restore test performed into a scratch project.
- [ ] Redis plugin provisioned (`railway add --plugin redis`).

---

## 5. Environment variables

- [ ] Shared project vars set per `infrastructure/railway/env-template.txt`
      section B (`NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, etc.).
- [ ] Per-service overrides set per section C.
- [ ] `bash scripts/env-check.sh production` reports zero missing keys.

---

## 6. Custom domains

- [ ] DNS records added:
  - [ ] `gofunnelai.com`, `www.gofunnelai.com`            â†’ funnel-web
  - [ ] `api.gofunnelai.com`                          â†’ funnel-api
  - [ ] `admin.gofunnelai.com`                        â†’ funnel-admin
  - [ ] `grade.gofunnelai.com`                        â†’ funnel-grader
  - [ ] `pages.gofunnelai.com` + `*.funnel.page` CNAME â†’ funnel-renderer
- [ ] Let's Encrypt certificates issued for all 5 (Railway handles automatically).
- [ ] HSTS + redirect-to-HTTPS verified on each.

---

## 7. First deploy

- [ ] `git push origin main` triggers `.github/workflows/railway-deploy.yml`.
- [ ] `funnel-api` deploys first; `preDeployCommand` runs `migrate-on-deploy.sh` successfully.
- [ ] Other services deploy in parallel and turn green.
- [ ] Smoke tests pass (`bash scripts/health-check.sh production`):
  - [ ] `GET https://api.gofunnelai.com/healthz` â†’ 200
  - [ ] `GET https://api.gofunnelai.com/readyz`  â†’ 200 (`db: true, redis: true`)
  - [ ] `GET https://gofunnelai.com/api/healthz` â†’ 200
  - [ ] `GET https://admin.gofunnelai.com/api/healthz` â†’ 200
  - [ ] `GET https://grade.gofunnelai.com/api/healthz` â†’ 200
  - [ ] `GET https://pages.gofunnelai.com/healthz` â†’ 200
  - [ ] (internal) `GET workers.railway.internal:8080/healthz` â†’ 200
- [ ] No Sentry errors in the first 15 minutes after deploy.

---

## 8. Post-deploy verification (manual)

- [ ] Sign up flow works end-to-end (Clerk widget â†’ email verification â†’ workspace created).
- [ ] Grader (https://grade.gofunnelai.com) renders a sample audit and emails the PDF.
- [ ] Renderer serves at least one published funnel page worldwide in <5s (test from US + EU + AU).
- [ ] BullMQ dashboard shows workers consuming from every queue (`railway logs --service funnel-workers`).
- [ ] PayPal sandbox checkout completes; webhook lands in `funnel-api` logs.
- [ ] Resend test email lands in inbox (not spam) with DKIM+SPF+DMARC pass.
- [ ] SignalWire test SMS delivers.

---

## 9. Cutover

- [ ] Update `gofunnelai.com` apex A/AAAA records to Railway's edge.
- [ ] Pre-warm Postgres with seed data (`pnpm db:seed`).
- [ ] Announce internally; flip "Generate" feature flag from staff-only to public.
- [ ] On-call rotation activated.

---

## 10. Day-2

- [ ] Sentry alert routing configured (PagerDuty / Opsgenie).
- [ ] Daily backup restore drill scheduled (first Monday of every month).
- [ ] Cost dashboard set (Railway â†’ Usage â†’ Set budget alert at $X).
- [ ] Doc 11 incident playbook reviewed with on-call.

---

If anything in sections 1–7 fails, run `bash scripts/rollback.sh production`
which redeploys the previous successful Railway deployment for every service.
