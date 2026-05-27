/**
 * Cloudflare Worker bindings — the full env shape every Hono handler and tRPC
 * procedure receives.
 *
 * Bindings are provisioned in `wrangler.toml`. Secrets are set via
 * `wrangler secret put` and surface as `string` fields here.
 */

export interface Env {
  // --- Vars ---------------------------------------------------------------
  ENVIRONMENT: "development" | "staging" | "production";
  API_PUBLIC_URL: string;
  WEB_PUBLIC_URL: string;
  ADMIN_PUBLIC_URL: string;
  ALLOWED_ORIGINS: string; // comma-separated
  DEFAULT_REGION: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";

  // --- Postgres via Hyperdrive -------------------------------------------
  DB: Hyperdrive;
  DATABASE_URL: string;

  // --- KV namespaces ------------------------------------------------------
  SESSIONS: KVNamespace;
  OAUTH_STATE: KVNamespace;
  WEBHOOK_DEDUPE: KVNamespace;
  IDEMPOTENCY: KVNamespace;
  RATE_LIMIT_FALLBACK: KVNamespace;

  // --- R2 -----------------------------------------------------------------
  WEBHOOK_BODIES: R2Bucket;
  GENERATION_ARTIFACTS: R2Bucket;

  // --- Queues -------------------------------------------------------------
  Q_WEBHOOKS: Queue<WebhookJobPayload>;
  Q_GENERATION: Queue<GenerationJobPayload>;
  Q_EMAIL: Queue<EmailJobPayload>;
  Q_REVTRY: Queue<RevtryJobPayload>;
  Q_DUNNING: Queue<DunningJobPayload>;

  // --- Durable Objects ----------------------------------------------------
  RATE_LIMIT_DO: DurableObjectNamespace;
  GENERATION_STREAM_DO: DurableObjectNamespace;

  // --- Cloudflare native rate limit bindings ------------------------------
  RL_PUBLIC_API: RateLimit;
  RL_AUTH: RateLimit;
  RL_FORM_SUBMIT: RateLimit;

  // --- Browser Rendering --------------------------------------------------
  BROWSER: Fetcher;

  // --- Secrets ------------------------------------------------------------
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  SENTRY_DSN?: string;

  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;

  RESEND_API_KEY: string;
  RESEND_WEBHOOK_SECRET: string;

  SIGNALWIRE_PROJECT_ID: string;
  SIGNALWIRE_TOKEN: string;
  SIGNALWIRE_WEBHOOK_SECRET: string;

  REVTRY_WEBHOOK_SECRET: string;

  META_APP_ID: string;
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_WEBHOOK_TOKEN: string;

  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string;

  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;

  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;

  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_GRAPH_CLIENT_STATE: string;

  CALCOM_CLIENT_ID: string;
  CALCOM_CLIENT_SECRET: string;
}

// --- Queue payload shapes ----------------------------------------------------

export interface WebhookJobPayload {
  webhookEventId: string;
  provider: string;
  receivedAt: string;
  /** R2 key holding raw verified body bytes. */
  rawBodyKey: string;
}

export interface GenerationJobPayload {
  generationId: string;
  workspaceId: string;
  requestedByUserId?: string;
  funnelId?: string;
  attempt: number;
}

export interface EmailJobPayload {
  emailId: string;
  workspaceId: string | null;
  templateId: string;
  toHash: string;
  payload: Record<string, unknown>;
}

export interface RevtryJobPayload {
  leadId: string;
  workspaceId: string;
  /** Speed-to-lead target — must dial inside 60s of capture. */
  captureAt: string;
  campaignId?: string;
}

export interface DunningJobPayload {
  subscriptionId: string;
  workspaceId: string;
  step: "D0" | "D3" | "D7" | "D14" | "D30" | "D60" | "D90";
}
