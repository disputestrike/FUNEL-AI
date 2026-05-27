/**
 * Billing domain types: Subscription, Plan, Invoice, Payment, Refund,
 * DunningState.
 *
 * Money is stored as `BIGINT` micros (one-millionth of the currency's major
 * unit). Cents = micros / 10_000. Never use floats. Currency codes are ISO
 * 4217 (`USD`, `EUR`, `GBP`, etc.).
 */

import type { PlanSlug, UserId, WorkspaceId } from "./workspace.js";
import type { Money } from "../utils/money.js";

export type SubscriptionId = string;
export type InvoiceId = string;
export type PaymentId = string;
export type RefundId = string;

export enum SubscriptionStatus {
  Trialing = "trialing",
  Active = "active",
  PastDue = "past_due",
  Paused = "paused",
  Canceled = "canceled",
  Suspended = "suspended",
}

export enum InvoiceStatus {
  Draft = "draft",
  Open = "open",
  Paid = "paid",
  Void = "void",
  Uncollectible = "uncollectible",
}

export type BillingInterval = "month" | "year";

/**
 * Plan is the catalog row, not a subscription instance. Plans are loaded from
 * `constants/plans.ts` at boot.
 */
export interface Plan {
  slug: PlanSlug;
  name: string;
  description: string;
  /** Price per interval, in USD micros. Other currencies derive at checkout. */
  price_monthly_usd_micros: number;
  price_annual_usd_micros: number;
  interval_options: BillingInterval[];
  trial_days: number;
  /** Hard limits enforced by `@funnel/cost-governor`. */
  limits: {
    funnels: number;
    /** Generation budget per month in USD micros. */
    monthly_generation_budget_usd_micros: number;
    leads_per_month: number;
    revtry_minutes_per_month: number;
    seats: number;
    custom_domains: number;
    integrations: number;
  };
  /** Feature flags this plan unlocks. Mirrors keys in `WorkspaceFeatureFlags`. */
  features: {
    revtry: boolean;
    custom_domains: boolean;
    white_label: boolean;
    priority_support: boolean;
    api_access: boolean;
  };
  is_public: boolean;
  /** Stripe product ID in production. */
  external_product_id?: string;
}

export interface Subscription {
  id: SubscriptionId;
  workspace_id: WorkspaceId;
  plan: PlanSlug;
  status: SubscriptionStatus;
  external_processor: "stripe" | "paddle";
  external_subscription_id?: string;
  external_customer_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  trial_ends_at?: string | null;
  canceled_at?: string | null;
  cancel_at_period_end: boolean;
  cancellation_reason?: string | null;
  paused_at?: string | null;
  resume_at?: string | null;
  unit_amount_micros?: number;
  currency: string; // ISO 4217
  quantity: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  description: string;
  amount_micros: number;
  currency: string;
  quantity: number;
  /** Free-form tags, e.g. `["plan:growth", "seat:user_01..."]`. */
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: InvoiceId;
  workspace_id: WorkspaceId;
  subscription_id?: SubscriptionId | null;
  external_processor: "stripe" | "paddle";
  external_invoice_id?: string;
  status: InvoiceStatus;
  number?: string;
  amount_due_micros: number;
  amount_paid_micros: number;
  amount_refunded_micros: number;
  tax_micros: number;
  currency: string;
  period_start?: string;
  period_end?: string;
  due_at?: string;
  paid_at?: string | null;
  voided_at?: string | null;
  hosted_url?: string;
  pdf_url?: string;
  line_items: InvoiceLineItem[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus =
  | "succeeded"
  | "failed"
  | "pending"
  | "refunded"
  | "partially_refunded";

export interface Payment {
  id: PaymentId;
  workspace_id: WorkspaceId;
  invoice_id?: InvoiceId | null;
  external_processor: "stripe" | "paddle";
  external_payment_id?: string;
  amount_micros: number;
  currency: string;
  status: PaymentStatus;
  payment_method_type?: string;
  failure_code?: string | null;
  failure_text?: string | null;
  attempt_n: number;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: RefundId;
  workspace_id: WorkspaceId;
  payment_id?: PaymentId | null;
  external_processor: "stripe" | "paddle";
  external_refund_id?: string;
  amount_micros: number;
  currency: string;
  reason_code?: string;
  initiated_by_user_id?: UserId;
  justification?: string;
  refunded_at?: string;
  created_at: string;
}

export type DunningStepKind =
  | "soft_email"
  | "firm_email"
  | "in_app_banner"
  | "feature_throttle"
  | "suspend"
  | "close";

/**
 * DunningState tracks the per-subscription dunning journey. The dunning
 * service emits `dunning_step_executed` events keyed on this state.
 */
export interface DunningState {
  subscription_id: SubscriptionId;
  workspace_id: WorkspaceId;
  current_step: number; // 0-indexed
  last_step_kind?: DunningStepKind;
  next_step_kind?: DunningStepKind;
  last_step_at?: string;
  next_step_at?: string;
  attempts: number;
  resolved_at?: string | null;
  /** When the workspace was suspended (if ever). */
  suspended_at?: string | null;
}

/** Helper formatter for an Invoice — turns the row into a `Money` value. */
export function invoiceAmountDue(inv: Invoice): Money {
  return {
    amount_micros: inv.amount_due_micros,
    currency: inv.currency,
  };
}
