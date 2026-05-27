/**
 * "Free until you make $1K" opt-in tracker.
 *
 * The customer opts into starting on Starter ($49/mo) but with $0 billed
 * until cumulative tracked revenue through their published funnels reaches
 * $1,000. Until then, account is on Starter tier with full Starter features.
 * Once threshold crosses, the next billing cycle bills normally.
 *
 * Doc 12 PRD 4 §2 story 13, §3 edge 15 (one-way ratchet — refunds decrement
 * the ledger but do NOT downgrade once threshold crossed).
 */

import { writeAuditLog } from "./audit.js";
import { BILLING_EMAIL_TEMPLATES, sendBillingEmail } from "./email.js";
import { emitBilling } from "./events.js";
import { BillingError, type FreeUntil1kState } from "./types.js";
import { getBillingStore } from "./store.js";

const THRESHOLD_USD_CENTS = 100_000; // $1,000

export async function enableFreeUntil1k(args: {
  workspace_id: string;
  actor_user_id: string;
}): Promise<FreeUntil1kState> {
  const store = getBillingStore();
  const existing = await store.getFreeUntil1kState(args.workspace_id);
  if (existing) return existing;
  const state: FreeUntil1kState = {
    workspace_id: args.workspace_id,
    cumulative_usd_cents: 0,
    threshold_crossed_at: null,
    source_funnels: [],
    charging_active: false,
  };
  await store.upsertFreeUntil1kState(state);
  await writeAuditLog({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.free_until_1k_enabled",
    resource_type: "workspace",
    resource_id: args.workspace_id,
    metadata: { threshold_usd_cents: THRESHOLD_USD_CENTS },
  });
  return state;
}

/**
 * Called by the funnel-checkout pipeline whenever a customer payment lands.
 * For refunds, pass a negative `delta_usd_cents`.
 */
export async function recordCustomerRevenue(args: {
  workspace_id: string;
  source_funnel_id: string;
  delta_usd_cents: number;
  external_payment_id: string;
}): Promise<FreeUntil1kState> {
  const store = getBillingStore();
  const state = await store.getFreeUntil1kState(args.workspace_id);
  if (!state) {
    // Workspace not opted-in; ignore silently — recording revenue is also done
    // by the analytics pipeline regardless.
    throw new BillingError("Workspace not opted into Free-Until-$1K", "free_until_1k.not_opted_in", 404);
  }
  const newTotal = state.cumulative_usd_cents + args.delta_usd_cents;
  const funnels = state.source_funnels.includes(args.source_funnel_id)
    ? state.source_funnels
    : [...state.source_funnels, args.source_funnel_id];

  let threshold_crossed_at = state.threshold_crossed_at;
  let charging_active = state.charging_active;

  // One-way ratchet: once crossed, never un-cross even if refunds drop us back below.
  if (!threshold_crossed_at && newTotal >= THRESHOLD_USD_CENTS) {
    threshold_crossed_at = new Date().toISOString();
    charging_active = true;
    await onThresholdCrossed(args.workspace_id);
  }

  const next: FreeUntil1kState = {
    ...state,
    cumulative_usd_cents: Math.max(0, newTotal),
    source_funnels: funnels,
    threshold_crossed_at,
    charging_active,
  };
  await store.upsertFreeUntil1kState(next);
  return next;
}

async function onThresholdCrossed(workspace_id: string): Promise<void> {
  const store = getBillingStore();
  const sub = await store.getSubscriptionByWorkspace(workspace_id);

  await emitBilling("free_until_1k_threshold_crossed", {
    workspace_id,
    crossed_at: new Date().toISOString(),
    subscription_id: sub?.id,
  });
  await emitBilling("plan_upgraded", {
    subscription_id: sub?.id ?? "",
    workspace_id,
    from_plan: "free_until_1k",
    to_plan: "starter",
    actor_user_id: null,
    effective_at: new Date().toISOString(),
    proration_amount_micros: 0,
  });
  await writeAuditLog({
    workspace_id,
    actor_user_id: null,
    action: "billing.free_until_1k_threshold_crossed",
    resource_type: "workspace",
    resource_id: workspace_id,
    metadata: { subscription_id: sub?.id },
  });
  if (sub) {
    await sendBillingEmail({
      template: BILLING_EMAIL_TEMPLATES.free_until_1k_activated,
      workspace_id,
      to_user_id: (sub.metadata.owner_user_id as string | undefined) ?? "",
      data: { next_billing_at: sub.current_period_end },
    });
  }
}

export const FREE_UNTIL_1K_THRESHOLD_USD_CENTS = THRESHOLD_USD_CENTS;
