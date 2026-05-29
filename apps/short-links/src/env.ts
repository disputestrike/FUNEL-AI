/**
 * Worker bindings + env shape for the short-link worker.
 */
import type {
  Hyperdrive,
  KVNamespace,
  Queue,
  RateLimit,
} from "@cloudflare/workers-types";

/** Body of the click-counter increment job. */
export interface ClickCounterJob {
  code: string;
  count: number;
  ts: string;
}

export interface Env {
  // Bindings
  DB: Hyperdrive;
  SHORT_LINK_CACHE: KVNamespace;
  CLICK_COUNTER_QUEUE: Queue<ClickCounterJob>;
  REDIRECT_RATELIMIT: RateLimit;

  // Vars
  ENVIRONMENT: "production" | "staging" | "development";
  APEX_DOMAIN: string;
  FALLBACK_URL: string;
  CACHE_TTL_FRESH_SECONDS: string;
  CACHE_TTL_STALE_SECONDS: string;

  // Secrets
  DATABASE_URL: string;
  INTERNAL_INGEST_SECRET: string;
  SENTRY_DSN?: string;
}
