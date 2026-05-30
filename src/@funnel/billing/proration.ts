/**
 * Mid-cycle proration math.
 *
 * Money handling rules (Doc 08 §65):
 *   - Store all amounts as integer cents (or micros). NEVER floats.
 *   - Round half-to-even (banker's rounding) at the very last step.
 *   - Currency = USD for all plan tiers; FX happens elsewhere.
 *
 * Algorithm:
 *   credit_cents  = floor(old_unit_cents * unused_seconds / period_seconds)
 *   charge_cents  = floor(new_unit_cents * unused_seconds / period_seconds)
 *   immediate    = max(0, charge_cents - credit_cents)
 *
 * The credit_cents is issued as an invoice line item; immediate is charged
 * via PayPal `captureSubscription` or Stripe's `proration_behavior` flag.
 */

import {
  BillingError,
  PLAN_PRICES_USD_CENTS,
  type BillingPlanSlug,
  type ProrationPreview,
  type Subscription,
} from "./types.js";
import { getBillingStore } from "./store.js";

export interface ProrationInput {
  subscription_id: string;
  to_plan: BillingPlanSlug;
  /** Optional override for testing — defaults to now(). */
  now?: Date;
}

export async function previewProration(input: ProrationInput): Promise<ProrationPreview> {
  const store = getBillingStore();
  const sub = await store.getSubscription(input.subscription_id);
  if (!sub) throw new BillingError("No subscription", "proration.no_subscription", 404);
  return computeProration(sub, input.to_plan, input.now ?? new Date());
}

/** Pure function — used by tests with snapshot fixtures. */
export function computeProration(
  sub: Subscription,
  to_plan: BillingPlanSlug,
  now: Date,
): ProrationPreview {
  const fromPlan = sub.plan as BillingPlanSlug;
  const oldUnitCents = PLAN_PRICES_USD_CENTS[fromPlan];
  const newUnitCents = PLAN_PRICES_USD_CENTS[to_plan];

  if (!sub.current_period_start || !sub.current_period_end) {
    throw new BillingError(
      "Subscription missing period boundaries — can't compute proration",
      "proration.missing_period",
      400,
    );
  }

  const periodStart = new Date(sub.current_period_start).getTime();
  const periodEnd = new Date(sub.current_period_end).getTime();
  const periodSeconds = Math.max(1, Math.floor((periodEnd - periodStart) / 1000));
  const unusedMs = Math.max(0, periodEnd - now.getTime());
  const unusedSeconds = Math.max(0, Math.floor(unusedMs / 1000));

  const credit_usd_cents = Math.floor((oldUnitCents * unusedSeconds) / periodSeconds);
  const charge_usd_cents = Math.floor((newUnitCents * unusedSeconds) / periodSeconds);
  const immediate_usd_cents = Math.max(0, charge_usd_cents - credit_usd_cents);

  return {
    workspace_id: sub.workspace_id,
    subscription_id: sub.id,
    from_plan: fromPlan,
    to_plan,
    credit_usd_cents,
    charge_usd_cents,
    immediate_usd_cents,
    next_billing_at: sub.current_period_end,
  };
}

/** Helpful banker's rounding (half-to-even) for any future percentage math. */
export function roundBankers(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}
