# GoFunnelAI — Railway Deploy Guide

Step-by-step to get from GitHub repo → live `gofunnelai.com`.

---

## Prerequisites

- GitHub: `disputestrike/FUNEL-AI` repo (already pushed)
- Railway account
- Domain: `gofunnelai.com` registered (DNS pointing to Cloudflare recommended)
- All provider keys ready (list below)

---

## Step 1 — Create the Railway project

1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**
2. Pick `disputestrike/FUNEL-AI`
3. When Railway asks "which service to deploy?", **only pick `funnel-web`** for now. We'll add `funnel-workers` later.
4. **Wait** — let Railway provision the empty service. Don't click deploy yet.

---

## Step 2 — Add Postgres + Redis plugins (do this BEFORE first deploy)

In the project dashboard:

1. **+ New → Database → Add PostgreSQL** → Railway provisions a Postgres 16 instance and injects `DATABASE_URL` into every service.
2. **+ New → Database → Add Redis** → Railway provisions Redis 7 and injects `REDIS_URL`.

**Enable pgvector:**
1. Click the Postgres service → **Connect** tab → **psql command**
2. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

---

## Step 3 — Set env vars on `funnel-web`

Click `funnel-web` → **Variables** tab → paste these. Edit values to your real keys.

### Required (boot won't work without these)

```
NEXTAUTH_URL=https://<your-railway-url>.up.railway.app
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_TRUST_HOST=true
DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Auth (Google sign-in)

```
GOOGLE_CLIENT_ID=<from console.cloud.google.com>
GOOGLE_CLIENT_SECRET=<from console.cloud.google.com>
```

**Important:** in Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs, add:
- `https://<your-railway-url>.up.railway.app/api/auth/callback/google`
- `https://gofunnelai.com/api/auth/callback/google` (add now or later)

### AI generation

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
ELEVENLABS_API_KEY=...
```

### Stock fallbacks for images

```
UNSPLASH_ACCESS_KEY=...
PEXELS_API_KEY=...
```

### Voice (RevTry → SignalWire)

```
SIGNALWIRE_PROJECT_ID=...
SIGNALWIRE_API_TOKEN=...
SIGNALWIRE_SPACE_URL=<your-space>.signalwire.com
SIGNALWIRE_FROM_NUMBER=+1XXXXXXXXXX
```

### Email (Resend)

```
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
```

### Billing (PayPal primary, Stripe optional)

```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_ENV=sandbox    # change to "live" when ready
PAYPAL_PLAN_STARTER=P-...
PAYPAL_PLAN_GROWTH=P-...
PAYPAL_PLAN_AGENCY=P-...

