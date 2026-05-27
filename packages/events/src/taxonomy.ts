/**
 * Canonical event taxonomy.
 *
 * Single source of truth for which event names exist in GoFunnelAI, organized
 * into the 9 buckets specified in Doc 03 §A.1–§A.9. Each domain module
 * (`events/identity.ts`, etc.) defines the Zod schema for its events.
 *
 * Bumping the taxonomy is breaking — coordinate via the engineering RFC.
 */

export const TAXONOMY = {
  identity: [
    "user_signed_up",
    "user_email_verified",
    "user_logged_in",
    "user_login_failed",
    "user_logged_out",
    "user_password_reset_requested",
    "user_password_changed",
    "user_mfa_enrolled",
    "user_mfa_disabled",
    "user_email_changed",
    "user_account_archived",
    "user_account_restored",
    "workspace_created",
    "workspace_member_invited",
    "workspace_member_joined",
    "workspace_member_removed",
    "workspace_member_role_changed",
    "workspace_ownership_transferred",
    "workspace_closed",
    "api_key_created",
    "api_key_revoked",
  ],
  generation: [
    "generation_started",
    "generation_completed",
    "generation_failed",
    "agent_completed",
    "quality_scored",
    "compliance_flagged",
    "human_review_required",
    "regeneration_started",
    "degradation_applied",
    "budget_warning",
  ],
  publish: [
    "funnel_published",
    "funnel_paused",
    "funnel_archived",
    "funnel_restored",
    "ab_winner_promoted",
    "case_study_generated",
    "case_study_published",
    "case_study_taken_down",
  ],
  distribution: [
    "ad_campaign_published",
    "ad_creative_rejected",
    "email_sent",
    "email_bounced",
    "email_complained",
    "sms_sent",
    "sms_stopped",
    "revtry_call_started",
    "revtry_call_completed",
    "revtry_call_blocked",
    "revtry_inbound_received",
  ],
  lead: [
    "lead_captured",
    "lead_qualified",
    "lead_booked",
    "lead_replied_sms",
    "first_lead_captured",
  ],
  revenue: [
    "payment_captured",
    "payment_failed",
    "refund_issued",
    "subscription_started",
    "subscription_canceled",
    "subscription_upgraded",
    "subscription_downgraded",
    "milestone_hit",
    "award_shipped",
    "award_delivered",
  ],
  subscription: [
    "trial_started",
    "trial_ending_t3",
    "trial_ending_t1",
    "card_expiring_t30",
    "card_expiring_t7",
    "account_past_due",
    "account_suspended",
    "account_restored",
  ],
  support: [
    "impersonation_started",
    "impersonation_ended",
    "admin_credit_applied",
    "admin_refund_issued",
    "admin_permission_denied",
    "internal_note_added",
    "pii_access_recorded",
  ],
  governance: [
    "phishing_blocked",
    "kyb_required",
    "kyb_passed",
    "kyb_failed",
    "offer_blocked",
    "affiliate_fraud_flagged",
    "ad_policy_failed",
    "payment_radar_flagged",
    "domain_reputation_alert",
    "ts_appeal_filed",
    "ts_appeal_resolved",
    "consent_recorded",
    "dsar_received",
    "dsar_completed",
  ],
} as const;

export type TaxonomyBucket = keyof typeof TAXONOMY;
export type EventName = (typeof TAXONOMY)[TaxonomyBucket][number];

const FLAT_INDEX = new Map<string, TaxonomyBucket>();
for (const [bucket, names] of Object.entries(TAXONOMY) as Array<[TaxonomyBucket, readonly string[]]>) {
  for (const n of names) FLAT_INDEX.set(n, bucket);
}

export function bucketOf(name: string): TaxonomyBucket | null {
  return FLAT_INDEX.get(name) ?? null;
}

export function isKnownEvent(name: string): name is EventName {
  return FLAT_INDEX.has(name);
}

export function allEventNames(): string[] {
  return [...FLAT_INDEX.keys()];
}
