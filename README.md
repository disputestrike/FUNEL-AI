# GoFunnelAI

Autonomous Lead Generation platform. Type your business. Get a customer.

## Architecture

Monorepo (Turborepo + pnpm).

### Apps
- `apps/grader` ” Funnel Grader (gofunnelai.com/grade) ” public, ships Week 2
- `apps/web` ” Main Next.js app (gofunnelai.com)
- `apps/admin` ” Admin console (admin.gofunnelai.com)
- `apps/renderer` ” Funnel page renderer (Cloudflare Workers)
- `apps/api` ” API server (tRPC + Hono)

### Packages
- `packages/db` ” Prisma schema + migrations + RLS
- `packages/orchestrator` ” Multi-agent generation engine
- `packages/agents` ” 16 individual agents (Planner, Hook, Page, Lead Magnet, Image, Video, Ad Copy, Audience, Email, SMS, Voice Script, Upsell, Fact-Check, Compliance, QA, Brand Guardian)
- `packages/kb` ” Industry Knowledge Base + nightly ingestion pipeline
- `packages/auth` ” Authentication (signup, login, MFA, password reset)
- `packages/billing` ” PayPal + Stripe subscription billing
- `packages/crm` ” Native CRM (contacts, pipelines, scoring)
- `packages/revtry` ” RevTry voice agent integration
- `packages/integrations` ” Provider Abstraction Layer + adapters (Meta, Google, TikTok, LinkedIn, X, Resend, SignalWire, etc.)
- `packages/cost-governor` ” Per-generation budget + per-account ledger
- `packages/compliance` ” Trust & Safety + Human Review Queue + Fact-Check
- `packages/events` ” Canonical event taxonomy + emitter
- `packages/notifications` ” Multi-channel notification engine
- `packages/email` ” Transactional email (Resend primary)
- `packages/trust-safety` ” Fraud, phishing, abuse detection
- `packages/activation` ” Customer Success Activation Framework
- `packages/ui` ” Shared UI components (shadcn + Tailwind)
- `packages/shared` ” Shared types, schemas, utils

## Stack

- **Runtime**: Cloudflare Workers (edge) + Node 20+ (services)
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS + shadcn/ui
- **Database**: Postgres + pgvector (Neon or Supabase) + Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Queue**: BullMQ on Redis
- **Auth**: Clerk (initial) + custom MFA layer
- **LLM**: Anthropic Claude (primary) + OpenAI (Realtime API, fallback) + Llama 3 (fallback)
- **Image gen**: Flux / Ideogram via Replicate
- **Video gen**: Runway Gen-3 / Veo
- **Voice**: ElevenLabs (TTS), RevTry (AI voice agent)
- **Payments**: PayPal Subscriptions (primary), Stripe Billing + Tax (secondary)
- **Email**: Resend (primary)
- **SMS / Phone**: SignalWire (voice + SMS + Lookup) ” Twilio-compatible API
- **Observability**: Sentry + Prometheus + Grafana + OpenTelemetry

## Documentation

The full strategy, build specs, PRDs, and operational documentation live in `../funnel-ai-docs/`.
This codebase implements that blueprint.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

## License

Proprietary ” GoFunnelAI
