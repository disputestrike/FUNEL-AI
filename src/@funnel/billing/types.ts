/**
 * @funnel/billing — local types.
 *
 * Most domain types (Subscription, Invoice, Payment, Refund, Plan, DunningState)
 * come from @funnel/shared/types. This file adds billing-package-internal types
 * used by the processor adapters, lifecycle state machine, dunning service,
 * and webhook handlers.
 *
 * All amounts are bigint-safe `number` micros (1e-6 of currency unit). Doc 03
 * §B.7 and Doc 08 §65 are the source of truth.
 */

import { z } from "zod";

import type {
  DunningState as SharedDunningState,
  Invoice as SharedInvoice,
  InvoiceStatus,
  Payment as SharedPayment,
  Plan as SharedPlan,
  Refund as SharedRefund,
  Subscription as SharedSubscription,
  SubscriptionStatus,
  WorkspaceId,
  UserId,
  PlanSlug,
} from "@funnel/shared/types";

// Re-export the shared domain types so callers can `import { Plan } from "@funnel/billing"`.
export type Plan = SharedPlan;
export type Subscription = Omit<SharedSubscription, "external_processor"> & {
  external_processor: BillingProcessor;
};
export type Invoice = Omit<SharedInvoice, "external_processor"> & {
  external_processor: BillingProcessor;
};
export type Payment = Omit<SharedPayment, "external_processor"> & {
  external_processor: BillingProcessor;
};
export type Refund = Omit<SharedRefund, "external_processor"> & {
  external_processor: BillingProcessor;
};
export type DunningState = SharedDunningState;
export type { InvoiceStatus, SubscriptionStatus, PlanSlug };

/** Which processor produced / owns a row. */
export type BillingProcessor = "paypal" | "stripe";

/** Funnel's plan catalog — Free + 7-day Pro Boost + 4 paid tiers. */
export const PLAN_SLUGS = ["free", "pro_boost_7d", "starter", "growth", "scale", "agency"] as const;
export type BillingPlanSlug = (typeof PLAN_SLUGS)[number];

/** USD-cents prices for each tier; canonical to the brief. */
export const PLAN_PRICES_USD_CENTS: Record<BillingPlanSlug, number> = {
  free: 0,
  pro_boost_7d: 700, // $7 one-time, 7-day Growth access
  starter: 4_900, // $49
  growth: 14_900, // $149
  scale: 49_700, // $497
  agency: 99_700, // $997
};

/** Per-resource plan limits. Used by `limits.ts`. */
export interface PlanLimits {
  funnels: number;
  leads_per_month: number;
  revtry_minutes_per_month: number;
  monthly_ad_spend_usd_cents: number;
  storage_gb: number;
  team_seats: number;
}

export const PLAN_LIMITS: Record<BillingPlanSlug, PlanLimits> = {
  free: {
    funnels: 1,
    leads_per_month: 50,
    revtry_minutes_per_month: 0,
    monthly_ad_spend_usd_cents: 0,
    storage_gb: 1,
    team_seats: 1,
  },
  pro_boost_7d: {
    funnels: 5,
    leads_per_month: 1_000,
    revtry_minutes_per_month: 60,
    monthly_ad_spend_usd_cents: 50_000,
    storage_gb: 10,
    team_seats: 3,
  },
  starter: {
    funnels: 3,
    leads_per_month: 500,
    revtry_minutes_per_month: 30,
    monthly_ad_spend_usd_cents: 25_000,
    storage_gb: 5,
    team_seats: 2,
  },
  growth: {
    funnels: 10,
    leads_per_month: 5_000,
    revtry_minutes_per_month: 240,
    monthly_ad_spend_usd_cents: 250_000,
    storage_gb: 25,
    team_seats: 5,
  },
  scale: {
    funnels: 50,
    leads_per_month: 25_000,
    revtry_minutes_per_month: 1_200,
    monthly_ad_spend_usd_cents: 1_000_000,
    storage_gb: 100,
    team_seats: 15,
  },
  agency: {
    funnels: 250,
    leads_per_month: 250_000,
    revtry_minutes_per_month: 6_000,
    monthly_ad_spend_usd_cents: 10_000_000,
    storage_gb: 500,
    team_seats: 50,
  },
};

/** All measurable resources we enforce caps on. */
export type ResourceKind =
  | "funnels"
  | "leads_per_month"
  | "revtry_minutes_per_month"
  | "monthly_ad_spend_usd_cents"
  | "storage_gb"
  | "team_seats";

