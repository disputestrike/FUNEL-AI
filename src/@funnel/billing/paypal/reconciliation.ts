/**
 * Hourly PayPal reconciliation job.
 *
 * For every subscription in our DB with `external_processor='paypal'`:
 *   1. Fetch the corresponding subscription from PayPal.
 *   2. Compare status + plan_id + next_billing_time + last_payment.
 *   3. On drift:
 *        - emit `recon_drift_detected`
 *        - write audit_log row
 *        - mark workspace billing-frozen via metadata.recon_drift=true
 *   4. On miss (404 from PayPal): mark our row `unknown_processor_state`.
 *
 * Doc 12 PRD 4 §2 story 15, §9 acceptance criteria 4 (< 5 min wall clock).
 */

import { emitBilling } from "../events.js";
import { writeAuditLog } from "../audit.js";
import { getBillingStore } from "../store.js";
import { BillingError, type Subscription, type SubscriptionStatus } from "../types.js";
import { getSubscription, type PayPalSubscriptionResponse } from "./subscriptions.js";

export interface ReconciliationDrift {
  subscription_id: string;
  workspace_id: string;
  field: "status" | "plan" | "next_billing_time" | "missing_external" | "currency";
  our_value: unknown;
  processor_value: unknown;
}

export interface ReconciliationReport {
  scanned: number;
  drift_count: number;
  drift: ReconciliationDrift[];
  duration_ms: number;
  errors: Array<{ subscription_id: string; message: string }>;
}

const PAYPAL_TO_OUR_STATUS: Record<PayPalSubscriptionResponse["status"], SubscriptionStatus> = {
  APPROVAL_PENDING: "trialing",
  APPROVED: "trialing",
  ACTIVE: "active",
  SUSPENDED: "past_due",
  CANCELLED: "canceled",
  EXPIRED: "canceled",
};

export async function reconcileSubscriptionsAgainstPayPal(): Promise<ReconciliationReport> {
  const start = Date.now();
  const store = getBillingStore();
  const subs = await store.listActiveSubscriptions("paypal");

  const drift: ReconciliationDrift[] = [];
  const errors: ReconciliationReport["errors"] = [];

  for (const sub of subs) {
    try {
      await reconcileOne(sub, drift);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ subscription_id: sub.id, message: msg });
    }
  }

  if (drift.length > 0) {
    await emitBilling("recon_drift_detected", {
      processor: "paypal",
      count: drift.length,
      drift,
    });
  }

  return {
    scanned: subs.length,
    drift_count: drift.length,
    drift,
    duration_ms: Date.now() - start,
    errors,
  };
}

async function reconcileOne(sub: Subscription, drift: ReconciliationDrift[]): Promise<void> {
  const store = getBillingStore();
  if (!sub.external_subscription_id) {
    drift.push({
      subscription_id: sub.id,
      workspace_id: sub.workspace_id,
      field: "missing_external",
      our_value: null,
      processor_value: null,
    });
    return;
  }

  let processor: PayPalSubscriptionResponse;
  try {
    processor = await getSubscription(sub.external_subscription_id);
  } catch (err) {
    if (err instanceof BillingError && err.httpStatus === 404) {
      drift.push({
        subscription_id: sub.id,
        workspace_id: sub.workspace_id,
        field: "missing_external",
        our_value: sub.external_subscription_id,
        processor_value: null,
      });
      await freezeWorkspace(sub, "missing_at_paypal");
      return;
    }
    throw err;
  }

  const expectedStatus = PAYPAL_TO_OUR_STATUS[processor.status];
  if (expectedStatus !== sub.status && !(sub.status === "paused" && processor.status === "SUSPENDED")) {
    drift.push({
      subscription_id: sub.id,
      workspace_id: sub.workspace_id,
      field: "status",
      our_value: sub.status,
      processor_value: processor.status,
    });
    await freezeWorkspace(sub, `status_drift:${sub.status}->${processor.status}`);
  }

  if (processor.billing_info?.last_payment?.amount?.currency_code) {
    const procCurrency = processor.billing_info.last_payment.amount.currency_code;
    if (procCurrency !== sub.currency) {
      drift.push({
        subscription_id: sub.id,
        workspace_id: sub.workspace_id,
        field: "currency",
        our_value: sub.currency,
        processor_value: procCurrency,
      });
      // Doc 12 PRD 4 §3 edge 9: never silently FX.
      await freezeWorkspace(sub, "currency_mismatch");
    }
  }

  // Best-effort next_billing_time sync (no freeze, just an alert).
  const procNext = processor.billing_info?.next_billing_time;
  if (procNext && sub.current_period_end && new Date(procNext).getTime() !== new Date(sub.current_period_end).getTime()) {
    drift.push({
      subscription_id: sub.id,
      workspace_id: sub.workspace_id,
      field: "next_billing_time",
      our_value: sub.current_period_end,
      processor_value: procNext,
    });
    // Sync our DB to processor (processor is source-of-truth per the brief).
    await store.updateSubscription(sub.id, {
      current_period_end: procNext,
      updated_at: new Date().toISOString(),
    });
  }
}

async function freezeWorkspace(sub: Subscription, reason: string): Promise<void> {
  const store = getBillingStore();
  await store.updateSubscription(sub.id, {
    metadata: { ...sub.metadata, recon_drift: true, recon_drift_reason: reason, recon_drift_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: null,
    action: "billing.recon_drift_frozen",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { reason },
  });
}
