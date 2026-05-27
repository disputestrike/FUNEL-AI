/**
 * Email adapter for the billing package.
 *
 * Wraps @funnel/email so callers can write tests without booting an email
 * transport. Production wires `setEmailSink(resendSink)` at boot.
 *
 * Templates referenced here MUST exist in @funnel/email's catalog. The
 * billing-specific template IDs are documented below.
 */

export const BILLING_EMAIL_TEMPLATES = {
  trial_started: "billing.trial_started",
  trial_ended: "billing.trial_ended",
  plan_upgraded: "billing.plan_upgraded",
  plan_downgraded: "billing.plan_downgraded",
  plan_paused: "billing.plan_paused",
  plan_resumed: "billing.plan_resumed",
  subscription_canceled: "billing.subscription_canceled",
  payment_succeeded: "billing.payment_succeeded",
  // Dunning sequence
  dunning_d0: "billing.dunning.d0_payment_failed",
  dunning_d3: "billing.dunning.d3_retry",
  dunning_d7: "billing.dunning.d7_final_notice",
  dunning_d14: "billing.dunning.d14_suspension_imminent",
  dunning_d21: "billing.dunning.d21_suspended",
  dunning_d28: "billing.dunning.d28_funnels_paused",
  dunning_d60: "billing.dunning.d60_deletion_warning",
  dunning_d90: "billing.dunning.d90_deleted",
  refund_issued: "billing.refund_issued",
  card_expiring_30d: "billing.card_expiring_30d",
  card_expiring_7d: "billing.card_expiring_7d",
  free_until_1k_activated: "billing.free_until_1k_activated",
} as const;

export type BillingEmailTemplate = keyof typeof BILLING_EMAIL_TEMPLATES;

export interface BillingEmailPayload {
  template: string; // canonical template ID
  workspace_id: string;
  to_user_id: string;
  data: Record<string, unknown>;
}

export type EmailSink = (payload: BillingEmailPayload) => void | Promise<void>;

const defaultSink: EmailSink = (payload) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ kind: "billing_email", ...payload }));
};

let currentSink: EmailSink = defaultSink;

export function setEmailSink(sink: EmailSink): void {
  currentSink = sink;
}

export async function sendBillingEmail(payload: BillingEmailPayload): Promise<void> {
  await currentSink(payload);
}