STRIPE_SECRET_KEY=sk_test_...      # optional, for funnel checkout
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2024-09-30.acacia
```

### Storage (Cloudflare R2)

```
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=gofunnelai-assets
R2_PUBLIC_BASE_URL=https://cdn.gofunnelai.com
```

### Brand autofill (optional)

```
CLEARBIT_API_KEY=...
WHOISXML_API_KEY=...
```

### Observability (optional but recommended)

```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
```

### Misc

```
API_KEY_PEPPER=<run: openssl rand -hex 32>    # used to hash customer API keys
GOFUNNELAI_DATA_DIR=/data
```

**The full list is in `.env.example` at the repo root** — 89 lines.

---

## Step 4 — Configure the service build

Click `funnel-web` → **Settings** tab:

- **Root Directory:** `/` (leave empty or root)
- **Builder:** Docker (auto-detected from `apps/web/Dockerfile`)
- **Watch Paths:**
  ```
  apps/web/**
  packages/**
  pnpm-lock.yaml
  package.json
  ```
- **Pre-deploy Command:**
  ```
  pnpm --filter @funnel/db db:migrate:deploy
  ```
  (This runs Prisma migrations before the new container takes traffic.)
- **Healthcheck Path:** `/api/healthz`
- **Healthcheck Timeout:** `30`
- **Restart Policy:** `On failure`, max 10 retries
- **Node Version:** 20 (default)

---

## Step 5 — Deploy

Click **Deploy** on the service. First build takes ~5-8 minutes:
1. Build stage: `pnpm install` + `prisma generate` + `next build`
2. Pre-deploy: migrations run via `migrate-on-deploy.sh` (waits up to 60s for Postgres)
3. Container starts on the assigned Railway URL
4. Healthcheck pings `/api/healthz` until it returns 200

When the service goes green:
- Visit your Railway URL → marketing site loads
- Click "Sign in with Google" → auth flow completes → first sign-in auto-creates workspace
- You're in the dashboard

---

## Step 6 — Add `funnel-workers` (background jobs)

The web app handles user requests. Workers handle dunning, activation interventions, KB ingestion, reconciliation, RevTry call queue, etc. Without them, transactional emails and scheduled jobs don't fire.

1. In the same Railway project: **+ New → Empty Service** → name it `funnel-workers`
2. Connect to the same GitHub repo
3. Settings:
   - Builder: Docker, Dockerfile path: `apps/workers/Dockerfile`
   - Pre-deploy: (none — web service runs migrations)
   - Healthcheck path: `/healthz` (workers expose this on port 8080)
   - Replicas: 1 (scale later)
4. **Copy all the env vars from `funnel-web`** — workers need the same keys
5. Deploy

---

## Step 7 — Connect your domain

In Cloudflare:
1. Add `gofunnelai.com` zone
2. Point nameservers from your registrar to Cloudflare
3. Wait for activation

In Railway:
1. `funnel-web` → Settings → Networking → **+ Custom Domain**
2. Add `gofunnelai.com` → Railway gives you a CNAME target
3. Add `*.gofunnelai.com` for funnel subdomains (so customer funnels at `solar-phx.gofunnelai.com` route to the renderer — for V1, point them all to web)
4. Add the CNAME records in Cloudflare DNS
5. Wait ~30 sec for SSL provisioning

Update `NEXTAUTH_URL` env var to `https://gofunnelai.com` and redeploy.

Update Google OAuth redirect URI to include `https://gofunnelai.com/api/auth/callback/google`.

---

## Step 8 — Verify

Visit `https://gofunnelai.com`:
- [ ] Marketing pages render with GoFunnelAI logo
- [ ] Sign in with Google works → lands on `/welcome`
- [ ] `/dashboard` shows empty KPIs (no funnels yet)
- [ ] `/dashboard/command` chat interface loads
- [ ] Type "Build me a funnel for solar installers in Phoenix" → see streaming agents → preview appears
- [ ] Click Launch → publish → live funnel renders at `<slug>.gofunnelai.com`
- [ ] Submit form on live funnel → lead appears in `/dashboard/crm`

---

## Troubleshooting

### Build fails with "Cannot find module '@funnel/shared'"
The Dockerfile uses `pnpm install --filter @funnel/web...` (three dots). Verify `apps/web/Dockerfile` line 13 has that. The three dots include workspace deps.

### "Prisma Client not initialized"
Pre-deploy command must run. Check Settings → Pre-deploy is set to:
```
pnpm --filter @funnel/db db:migrate:deploy
```

### Migrations fail with "database does not exist"
Postgres plugin must be added BEFORE first deploy. If you added it after, click "Redeploy" on the web service.

### pgvector errors
Connect to Postgres and run `CREATE EXTENSION IF NOT EXISTS vector;`. Required for KB retrieval.

### Healthcheck timeout
The app takes ~15 seconds to boot cold. If Railway times out at 30 seconds, increase healthcheck timeout to 60 in Settings.

### Sign-in returns "configuration error"
Check `AUTH_SECRET` is set and at least 32 chars. Check `NEXTAUTH_URL` matches your actual Railway URL (no trailing slash).

### "Invalid redirect URI" from Google
Add the exact Railway URL + `/api/auth/callback/google` to Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs.

---

## What's NOT on Railway

These deploy elsewhere when you're ready:

- `apps/mobile` → App Store + Google Play (Expo EAS Build)
- `apps/extension` → Chrome Web Store + Firefox Add-ons
- `apps/shopify-app` → Shopify Partner Platform
- `apps/short-links` → Cloudflare Workers (the `gofnl.co` domain)
- `apps/renderer` → Cloudflare Workers (custom domain edge rendering at `*.gofunnelai.com`)
- `apps/grader` → already inside `funnel-web` at `/grade`. Skip the standalone Railway service.

The `railway.json` declares them for completeness, but you only need to actually deploy `funnel-web` + `funnel-workers` to be live for V1.

---

## Confidence check before deploy

- [ ] `next@14.2.35` in `pnpm-lock.yaml` (security CVE fixed — commit `2ce5285`)
- [ ] `output: "standalone"` in `apps/web/next.config.mjs`
- [ ] `apps/web/src/app/api/healthz/route.ts` exists
- [ ] `packages/db/scripts/migrate-on-deploy.sh` exists and is executable
- [ ] 6 migrations in `packages/db/prisma/migrations/`
- [ ] `apps/web/Dockerfile` uses `pnpm install --filter @funnel/web...` (three dots)
- [ ] `.env.example` has all keys you need to set in Railway

All verified as of commit `2ce5285`. **You're ready.**
