/**
 * Success Path — the 5-step activation checklist.
 *
 * Surface area exposed to product UI (right-sidebar card), the lifecycle
 * orchestrator (state transitions), and the awards tracker.
 *
 * See doc 06a §2 for the in-product spec.
 */

import { ulid } from "ulid";

import {
  ACTIVATION_STEPS,
  ActivationStep,
  ActivationStepSchema,
  AwardLevel,
  AwardRecord,
  LifecycleUserState,
  SuccessPathStatus,
} from "./types.js";

/* ===== Persistence port =============================================== */

/**
 * Minimal datastore contract. Production wires this to @funnel/db (Postgres),
 * tests inject `InMemoryLifecycleStore` from ./_helpers. We deliberately do
 * NOT import a Prisma client here — keeps this package pure and unit-testable.
 */
export interface LifecycleStore {
  load(user_id: string): Promise<LifecycleUserState | null>;
  save(state: LifecycleUserState): Promise<void>;
  /** Returns the median hours observed between `from` and `to` step for users
   *  in `industry`, or null if fewer than 30 cohort observations exist. */
  medianHoursBetweenSteps(
    from: ActivationStep,
    to: ActivationStep,
    industry: string | null,
  ): Promise<number | null>;
  /** Award persistence (Awards tracker). */
  recordAward(award: AwardRecord): Promise<void>;
  loadAward(user_id: string, level: AwardLevel): Promise<AwardRecord | null>;
}

/* ===== Event sink port ================================================ */

/**
 * Adapter for @funnel/events. We accept arbitrary string event names because
 * the activation-specific events (`activation_step_completed`, `activated`,
 * `activation_intervention_*`) are emitted from this package and registered
 * upstream in Doc 03 §A.9 (governance/lifecycle extensions).
 */
export type ActivationEventEmitter = (
  name: string,
  payload: Record<string, unknown>,
) => Promise<void>;

/* ===== Referral + Awards ports ======================================== */

export interface ReferralAskTrigger {
  /**
   * Ask the user for a referral. Returns the in-app referral campaign id.
   * Doc 06a §3 Day 7 — emits one in-app modal + one email follow-up; this
   * port returns once the modal is queued.
   */
  triggerReferralAsk(input: {
    user_id: string;
    workspace_id: string;
    incentive_cents: number;
  }): Promise<{ referral_campaign_id: string }>;
}

export interface AwardsTracker {
  /**
   * Mints the Bronze badge, generates a shareable card, returns the URL.
   * Idempotent on (user_id, level).
   */
  awardBronze(input: {
    user_id: string;
    workspace_id: string;
  }): Promise<AwardRecord>;
}

/* ===== Constants ====================================================== */

const STEP_ORDER: Record<ActivationStep, number> = Object.fromEntries(
  ACTIVATION_STEPS.map((s, i) => [s, i] as const),
) as Record<ActivationStep, number>;

/* ===== Pure helpers =================================================== */

/**
 * Determine the next step the user must complete.
 * Returns `first_followup_completed` even when the user is already activated;
 * callers consult `is_activated` to know whether to render the checklist.
 */
export function nextStep(state: LifecycleUserState): ActivationStep {
  if (!state.funnel_created_at) return "first_funnel_generated";
  if (!state.source_connected_at) return "traffic_source_connected";
  if (!state.first_lead_at) return "first_lead_captured";
  if (!state.first_followup_at) return "first_followup_completed";
  return "first_followup_completed";
}

function completedSteps(state: LifecycleUserState): ActivationStep[] {
  const out: ActivationStep[] = ["signed_up"];
  if (state.funnel_created_at) out.push("first_funnel_generated");
  if (state.source_connected_at) out.push("traffic_source_connected");
  if (state.first_lead_at) out.push("first_lead_captured");
  if (state.first_followup_at) out.push("first_followup_completed");
  return out;
}

function completionTimestamps(
  state: LifecycleUserState,
): Partial<Record<ActivationStep, string>> {
  const out: Partial<Record<ActivationStep, string>> = {
    signed_up: state.signed_up_at,
  };
  if (state.funnel_created_at) out.first_funnel_generated = state.funnel_created_at;
  if (state.source_connected_at)
    out.traffic_source_connected = state.source_connected_at;
  if (state.first_lead_at) out.first_lead_captured = state.first_lead_at;
  if (state.first_followup_at)
    out.first_followup_completed = state.first_followup_at;
  return out;
}

/* ===== Public API ===================================================== */

/**
 * Snapshot of where a user is on the Success Path. Pure read — no writes.
 */
export async function getStatus(args: {
  workspace_id: string;
  user_id: string;
  store: LifecycleStore;
}): Promise<SuccessPathStatus | null> {
  const state = await args.store.load(args.user_id);
  if (!state) return null;
  if (state.workspace_id !== args.workspace_id) {
    // Defensive: workspace-id mismatch indicates an impersonation / RLS bug.
    return null;
  }

  const completed = completedSteps(state);
  const next = nextStep(state);
  const isActivated = !!state.activated_at;

  let estimatedHours: number | null = null;
  if (!isActivated) {
    const prior = completed[completed.length - 1];
    if (prior && prior !== next) {
      estimatedHours = await args.store.medianHoursBetweenSteps(
        prior,
        next,
        state.industry,
      );
    }
  }

  return {
    workspace_id: state.workspace_id,
    user_id: state.user_id,
    current_step: next,
    completed_steps: completed,
    completion_timestamps: completionTimestamps(state),
    progress_percent: Math.round((completed.length / ACTIVATION_STEPS.length) * 100),
    is_activated: isActivated,
    activated_at: state.activated_at,
    estimated_hours_to_next_step: estimatedHours,
  };
}

