/**
 * Billing-package event emitter shim.
 *
 * @funnel/events ships with a fixed event catalog used by the Grader. The
 * billing service needs to emit canonical billing events (trial_started,
 * plan_upgraded, etc.) defined in Doc 03 §A.7. Until the master catalog is
 * extended we route every billing event through a dedicated sink so callers
 * can wire a single transport (PostHog / Kafka / fanout) without touching
 * each call-site.
 */

export type BillingEventName =
  | "trial_started"
  | "trial_ended"
  | "plan_upgraded"
  | "plan_downgraded"
  | "plan_paused"
  | "plan_resumed"
  | "subscription_canceled"
  | "subscription_renewed"
  | "payment_succeeded"
  | "payment_failed"
  | "refund_processed"
  | "account_suspended"
  | "account_restored"
  | "account_closed"
  | "admin_credit_applied"
  | "admin_refund_issued"
  | "recon_drift_detected"
  | "dunning_step_entered"
  | "dunning_step_executed"
  | "card_expiring_reminder"
  | "free_until_1k_threshold_crossed"
  | "webhook_verified"
  | "webhook_rejected";

export interface BillingEventEnvelope {
  event: BillingEventName;
  ts: number;
  payload: Record<string, unknown>;
}

export type BillingEventSink = (envelope: BillingEventEnvelope) => void | Promise<void>;

const defaultSink: BillingEventSink = (envelope) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(envelope));
};

let currentSink: BillingEventSink = defaultSink;

export function setBillingEventSink(sink: BillingEventSink): void {
  currentSink = sink;
}

export async function emitBilling(
  event: BillingEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  await currentSink({ event, ts: Date.now(), payload });
}
