/**
 * Activation framework — public types.
 *
 * Mirrors the contract in docs/06a-customer-success-activation-framework.md.
 * Anything consumed by callers (orchestrator, scheduler, triggers, cohort,
 * dashboards) lives here.
 */

import { z } from "zod";

/* ===== Success Path =================================================== */

/**
 * The five canonical activation steps.
 *
 * Doc 06a §2 lists six display rows in the in-product checklist, but the
 * `signed_up` confirmation collapses with the implicit account-creation event
 * and "published OR ad launched" collapses into the source/publish step. Five
 * is the engineering invariant: five timestamps populated → user is activated.
 */
export const ACTIVATION_STEPS = [
  "signed_up",
  "first_funnel_generated",
  "traffic_source_connected",
  "first_lead_captured",
  "first_followup_completed",
] as const;

export type ActivationStep = (typeof ACTIVATION_STEPS)[number];

export const ActivationStepSchema = z.enum(ACTIVATION_STEPS);

/** State-machine state for the lifecycle orchestrator (one row per user). */
export const LIFECYCLE_STATES = [
  "pre_active",
  "in_progress",
  "activated",
  "stalled",
  "churned",
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Plan tiers that influence concierge escalation. */
export const PLAN_TIERS = [
  "free",
  "pro_boost",
  "pro",
  "scale",
  "agency",
] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export interface SuccessPathStatus {
  workspace_id: string;
  user_id: string;
  current_step: ActivationStep;
  completed_steps: ActivationStep[];
  /** ISO8601 per completed step. Keys are step names. */
  completion_timestamps: Partial<Record<ActivationStep, string>>;
  /** Percent complete, 0..100, integer. */
  progress_percent: number;
  /** Whether the all-completed activation has fired. */
  is_activated: boolean;
  /** ISO8601 when activation completed, if so. */
  activated_at: string | null;
  /** Median time-to-next-step in hours, computed from cohort medians for the
   *  user's industry. Null when no historical data exists. */
  estimated_hours_to_next_step: number | null;
}

/* ===== Lifecycle state row =========================================== */

/**
 * Materialized state row — one per user.
 *
 * Matches the `lifecycle_user_state` Postgres table in docs/06a §7. Stored
 * fields are written by the orchestrator; readers consume getStatus() rather
 * than this row directly so that derived metrics stay consistent.
 */
export interface LifecycleUserState {
  user_id: string;
  workspace_id: string;
  signed_up_at: string;
  industry: string | null;
  plan_tier: PlanTier;
  funnel_created_at: string | null;
  source_connected_at: string | null;
  published_at: string | null;
  first_lead_at: string | null;
  first_followup_at: string | null;
  activated_at: string | null;
  current_state: LifecycleState;
  last_action_at: string;
  intervention_history: InterventionRecord[];
  coaching_opt_out: boolean;
  revtry_sms_opt_out: boolean;
  email_opt_out: boolean;
  push_opt_out: boolean;
  sms_opt_out: boolean;
  in_app_opt_out: boolean;
  last_triggered_step: string | null;
  next_trigger_at: string | null;
  next_trigger_kind: InterventionKind | null;
  /** Save-offer tracking — only one Pro Boost extension per user. */
  pro_boost_extended_at: string | null;
  pro_boost_extends_until: string | null;
  /** Workspace-state cache — refreshed each orchestrator tick. */
  workspace_suspended: boolean;
  workspace_canceled: boolean;
  updated_at: string;
}

/* ===== Interventions =================================================== */

export const INTERVENTION_KINDS = [
  "d0_welcome",
  "d1_connect_source",
  "d2_no_source",
  "d3_no_lead",
  "d4_community",
  "d5_concierge",
  "d7_activated",
  "d7_not_activated",
  "d14_paid_ask",
  "d14_exit",
] as const;
export type InterventionKind = (typeof INTERVENTION_KINDS)[number];

export const INTERVENTION_CHANNELS = [
  "email",
  "sms",
  "in_app",
  "push",
  "call_task",
  "voice",
  "internal_slack",
] as const;
export type InterventionChannel = (typeof INTERVENTION_CHANNELS)[number];

export const SENDER_PERSONAS = [
  "cs_rep",
  "cs_lead",
  "founder",
  "revtry",
  "system",
] as const;
export type SenderPersona = (typeof SENDER_PERSONAS)[number];

/** Audit row appended to `lifecycle_user_state.intervention_history`. */
export interface InterventionRecord {
  kind: InterventionKind;
  channel: InterventionChannel;
  sender_persona: SenderPersona;
  /** ISO8601 — when the intervention was fired or scheduled-sent. */
  fired_at: string;
  /** "fired" = enqueued to notif engine; "suppressed" = skipped (opt-out, dedupe, suspended);
   *  "failed" = upstream rejected (still recorded for visibility). */
  outcome: "fired" | "suppressed" | "failed";
  /** Reason for suppression/failure — null on `fired`. */
  reason: string | null;
  dedupe_key: string;
  /** Optional template id passed to the notification engine. */
  template_id: string | null;
}

/* ===== Notification engine message shape =============================== */

/**
 * Message put on the notification queue. Mirrors Doc 06a §7 schema.
 *
 * This is the only side-effect surface the triggers emit. Anything Slack /
 * email / SMS specific lives behind the notification engine.
 */
export interface NotificationMessage {
  user_id: string;
  workspace_id: string;
  template_id: string;
  channel: InterventionChannel;
  sender_persona: SenderPersona;
  variables: Record<string, unknown>;
  /** ISO8601. */
  send_at: string;
  /** Event names that, if already fired, cancel this send. */
  suppress_if: string[];
  /** `${user_id}:${template_id}:${cohort_day}`. */
  dedupe_key: string;
  /** Free-form context for analytics. */
  metadata?: Record<string, unknown>;
}

/* ===== Cohort metrics ================================================== */

export interface CohortMetrics {
  /** ISO date of the Monday that starts the cohort week (UTC). */
  cohort_week: string;
  signups: number;
  pct_connected_source_by_d2: number;
  pct_first_lead_by_d7: number;
  pct_paid_upgrade_by_d14: number;
  pct_activated_by_d14: number;
  median_time_to_first_lead_days: number | null;
}

export interface CohortDropOffStep {
  step: ActivationStep;
  completion_rate: number;
  conditional_d30_retention: number;
  delta_retention_vs_prior_step: number;
}

export interface CohortLeakReport {
  cohort_week: string;
  steps: CohortDropOffStep[];
  biggest_drop_step: ActivationStep;
  biggest_delta_retention_step: ActivationStep;
  worsened_vs_baseline: boolean;
}

/* ===== Weekly digest =================================================== */

export interface WeeklyDigestPayload {
  for_week_starting: string;
  cohort: CohortMetrics;
  leak_report: CohortLeakReport;
  workspaces_stalled: Array<{
    workspace_id: string;
    user_id: string;
    plan_tier: PlanTier;
    days_since_signup: number;
    biggest_gap: ActivationStep;
  }>;
  activation_rate_trend_4w: Array<{ week: string; rate: number }>;
  /** Pre-rendered Slack-mrkdwn blocks ready for chat.postMessage. */
  slack_blocks: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: "mrkdwn" | "plain_text"; text: string };
  // Slack blocks are heterogenous — keep it open.
  [key: string]: unknown;
}