/**
 * Mark a step complete. Idempotent: re-marking a step does nothing and emits
 * no duplicate events.
 *
 * Side effects on transition:
 *   - emit `activation_step_completed` (always, on first mark)
 *   - if this completion fills all five steps → emit `activated`, mint Bronze,
 *     trigger referral ask. These three side effects are ALSO idempotent
 *     because they re-check the persisted `activated_at` before firing.
 *
 * Concurrency: callers should hold an advisory lock on (user_id) — typically
 * by running through the orchestrator's per-user event queue.
 */
export async function markStep(args: {
  workspace_id: string;
  user_id: string;
  step: ActivationStep;
  at?: Date;
  store: LifecycleStore;
  emit: ActivationEventEmitter;
  awards: AwardsTracker;
  referrals: ReferralAskTrigger;
  /** Referral incentive in USD cents. Default $25. */
  referral_incentive_cents?: number;
}): Promise<{
  was_new: boolean;
  activated_now: boolean;
  award?: AwardRecord;
  referral_campaign_id?: string;
}> {
  ActivationStepSchema.parse(args.step);
  const ts = (args.at ?? new Date()).toISOString();

  const state = await args.store.load(args.user_id);
  if (!state) {
    throw new Error(
      `markStep: no lifecycle state for user ${args.user_id} — onSignup must run first`,
    );
  }
  if (state.workspace_id !== args.workspace_id) {
    throw new Error(
      `markStep: workspace mismatch (${state.workspace_id} != ${args.workspace_id})`,
    );
  }

  // Idempotency: if this step's column is already set, no-op.
  const alreadySet = (() => {
    switch (args.step) {
      case "signed_up":
        return true; // implicit on row creation
      case "first_funnel_generated":
        return !!state.funnel_created_at;
      case "traffic_source_connected":
        return !!state.source_connected_at;
      case "first_lead_captured":
        return !!state.first_lead_at;
      case "first_followup_completed":
        return !!state.first_followup_at;
    }
  })();
  if (alreadySet) {
    return { was_new: false, activated_now: false };
  }

  // Mutate locally (timestamps).
  const next: LifecycleUserState = { ...state, last_action_at: ts, updated_at: ts };
  switch (args.step) {
    case "first_funnel_generated":
      next.funnel_created_at = ts;
      break;
    case "traffic_source_connected":
      next.source_connected_at = ts;
      break;
    case "first_lead_captured":
      next.first_lead_at = ts;
      break;
    case "first_followup_completed":
      next.first_followup_at = ts;
      break;
    case "signed_up":
      // no-op — already on row
      break;
  }

  // Compute newly-activated transition.
  const allDone =
    !!next.funnel_created_at &&
    !!next.source_connected_at &&
    !!next.first_lead_at &&
    !!next.first_followup_at;
  const becameActivatedNow = allDone && !state.activated_at;
  if (becameActivatedNow) {
    next.activated_at = ts;
    next.current_state = "activated";
  } else if (next.current_state === "pre_active") {
    next.current_state = "in_progress";
  }
  // Order matters: emit activation_step_completed BEFORE the `activated` event
  // so the downstream consumer sees the chronological transition.
  next.last_triggered_step = args.step;
  await args.store.save(next);

  await args.emit("activation_step_completed", {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    step: args.step,
    completed_at: ts,
    sequence: STEP_ORDER[args.step],
    occurred_id: ulid(),
  });

  let award: AwardRecord | undefined;
  let referralCampaign: string | undefined;
  if (becameActivatedNow) {
    await args.emit("activated", {
      user_id: args.user_id,
      workspace_id: args.workspace_id,
      activated_at: ts,
      time_from_signup_hours: hoursBetween(state.signed_up_at, ts),
      industry: state.industry,
      plan_tier: state.plan_tier,
    });

    // Bronze award — awards tracker is idempotent on (user_id, level).
    award = await args.awards.awardBronze({
      user_id: args.user_id,
      workspace_id: args.workspace_id,
    });

    // Referral ask — Day-7-activated path also fires this; both must be safe.
    const r = await args.referrals.triggerReferralAsk({
      user_id: args.user_id,
      workspace_id: args.workspace_id,
      incentive_cents: args.referral_incentive_cents ?? 2500,
    });
    referralCampaign = r.referral_campaign_id;
  }

  return {
    was_new: true,
    activated_now: becameActivatedNow,
    ...(award ? { award } : {}),
    ...(referralCampaign ? { referral_campaign_id: referralCampaign } : {}),
  };
}

/* ===== Utilities ====================================================== */

function hoursBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, (to - from) / 3_600_000);
}

export { STEP_ORDER };
