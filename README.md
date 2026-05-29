# GoFunnelAI

Autonomous Lead Generation platform. Type your business. Get a customer.

## Quick Start

1. `pnpm install`
2. `cp .env.example .env` and fill keys (Google OAuth, Anthropic, Replicate, Resend, SignalWire, PayPal)
3. `pnpm db:migrate`
4. `pnpm dev`
5. Open http://localhost:3000

## Deploy

1. Push to GitHub
2. Connect repo to Railway
3. Add Postgres + Redis plugins
4. Set env vars from .env.example
5. Railway auto-runs migrations + deploys all services

## Architecture

Monorepo (Turborepo + pnpm). See `MANIFEST.md` for the full app + package inventory and `STATUS.md` for what is complete vs. needs configuration.

### Apps
- `apps/web` — Marketing site, signup, onboarding, dashboard, generation UI (gofunnelai.com)
- `apps/api` — Hono + tRPC v11 on Cloudflare Workers
- `apps/admin` — Internal admin console (admin.gofunnelai.com)
- `apps/renderer` — Funnel page renderer (Cloudflare Workers)
- `apps/grader` — Funnel Grader, public free tool (gofunnelai.com/grade)
- `apps/workers` — BullMQ long-running Node worker service
- `apps/short-links` — `gofnl.co/[code]` redirect worker
- `apps/extension`, `apps/shopify-app`, `apps/wordpress-plugin`, `apps/mobile` — channel surfaces

### Packages
- `packages/db` — Prisma schema + migrations + RLS
- `packages/orchestrator` — Multi-agent generation engine, 6-phase DAG, SSE streaming
- `packages/agents` — 16 individual agents (Planner, Hook, Page, Lead Magnet, Image, Video, Ad Copy, Audience, Email, SMS, Voice Script, Upsell, Fact-Check, Compliance, QA, Brand Guardian)
- `packages/kb` — Industry Knowledge Base, 30 vertical packs × geo × language
- `packages/auth` — Authentication, MFA, sessions, SSO
- `packages/billing` — PayPal (primary) + Stripe (secondary) subscriptions
- `packages/crm` — Native CRM + Lead Engine
- `packages/revtry` — RevTry voice agent (SignalWire)
- `packages/integrations` — Provider Abstraction Layer + adapters (Meta, Google, TikTok, LinkedIn, X, Resend, SignalWire, etc.)
- `packages/cost-governor` — Per-generation budget + per-account ledger
- `packages/compliance` — Trust & Safety + Human Review Queue + Fact-Check
- `packages/events` — Canonical event taxonomy + emitter
- `packages/notifications` — Multi-channel notification engine
- `packages/email` — Transactional email (Resend, 47 React Email templates)
- `packages/trust-safety` — Fraud, phishing, abuse detection
- `packages/activation` — Customer Success Activation Framework
- `packages/marketplace`, `packages/academy`, `packages/awards`, `packages/affiliate`, `packages/challenge`, `packages/community` — viral-loop surfaces
- `packages/ui` — Shared UI components (shadcn + Tailwind), brand single source of truth
- `packages/shared` — Shared types, schemas, utils
- `packages/sdk` — Official TypeScript SDK

## Stack

- **Runtime**: Cloudflare Workers (edge) + Node 20+ (services)
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS + shadcn/ui
- **Database**: Postgres + pgvector (Neon or Supabase) + Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Queue**: BullMQ on Redis
- **Auth**: Custom auth with Google OAuth + MFA
- **LLM**: Anthropic Claude (primary) + OpenAI (Realtime API, fallback) + Llama 3 (fallback)
- **Image gen**: Flux / Ideogram via Replicate
- **Video gen**: Runway Gen-3 / Veo
- **Voice**: ElevenLabs (TTS), RevTry (AI voice agent)
- **Payments**: PayPal Subscriptions (primary), Stripe Billing + Tax (secondary)
- **Email**: Resend (primary)
- **SMS / Phone**: SignalWire (voice + SMS + Lookup) — Twilio-compatible API
- **Observability**: Sentry + Prometheus + Grafana + OpenTelemetry

## Verification

- `scripts/fix-mojibake.ps1` — strip UTF-8 mojibake from source
- `scripts/smoke-routes.ps1` — ping every public route on a running dev server
- `tools/testing/e2e/full-flow.spec.ts` — Playwright end-to-end happy path

## License

Proprietary — GoFunnelAI
