/**
 * Cloudflare bindings + secrets surface for the agent-runner Worker.
 */

import type {
  KVNamespace,
  Queue,
  R2Bucket,
  BrowserWorker,
} from "@cloudflare/workers-types";

export interface Env {
  // Bindings
  BROWSER: BrowserWorker;
  ASSETS: R2Bucket;
  AUDIT_QUEUE: Queue<{ audit_id: string; url: string }>;
  RUNTIME_KV: KVNamespace;

  // Secrets
  ANTHROPIC_API_KEY: string;
  DATABASE_URL: string;
  AGENT_RUNNER_SECRET: string;
  PAGESPEED_API_KEY?: string;

  // Vars
  ENVIRONMENT: string;
  R2_PUBLIC_BASE: string;
  COST_CAP_AUDIT_CENTS: string;
  COST_CAP_PREVIEW_CENTS: string;
  DAILY_BUDGET_CENTS: string;
  DAILY_HARD_CAP_CENTS: string;
}
