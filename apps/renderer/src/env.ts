/**
 * Worker bindings + secrets surface for the Funnel renderer.
 *
 * All bindings live in wrangler.toml; this is the typed shape `c.env` exposes
 * via Hono. Keep this file in sync with wrangler.toml — TypeScript will not
 * catch a mismatch (bindings are populated by the runtime, not the compiler).
 */

import type {
  BrowserWorker,
  Hyperdrive,
  KVNamespace,
  Queue,
  R2Bucket,
  RateLimit,
} from "@cloudflare/workers-types";

/** A queued lead-capture job — consumed by apps/api lead-ingest worker. */
export interface LeadCaptureJob {
  job_id: string;
  enqueued_at: string;
  workspace_id: string;
  funnel_id: string;
  funnel_version_id: string;
  page_id: string;
  form_id: string;
  ab_variant_id?: string;
  capture_source: "landing_page_form";
  capture_url: string;
  fields: Record<string, string | number | boolean | null>;
  pii: {
    email_sha256?: string;
    phone_e164_sha256?: string;
  };
  consent: {
    consent_id: string;
    consent_text_version: string;
    captured_at: string;
    ip_hash: string;
    user_agent: string;
    marketing: boolean;
    tcpa: boolean;
    gdpr: boolean;
  };
  utm: Record<string, string>;
  affiliate_code?: string;
  referrer?: string;
  geo_country?: string;
  geo_region?: string;
  visitor_id: string;
}

/** A queued server-side analytics conversion event. */
export interface AnalyticsConversionJob {
  job_id: string;
  funnel_id: string;
  workspace_id: string;
  providers: Array<{
    provider: "ga4" | "meta" | "tiktok";
    pixel_id: string;
    event_name: string;
    event_id: string;
    event_time: number;
    user_data_hashed: Record<string, string>;
    custom_data?: Record<string, unknown>;
    action_source: "website";
    source_url: string;
  }>;
}

export interface Env {
  // ---- Bindings ----
  DB: Hyperdrive;
  ASSETS: R2Bucket;
  PAGE_CACHE: KVNamespace;
  AB_CACHE: KVNamespace;
  DOMAIN_CACHE: KVNamespace;
  BROWSER: BrowserWorker;
  LEAD_QUEUE: Queue<LeadCaptureJob>;
  ANALYTICS_QUEUE: Queue<AnalyticsConversionJob>;
  FORM_RATELIMIT: RateLimit;
  PAGE_RATELIMIT: RateLimit;

  // ---- Secrets ----
  DATABASE_URL: string;
  FORM_HMAC_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  GA4_API_SECRET?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  TIKTOK_EVENTS_ACCESS_TOKEN?: string;
  INTERNAL_INGEST_SECRET: string;

  // ---- Vars ----
  ENVIRONMENT: "production" | "staging" | "development";
  APEX_DOMAIN: string;
  APP_BASE_URL: string;
  API_BASE_URL: string;
  ASSETS_PUBLIC_BASE: string;
  CACHE_TTL_FRESH_SECONDS: string;
  CACHE_TTL_STALE_SECONDS: string;
  DEFAULT_LOCALE: string;
}

/** Variables we attach to the Hono request context per request. */
export interface RequestVars {
  hostname: string;
  visitor_id: string;
  request_id: string;
  ip_hash: string;
  geo_country?: string;
  geo_region?: string;
  user_agent: string;
  referrer?: string;
  utm: Record<string, string>;
  affiliate_code?: string;
  /** Resolved on the route resolution middleware. */
  resolved?: {
    workspace_id: string;
    workspace_status: string;
    funnel_id: string;
    funnel_version_id: string;
    funnel_slug: string;
    funnel_status: string;
    custom_domain?: string;
    is_custom_domain: boolean;
    funnel_json: unknown;
    brand_tokens: unknown;
    free_tier: boolean;
  };
}

/** Hono Bindings + Variables generic. */
export type HonoEnv = {
  Bindings: Env;
  Variables: RequestVars;
};
