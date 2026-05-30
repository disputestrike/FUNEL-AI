export type EnterpriseCapabilityId =
  | "production_database"
  | "enterprise_identity"
  | "durable_workflow_engine"
  | "ai_orchestration"
  | "enterprise_publishing"
  | "design_quality_engine"
  | "asset_generation_storage"
  | "payments"
  | "crm_lead_management"
  | "signalwire_automation"
  | "security_compliance"
  | "observability"
  | "testing_depth"
  | "admin_operations"
  | "product_completeness"
  | "deployment_readiness";

export type EnterpriseCapabilityStatus = "ready" | "partial" | "blocked";

export interface EnterpriseCapability {
  id: EnterpriseCapabilityId;
  label: string;
  status: EnterpriseCapabilityStatus;
  productionMeaning: string;
  implementedSurface: string[];
  requiredEnv: string[];
  nextHardeningStep: string;
}

export interface EnterpriseReadinessReport {
  generatedAt: string;
  overallStatus: EnterpriseCapabilityStatus;
  readyCount: number;
  partialCount: number;
  blockedCount: number;
  capabilities: EnterpriseCapability[];
}

const REQUIRED = {
  database: ["DATABASE_URL", "DIRECT_DATABASE_URL"],
  auth: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "JWT_SECRET", "ENCRYPTION_KEY"],
  ai: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
  image: ["REPLICATE_API_TOKEN"],
  storage: ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"],
  email: ["RESEND_API_KEY"],
  payments: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"],
  signalwire: ["SIGNALWIRE_PROJECT_ID", "SIGNALWIRE_API_TOKEN", "SIGNALWIRE_SPACE_URL", "SIGNALWIRE_FROM_NUMBER"],
  observability: ["SENTRY_DSN"],
  railway: ["RAILWAY_ENVIRONMENT", "NEXT_PUBLIC_APP_URL"],
} as const;

