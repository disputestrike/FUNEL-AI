/**
 * Zod schemas for Billing: Subscription, Plan, Invoice, Payment, Refund.
 */

import { z } from "zod";
import { PlanSlugSchema } from "./workspace.js";

export const SubscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "suspended",
]);

export const InvoiceStatusSchema = z.enum([
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const BillingIntervalSchema = z.enum(["month", "year"]);

const CurrencyCode = z.string().length(3);

const MoneyMicros = z.number().int();

export const PlanSchema = z.object({
  slug: PlanSlugSchema,
  name: z.string(),
  description: z.string(),
  price_monthly_usd_micros: MoneyMicros.nonnegative(),
  price_annual_usd_micros: MoneyMicros.nonnegative(),
  interval_options: z.array(BillingIntervalSchema).min(1),
  trial_days: z.number().int().nonnegative(),
  limits: z.object({
    funnels: z.number().int().nonnegative(),
    monthly_generation_budget_usd_micros: MoneyMicros.nonnegative(),
    leads_per_month: z.number().int().nonnegative(),
    revtry_minutes_per_month: z.number().int().nonnegative(),
    seats: z.number().int().positive(),
    custom_domains: z.number().int().nonnegative(),
    integrations: z.number().int().nonnegative(),
  }),
  features: z.object({
    revtry: z.boolean(),
    custom_domains: z.boolean(),
    white_label: z.boolean(),
    priority_support: z.boolean(),
    api_access: z.boolean(),
  }),
  is_public: z.boolean(),
  external_product_id: z.string().optional(),
});

export const SubscriptionSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  plan: PlanSlugSchema,
  status: SubscriptionStatusSchema,
  external_processor: z.enum(["stripe", "paddle"]),
  external_subscription_id: z.string().optional(),
  external_customer_id: z.string().optional(),
  current_period_start: z.string().datetime().optional(),
  current_period_end: z.string().datetime().optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  canceled_at: z.string().datetime().nullable().optional(),
  cancel_at_period_end: z.boolean(),
  cancellation_reason: z.string().nullable().optional(),
  paused_at: z.string().datetime().nullable().optional(),
  resume_at: z.string().datetime().nullable().optional(),
  unit_amount_micros: MoneyMicros.optional(),
  currency: CurrencyCode,
  quantity: z.number().int().positive(),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  amount_micros: MoneyMicros,
  currency: CurrencyCode,
  quantity: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const InvoiceSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  subscription_id: z.string().nullable().optional(),
  external_processor: z.enum(["stripe", "paddle"]),
  external_invoice_id: z.string().optional(),
  status: InvoiceStatusSchema,
  number: z.string().optional(),
  amount_due_micros: MoneyMicros,
  amount_paid_micros: MoneyMicros,
  amount_refunded_micros: MoneyMicros,
  tax_micros: MoneyMicros,
  currency: CurrencyCode,
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional(),
  due_at: z.string().datetime().optional(),
  paid_at: z.string().datetime().nullable().optional(),
  voided_at: z.string().datetime().nullable().optional(),
  hosted_url: z.string().url().optional(),
  pdf_url: z.string().url().optional(),
  line_items: z.array(InvoiceLineItemSchema),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PaymentStatusSchema = z.enum([
  "succeeded",
  "failed",
  "pending",
  "refunded",
  "partially_refunded",
]);

export const PaymentSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  invoice_id: z.string().nullable().optional(),
  external_processor: z.enum(["stripe", "paddle"]),
  external_payment_id: z.string().optional(),
  amount_micros: MoneyMicros,
  currency: CurrencyCode,
  status: PaymentStatusSchema,
  payment_method_type: z.string().optional(),
  failure_code: z.string().nullable().optional(),
  failure_text: z.string().nullable().optional(),
  attempt_n: z.number().int().positive(),
  paid_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const RefundSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  payment_id: z.string().nullable().optional(),
  external_processor: z.enum(["stripe", "paddle"]),
  external_refund_id: z.string().optional(),
  amount_micros: MoneyMicros,
  currency: CurrencyCode,
  reason_code: z.string().optional(),
  initiated_by_user_id: z.string().optional(),
  justification: z.string().optional(),
  refunded_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export const DunningStateSchema = z.object({
  subscription_id: z.string().min(1),
  workspace_id: z.string().min(1),
  current_step: z.number().int().nonnegative(),
  last_step_kind: z
    .enum(["soft_email", "firm_email", "in_app_banner", "feature_throttle", "suspend", "close"])
    .optional(),
  next_step_kind: z
    .enum(["soft_email", "firm_email", "in_app_banner", "feature_throttle", "suspend", "close"])
    .optional(),
  last_step_at: z.string().datetime().optional(),
  next_step_at: z.string().datetime().optional(),
  attempts: z.number().int().nonnegative(),
  resolved_at: z.string().datetime().nullable().optional(),
  suspended_at: z.string().datetime().nullable().optional(),
});

export const MoneySchema = z.object({
  amount_micros: MoneyMicros,
  currency: CurrencyCode,
});