/** Standard exit-survey reason codes (Doc 12 PRD 4 §2 story 8). */
export const CANCELLATION_REASONS = [
  "too_expensive",
  "missing_feature",
  "switching_competitor",
  "not_using_enough",
  "technical_issues",
  "business_closing",
  "temporary_pause_failed",
  "other",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/** Dunning step codes per the brief (D0/D3/D7/D14/D21/D28/D60/D90 sequence). */
export const DUNNING_STEPS = [
  "d0",
  "d3",
  "d7",
  "d14",
  "d21",
  "d28",
  "d60",
  "d90",
  "recovered",
  "closed",
] as const;
export type DunningStep = (typeof DUNNING_STEPS)[number];

/** Day offsets from D0 (initial failure) for each step. */
export const DUNNING_STEP_DAYS: Record<Exclude<DunningStep, "recovered" | "closed">, number> = {
  d0: 0,
  d3: 3,
  d7: 7,
  d14: 14,
  d21: 21,
  d28: 28,
  d60: 60,
  d90: 90,
};

export interface DunningStepConfig {
  step: DunningStep;
  /** Days after D0 this step fires. */
  day_offset: number;
  /** Which email template to send (handed off to @funnel/email). */
  email_template: string;
  /** Whether we retry the payment when this step fires. */
  retry_charge: boolean;
  /** Whether this step transitions the subscription to a new status. */
  status_transition?: SubscriptionStatus;
  /** Whether funnels are still publicly live at this step. */
  funnels_live: boolean;
  /** Whether published funnels show the watermark. */
  funnels_watermarked: boolean;
  /** Whether the workspace should be marked for deletion. */
  delete_workspace: boolean;
}

/** Webhook-event envelope after normalization (processor-agnostic). */
export interface BillingWebhookEvent {
  /** Stable processor event id, used for idempotency. */
  event_id: string;
  /** Which processor emitted this. */
  processor: BillingProcessor;
  /** Normalized event name, e.g. `subscription.activated`. */
  event_type: string;
  /** Raw decoded payload for debugging / replay. */
  resource: Record<string, unknown>;
  /** Original receipt time. */
  received_at: string;
  /** Processor-side creation time (or null if not provided). */
  occurred_at?: string;
}

/** Result of validating + processing a webhook. */
export interface WebhookHandleResult {
  status: "processed" | "duplicate" | "ignored" | "deferred";
  /** Side-effects that fired (for tests / observability). */
  actions: string[];
}

/** Proration preview returned by `proration.ts#preview()`. */
export interface ProrationPreview {
  workspace_id: WorkspaceId;
  subscription_id: string;
  from_plan: BillingPlanSlug;
  to_plan: BillingPlanSlug;
  /** Credit issued for the unused portion of the current plan, USD cents. */
  credit_usd_cents: number;
  /** Charge for the prorated portion of the new plan, USD cents. */
  charge_usd_cents: number;
  /** Net immediate charge (charge − credit). */
  immediate_usd_cents: number;
  /** ISO-8601. The current_period_end (unchanged by upgrade). */
  next_billing_at: string;
}

/** Audit-log entry shape (matches the `audit_log` table conceptually). */
export interface AuditLogEntry {
  workspace_id: WorkspaceId | null;
  actor_user_id: UserId | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

/** Free-Until-$1K ledger entry. */
export interface FreeUntil1kState {
  workspace_id: WorkspaceId;
  cumulative_usd_cents: number;
  threshold_crossed_at: string | null;
  source_funnels: string[];
  charging_active: boolean;
}

/** Card-expiry reminder record. */
export interface CardExpirySchedule {
  workspace_id: WorkspaceId;
  external_customer_id: string;
  processor: BillingProcessor;
  card_brand: string;
  card_last4: string;
  exp_month: number; // 1-12
  exp_year: number; // 4-digit
  /** Set after a reminder has been sent at T-30 / T-7. */
  reminder_30d_sent_at: string | null;
  reminder_7d_sent_at: string | null;
}

/** Zod schemas exposed for API boundaries. */
export const PlanSlugSchema = z.enum(PLAN_SLUGS);
export const CancellationReasonSchema = z.enum(CANCELLATION_REASONS);
export const DunningStepSchema = z.enum(DUNNING_STEPS);

export const RefundRequestSchema = z.object({
  workspace_id: z.string().min(1),
  payment_id: z.string().min(1),
  amount_usd_cents: z.number().int().positive().optional(),
  reason_code: z.string().min(1),
  justification_ticket_id: z.string().min(1),
  actor_user_id: z.string().min(1),
});
export type RefundRequest = z.infer<typeof RefundRequestSchema>;

export const CancelRequestSchema = z.object({
  workspace_id: z.string().min(1),
  subscription_id: z.string().min(1),
  actor_user_id: z.string().min(1),
  reason_code: CancellationReasonSchema,
  feedback_text: z.string().max(2_000).optional(),
});
export type CancelRequest = z.infer<typeof CancelRequestSchema>;

export const PauseRequestSchema = z.object({
  workspace_id: z.string().min(1),
  subscription_id: z.string().min(1),
  actor_user_id: z.string().min(1),
  /** Days to pause for; capped at 90 by the lifecycle service. */
  duration_days: z.number().int().positive().max(90),
});
export type PauseRequest = z.infer<typeof PauseRequestSchema>;

/** Common error type — billing operations should never throw raw strings. */
export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400,
    public readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "BillingError";
  }
}
