# GoFunnelAI

Autonomous Lead Generation platform. Type your business. Get a customer.

Single Next.js 14 app at the repo root. **No monorepo. No workspaces. One Railway service.**

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in keys
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000

## Deploy

```bash
git push origin main
```

Railway detects the Dockerfile at the root and deploys ONE service. That's it.

## Layout

```
/
├── src/
│   ├── app/              Next.js App Router routes
│   ├── components/       UI components
│   ├── lib/              utilities, integrations, auth helpers
│   ├── middleware.ts
│   ├── instrumentation.ts (boots BullMQ workers in-process)
│   └── @funnel/          internal packages (resolved via tsconfig paths)
│       ├── shared/       types, schemas, constants
│       ├── db/           Prisma client + RLS helpers
│       ├── orchestrator/ 6-phase generation DAG
│       ├── agents/       16-agent fleet
│       ├── auth/         MFA, sessions, API keys
│       ├── billing/      PayPal + Stripe
│       ├── crm/          contacts, leads, pipelines
│       ├── revtry/       voice agent (SignalWire)
│       ├── kb/           industry knowledge base
│       ├── ui/           shared UI primitives
│       └── ...           (25 packages total)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/               static assets
├── archive/              other apps (mobile, extension, etc.) kept for reference
├── docs/                 design docs + specs
├── infrastructure/       IaC, runbooks
├── Dockerfile            single image
├── railway.toml          single service
└── package.json          single manifest
```

## How internal imports work

Every file that imports `@funnel/<name>` resolves through `tsconfig.json` paths
to `./src/@funnel/<name>/` — no workspace package linking, no transpile step.

## Background workers

`src/instrumentation.ts` lazy-imports `@funnel/workers/embedded` on Node boot.
Set `ENABLE_EMBEDDED_WORKERS=0` to skip (useful when you scale workers as a
separate process).

## Other deploy targets

These ship from `archive/` independently of Railway:

- `archive/apps-extension/` — Chrome Web Store
- `archive/apps-mobile/` — App Store / Google Play
- `archive/apps-shopify-app/` — Shopify Partners
- `archive/apps-renderer/` `archive/apps-short-links/` — Cloudflare Workers
- `archive/apps-wordpress-plugin/` — WordPress.org plugin directory

## Commands

| Command              | What it does                       |
| -------------------- | ---------------------------------- |
| `pnpm dev`           | Next dev server on 3000            |
| `pnpm build`         | Prisma generate + Next build       |
| `pnpm start`         | Production server (standalone)     |
| `pnpm typecheck`     | tsc --noEmit                       |
| `pnpm test`          | Vitest unit tests                  |
| `pnpm test:e2e`      | Playwright                         |
| `pnpm db:migrate`    | Apply migrations (production)      |
| `pnpm db:migrate:dev`| Generate + apply new migration     |
| `pnpm db:reset`      | Drop + re-create + re-seed         |
| `pnpm db:studio`     | Prisma Studio                      |
