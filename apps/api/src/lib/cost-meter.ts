/**
 * Cost meter — every billable operation increments a workspace-scoped counter
 * via @funnel/cost-governor. Read by:
 *   - Hard caps in `middleware/rate-limit.ts` (request blocked above plan cap)
 *   - Dashboard widgets in apps/web
 *   - Dunning + invoice line items in @funnel/billing
 *
 * Cost-governor itself is a wafer-thin facade over the `usage_counters`
 * Postgres table; we go through it so policy lives in one place.
 */

export type CostMeter =
  | "generation_tokens"
  | "generation_runs"
  | "revtry_call_minutes"
  | "revtry_dials"
  | "sms_sent"
  | "email_sent"
  | "image_generated"
  | "video_generated"
  | "voice_seconds"
  | "ad_spend_usd_micros"
  | "kb_pages_ingested"
  | "api_v1_request";

export interface MeterIncrement {
  workspaceId: string;
  meter: CostMeter;
  amount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Increment a cost meter. Errors are NEVER thrown back to the caller — we
 * never want a billing-counter blip to fail a customer write. The error path
 * fires a Sentry breadcrumb instead.
 */
export async function meter(inc: MeterIncrement): Promise<void> {
  try {
    // @funnel/cost-governor is a package stub in the monorepo; once its
    // store is implemented this call will route to the canonical counter.
    const cg = await import("@funnel/cost-governor").catch(() => null);
    if (cg && typeof (cg as Record<string, unknown>).increment === "function") {
      await (cg as { increment: (i: MeterIncrement) => Promise<void> }).increment(inc);
    }
  } catch (err) {
    // Surface to Sentry via globalThis; do not rethrow.
    const reporter = (globalThis as { __sentryBreadcrumb?: (msg: string, data?: unknown) => void })
      .__sentryBreadcrumb;
    reporter?.("cost-meter increment failed", { err: String(err), inc });
  }
}