export function getEnterpriseReadiness(env: NodeJS.ProcessEnv = process.env): EnterpriseReadinessReport {
  const capabilities: EnterpriseCapability[] = [
    {
      id: "production_database",
      label: "Production database",
      status: statusFor(allSet(env, REQUIRED.database)),
      productionMeaning: "Funnels, versions, CRM contacts, leads, assets, integrations, calls, payments, audit logs, and grader data persist in Postgres.",
      implementedSurface: [
        "Canonical Prisma schema already includes User, Workspace, Funnel, FunnelVersion, CrmContact, Lead, Asset, IntegrationConnection, RevTryCall, billing, and AuditLog models.",
        "Generated funnel preview uses a Railway-volume/file fallback for local mode while production can bind to the canonical models.",
        "/api/readyz checks Postgres before Railway should route traffic.",
      ],
      requiredEnv: [...REQUIRED.database],
      nextHardeningStep: "Run migrations against Railway Postgres and switch generated funnel persistence to workspace/user-scoped DB writes for authenticated users.",
    },
    {
      id: "enterprise_identity",
      label: "Enterprise identity",
      status: statusFor(hasAny(env, "GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID")),
      productionMeaning: "Google OAuth is live, with a path to SAML/OIDC, SCIM, RBAC, and admin-controlled workspace access.",
      implementedSurface: [
        "Google OAuth start/callback routes exist.",
        "Middleware protects app routes.",
        "Prisma schema includes users, workspace members, roles, and audit actors.",
      ],
      requiredEnv: [...REQUIRED.auth],
      nextHardeningStep: "Replace local preview cookie with signed JWT/session storage, then add SAML/OIDC and SCIM providers.",
    },
    {
      id: "durable_workflow_engine",
      label: "Durable workflow engine",
      status: "partial",
      productionMeaning: "Every funnel generation runs as a resumable job with step state, retries, idempotency, replay, and failure recovery.",
      implementedSurface: [
        "Orchestrator exposes deterministic automated funnel packages.",
        "Agent breakdown, budget, retry, DAG, cache, and idempotency modules exist.",
        "The generator API returns provider readiness and generated artifacts in one package.",
      ],
      requiredEnv: ["REDIS_URL", "AGENT_RUNNER_URL", "AGENT_RUNNER_SECRET"],
      nextHardeningStep: "Persist job steps and retry state in Postgres/Redis, then stream progress to the UI.",
    },
    {
      id: "ai_orchestration",
      label: "AI orchestration",
      status: statusFor(hasAny(env, "OPENAI_API_KEY") && hasAny(env, "ANTHROPIC_API_KEY")),
      productionMeaning: "OpenAI and Anthropic generate strategy, copy, assets, evals, refusals, and quality rewrites with prompt/version control.",
      implementedSurface: [
        "Offer intelligence builds industry-specific lead magnets, proof, assets, and upsells.",
        "Automated funnel package separates strategy, copy, image, storage, payments, SignalWire, and email steps.",
      ],
      requiredEnv: [...REQUIRED.ai],
      nextHardeningStep: "Wire live model calls behind the existing deterministic contract and store prompt/eval versions per generation.",
    },
    {
      id: "enterprise_publishing",
      label: "Enterprise publishing",
      status: "partial",
      productionMeaning: "Funnels publish with versioning, rollback, custom domains, SSL, CDN caching, noindex controls, and preview/staging/live separation.",
      implementedSurface: [
        "Public /f/[slug], thank-you, and upsell routes render generated funnels.",
        "FunnelVersion schema supports artifact hashes, parent versions, quality scores, and published state.",
        "Generated funnels carry slug, status, public URL, pages, and versionable config.",
      ],
      requiredEnv: ["NEXT_PUBLIC_APP_URL", "CUSTOM_DOMAIN_PROVIDER_TOKEN"],
      nextHardeningStep: "Create custom-domain verification records and bind live/staging/preview URLs to FunnelVersion rows.",
    },
    {
      id: "design_quality_engine",
      label: "Design quality engine",
      status: "partial",
      productionMeaning: "The generator selects high-performing section/component variants and runs visual QA before publish.",
      implementedSurface: [
        "Automated funnel renderer supports hero, proof, lead magnet, form, upsell ladder, FAQ, final CTA, thank-you, and upsell sections.",
        "Brand logo and approved GoFunnelAI assets are used in generated funnels.",
        "Playwright screenshots prove desktop/mobile rendering.",
      ],
      requiredEnv: [],
      nextHardeningStep: "Add a scored component registry with variant selection, screenshot diffing, and design-quality gates.",
    },
    {
      id: "asset_generation_storage",
      label: "Asset generation and storage",
      status: statusFor(hasAny(env, "REPLICATE_API_TOKEN") && allSet(env, REQUIRED.storage)),
      productionMeaning: "Images, lead magnets, ad creatives, OG images, exports, and PDFs are generated and stored in durable object storage.",
      implementedSurface: [
        "Automated funnel assets include prompts, roles, storage keys, and local SVG fallback assets.",
        "Railway volume/R2 readiness is reported by the generator API.",
      ],
      requiredEnv: [...REQUIRED.image, ...REQUIRED.storage],
      nextHardeningStep: "Generate image/PDF assets through providers and upload final artifacts to R2 with signed public URLs.",
    },
    {
      id: "payments",
      label: "Payments",
      status: statusFor(hasAny(env, "STRIPE_SECRET_KEY") && hasAny(env, "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET")),
      productionMeaning: "Tripwires, order bumps, upsells, subscriptions, webhooks, refunds, tax, receipts, and reconciliation are production-safe.",
      implementedSurface: [
        "Stripe Checkout Session handoff exists.",
        "PayPal checkout order handoff exists.",
        "Provider-missing redirects are explicit instead of silent failures.",
        "Billing schema and package include subscriptions, payments, refunds, webhooks, and reconciliation surfaces.",
      ],
      requiredEnv: [...REQUIRED.payments],
      nextHardeningStep: "Persist checkout sessions and verify Stripe/PayPal webhooks before marking revenue or fulfillment complete.",
    },
    {
      id: "crm_lead_management",
      label: "CRM and lead management",
      status: "partial",
      productionMeaning: "Leads are deduped, scored, assigned, enriched, sequenced, exported, and synced to CRM systems.",
      implementedSurface: [
        "Public funnel lead capture works and persists locally in preview.",
        "Prisma schema includes CrmContact, Lead, Booking, campaigns, sequences, suppression, and consent models.",
      ],
      requiredEnv: ["CLEARBIT_API_KEY"],
      nextHardeningStep: "Write captured leads into CrmContact + Lead rows, add scoring bands, and expose the CRM pipeline UI.",
    },
    {
      id: "signalwire_automation",
      label: "SignalWire automation",
      status: statusFor(allSet(env, REQUIRED.signalwire)),
      productionMeaning: "Qualified leads can receive consent-aware SMS and voice follow-up with recordings, transcripts, and disposition.",
      implementedSurface: [
        "Provider readiness includes SignalWire.",
        "Lead routing reports SMS/voice readiness.",
        "Prisma schema includes RevTryCall and SMS sequence models.",
      ],
      requiredEnv: [...REQUIRED.signalwire],
      nextHardeningStep: "Attach SignalWire outbound call/SMS jobs to qualified lead events and persist outcomes to RevTryCall.",
    },
    {
      id: "security_compliance",
      label: "Security and compliance",
      status: statusFor(hasAny(env, "JWT_SECRET") && hasAny(env, "ENCRYPTION_KEY")),
      productionMeaning: "Secrets, sessions, rate limits, abuse controls, PII handling, audit logs, deletion, consent, and retention are enforced.",
      implementedSurface: [
        "Middleware protects app surfaces.",
        "Canonical schema includes audit logs, deletion tombstones, suppression list, consent blobs, PII tiers, and integration vault paths.",
        "Generated forms validate payloads server-side.",
      ],
      requiredEnv: ["JWT_SECRET", "ENCRYPTION_KEY", "INTERNAL_INGEST_SECRET"],
      nextHardeningStep: "Move from local preview cookies to signed sessions, enforce CSP/security headers, and add per-route rate limits.",
    },
    {
      id: "observability",
      label: "Observability",
      status: statusFor(hasAny(env, "SENTRY_DSN")),
      productionMeaning: "Logs, traces, metrics, costs, provider health, generation failures, alerts, and incident runbooks are visible.",
      implementedSurface: [
        "/api/healthz and /api/readyz exist.",
        "Generation responses include provider readiness and quality score.",
        "QA artifacts are stored under artifacts/qa.",
      ],
      requiredEnv: [...REQUIRED.observability],
      nextHardeningStep: "Add structured log events for every generation step and ship metrics/errors to Sentry or OpenTelemetry.",
    },
    {
      id: "testing_depth",
      label: "Testing depth",
      status: "partial",
      productionMeaning: "Every critical path has unit, contract, e2e, visual, mobile, load, payment-webhook, and AI-output eval coverage.",
      implementedSurface: [
        "Shared, KB, orchestrator, and web typecheck/build suites pass.",
        "Playwright QA screenshots cover generated funnel, lead capture, thank-you, upsell, and mobile no-overflow.",
      ],
      requiredEnv: [],
      nextHardeningStep: "Promote the ad-hoc Playwright proof scripts into committed e2e tests and add webhook/load/eval suites.",
    },
    {
      id: "admin_operations",
      label: "Admin and operations",
      status: "partial",
      productionMeaning: "Internal operators can inspect tenants, jobs, leads, failed providers, billing, audit logs, and replay failed steps.",
      implementedSurface: [
        "Database schema has operator-friendly audit, billing, integration, and lead models.",
        "Enterprise readiness API reports every platform capability and blocked credential.",
      ],
      requiredEnv: ["ADMIN_EMAIL_DOMAINS"],
      nextHardeningStep: "Build internal admin pages for workspaces, jobs, leads, provider health, and failed-step replay.",
    },
    {
      id: "product_completeness",
      label: "Product completeness",
      status: "partial",
      productionMeaning: "Onboarding, brand ingestion, chat builder, revisions, saved campaigns, exports, marketplace, and collaboration are first-class.",
      implementedSurface: [
        "Marketing, signup/login, dashboard, grader, generator, public funnels, lead capture, and post-opt-in upsells exist.",
        "Funnel package already includes page, asset, proof, lead magnet, upsell, provider, and automation surfaces.",
      ],
      requiredEnv: ["NEXT_PUBLIC_APP_URL"],
      nextHardeningStep: "Add a chat-style builder, saved campaign library, revision history UI, and team collaboration controls.",
    },
    {
      id: "deployment_readiness",
      label: "Deployment readiness",
      status: statusFor(hasAny(env, "RAILWAY_ENVIRONMENT") || hasAny(env, "NEXT_PUBLIC_APP_URL")),
      productionMeaning: "Railway deploys run migrations, validate env, expose health/readiness, separate staging/prod, and support rollback.",
      implementedSurface: [
        "railway.json exists.",
        "Health and readiness routes exist.",
        ".env.example documents provider credentials.",
      ],
      requiredEnv: [...REQUIRED.railway],
      nextHardeningStep: "Add a preflight env validator to CI/CD and run database migrations before release traffic shifts.",
    },
  ];

  const readyCount = capabilities.filter((capability) => capability.status === "ready").length;
  const partialCount = capabilities.filter((capability) => capability.status === "partial").length;
  const blockedCount = capabilities.filter((capability) => capability.status === "blocked").length;
  return {
    generatedAt: new Date().toISOString(),
    overallStatus: blockedCount > 0 ? "blocked" : partialCount > 0 ? "partial" : "ready",
    readyCount,
    partialCount,
    blockedCount,
    capabilities,
  };
}

function statusFor(ready: boolean): EnterpriseCapabilityStatus {
  return ready ? "ready" : "partial";
}

function hasAny(env: NodeJS.ProcessEnv, ...keys: string[]): boolean {
  return keys.some((key) => Boolean(env[key]));
}

function allSet(env: NodeJS.ProcessEnv, keys: readonly string[]): boolean {
  return keys.every((key) => Boolean(env[key]));
}