/* ===== Concierge ======================================================= */

export const CONCIERGE_DIMENSIONS = [
  "hook_clarity",
  "offer_market_fit",
  "traffic",
  "form_friction",
  "follow_up_speed",
  "ad_copy_alignment",
] as const;
export type ConciergeDimension = (typeof CONCIERGE_DIMENSIONS)[number];

export interface ConciergeScoresheet {
  workspace_id: string;
  user_id: string;
  called_at: string;
  called_by_user_id: string;
  caller_role: "cs_rep" | "cs_lead" | "founder";
  /** Each dimension scored 0..5; 0 = severe red flag, 5 = excellent. */
  scores: Record<ConciergeDimension, number>;
  /** Per-dimension qualitative notes — hashed before storage if user IDs leak. */
  notes: Record<ConciergeDimension, string>;
  user_promise_quote: string | null;
  action_items: string[];
  /** Highest tier reached on the escalation ladder during this touch. */
  escalation_level: 0 | 1 | 2 | 3 | 4;
}

/* ===== Opt-out ========================================================= */

export const OPT_OUT_LEVELS = [
  "all",
  "email",
  "push",
  "sms",
  "in_app",
] as const;
export type OptOutLevel = (typeof OPT_OUT_LEVELS)[number];

export interface OptOutPreferences {
  user_id: string;
  workspace_id: string;
  mute_all: boolean;
  mute_email: boolean;
  mute_push: boolean;
  mute_sms: boolean;
  mute_in_app: boolean;
  /** Workspace-level override toggled by Agency owners. */
  workspace_mute_non_billing: boolean;
  updated_at: string;
}

/* ===== Save offers ===================================================== */

export interface ProBoostExtensionResult {
  applied: boolean;
  reason: "ok" | "already_extended" | "ineligible" | "workspace_suspended";
  new_expiry: string | null;
  audit_id: string | null;
}

/* ===== Activation award (Bronze tracker) ============================== */

export const AWARDS_LEVELS = ["bronze", "silver", "gold", "platinum"] as const;
export type AwardLevel = (typeof AWARDS_LEVELS)[number];

export interface AwardRecord {
  user_id: string;
  workspace_id: string;
  level: AwardLevel;
  awarded_at: string;
  /** URL of the auto-generated shareable card. */
  share_card_url: string | null;
}
