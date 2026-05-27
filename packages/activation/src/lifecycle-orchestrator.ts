/**
 * Lifecycle Orchestrator — central activation engine.
 *
 * Consumes the canonical event taxonomy (Doc 03) and drives a per-user state
 * machine:
 *
 *     pre_active ──(any activation step)──▶ in_progress
 *     in_progress ──(all 5 steps done)──▶ activated
 *     in_progress ──(D7 + no first lead OR D14 + not activated)──▶ stalled
 *     stalled ──(no session 14d)──▶ churned
 *     activated ──(refund OR cancel OR no session 30d)──▶ churned
 *
 * The orchestrator is event-driven for state changes and time-driven (via
 * the scheduler) for intervention firing. It is the only writer to
 * `lifecycle_user_state`.
 */

import {
  ActivationStep,
  INTERVENTION_KINDS,
  InterventionKind,
  LifecycleState,
  LifecycleUserState,
  PLAN_TIERS,
  PlanTier,
} from "./types.js";
import {
  ActivationEventEmitter,
  AwardsTracker,
  LifecycleStore,
  ReferralAskTrigger,
  markStep,
} from "./success-path.js";

/* ===== Inbound event shapes ============================================ */

/** All event shapes the orchestrator consumes. Subset of Doc 03 taxonomy.
 *  We accept the canonical event names verbatim — the orchestrator never
 *  rewrites them. */
export type LifecycleInboundEvent =
  | { name: "user_signed_up"; user_id: string; workspace_id: string; ts: string;
      industry: string | null; plan_tier: PlanTier }
  | { name: "funnel_created"; user_id: string; workspace_id: string; ts: string }
  | { name: "traffic_source_connected"; user_id: string; workspace_id: string; ts: string;
      source_type: "meta" | "google" | "tiktok" | "domain" | "linkedin" | "other" }
  | { name: "funnel_published"; user_id: string; workspace_id: string; ts: string }
  | { name: "ad_launched"; user_id: string; workspace_id: string; ts: string }
  | { name: "lead_captured"; user_id: string; workspace_id: string; ts: string;
      lead_id: string }
  | { name: "followup_completed"; user_id: string; workspace_id: string; ts: string;
      lead_id: string; channel: "call" | "sms" | "email"; outcome: string }
  | { name: "user_opted_out"; user_id: string; workspace_id: string; ts: string;
      level: "all" | "email" | "push" | "sms" | "in_app" | "revtry_sms" }
  | { name: "subscription_upgraded"; user_id: string; workspace_id: string; ts: string;
      from_plan: PlanTier; to_plan: PlanTier }
  | { name: "subscription_downgraded"; user_id: string; workspace_id: string; ts: string;
      from_plan: PlanTier; to_plan: PlanTier }
  | { name: "account_suspended"; user_id: string; workspace_id: string; ts: string }
  | { name: "account_restored"; user_id: string; workspace_id: string; ts: string }
  | { name: "subscription_canceled"; user_id: string; workspace_id: string; ts: string }
  | { name: "refund_issued"; user_id: string; workspace_id: string; ts: string };

/* ===== Scheduler port ================================================= */

/**
 * Minimal scheduler API that the orchestrator uses to (un)schedule
 * intervention jobs. Production implementation in ./scheduler.ts.
 */
export interface InterventionScheduler {
  scheduleIntervention(input: {
    user_id: string;
    workspace_id: string;
    kind: InterventionKind;
    fire_at: string;
    /** Idempotency key — collisions on rerun are silently no-op. */
    dedupe_key: string;
  }): Promise<void>;
  cancelInterventions(input: {
    user_id: string;
    kinds: InterventionKind[];
    reason: string;
  }): Promise<void>;
  cancelAll(input: { user_id: string; reason: string }): Promise<void>;
}

/* ===== Orchestrator ==================================================== */

export interface LifecycleOrchestratorDeps {
  store: LifecycleStore;
  scheduler: InterventionScheduler;
  emit: ActivationEventEmitter;
  awards: AwardsTracker;
  referrals: ReferralAskTrigger;
  /** Optional time source for deterministic tests. */
  now?: () => Date;
}

/**
 * Routes one inbound event into the orchestrator. Safe to call multiple times
 * for the same event (downstream writes are idempotent on `dedupe_key`).
 */
export async function handleEvent(
  evt: LifecycleInboundEvent,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const now = (deps.now ?? (() => new Date()))();

  switch (evt.name) {
    case "user_signed_up":
      return onSignup(evt, deps, now);
    case "funnel_created":
      return onActivationStep(evt, "first_funnel_generated", deps);
    case "traffic_source_connected":
      return onActivationStep(evt, "traffic_source_connected", deps);
    case "funnel_published":
    case "ad_launched":
      // Publish/launch alone does NOT close a Success Path row in our v1 model
      // (the spec collapses publish into source_connected). We still touch
      // last_action_at so dormancy logic stays fresh.
      return touchActivity(evt.user_id, evt.workspace_id, evt.ts, deps);
    case "lead_captured":
      return onActivationStep(evt, "first_lead_captured", deps);
    case "followup_completed":
      return onActivationStep(evt, "first_followup_completed", deps);
    case "user_opted_out":
      return onOptOut(evt, deps);
    case "subscription_upgraded":
      return onUpgrade(evt, deps);
    case "subscription_downgraded":
      return onDowngrade(evt, deps, now);
    case "account_suspended":
      return onAccountSuspended(evt, deps);
    case "account_restored":
      return onAccountRestored(evt, deps);
    case "subscription_canceled":
    case "refund_issued":
      return onTerminalAccountEvent(evt, deps);
  }
}

/* ===== Handlers ======================================================= */

async function onSignup(
  evt: Extract<LifecycleInboundEvent, { name: "user_signed_up" }>,
  deps: LifecycleOrchestratorDeps,
  now: Date,
): Promise<void> {
  const existing = await deps.store.load(evt.user_id);
  // Re-signup (tier downgrade → "fresh start" per Doc 06a §3) is handled by
  // resetting timestamps but keeping opt-outs.
  const seed: LifecycleUserState = {
    user_id: evt.user_id,
    workspace_id: evt.workspace_id,
    signed_up_at: evt.ts,
    industry: evt.industry,
    plan_tier: PLAN_TIERS.includes(evt.plan_tier) ? evt.plan_tier : "free",
    funnel_created_at: null,
    source_connected_at: null,
    published_at: null,
    first_lead_at: null,
    first_followup_at: null,
    activated_at: null,
    current_state: "pre_active",
    last_action_at: evt.ts,
    intervention_history: [],
    coaching_opt_out: existing?.coaching_opt_out ?? false,
    revtry_sms_opt_out: existing?.revtry_sms_opt_out ?? false,
    email_opt_out: existing?.email_opt_out ?? false,
    push_opt_out: existing?.push_opt_out ?? false,
    sms_opt_out: existing?.sms_opt_out ?? false,
    in_app_opt_out: existing?.in_app_opt_out ?? false,
    last_triggered_step: null,
    next_trigger_at: null,
    next_trigger_kind: null,
    pro_boost_extended_at: existing?.pro_boost_extended_at ?? null,
    pro_boost_extends_until: existing?.pro_boost_extends_until ?? null,
    workspace_suspended: false,
    workspace_canceled: false,
    updated_at: now.toISOString(),
  };
  await deps.store.save(seed);

  // Schedule the full intervention battery up front. Each job re-checks the
  // current state at fire-time, so cancellations don't have to be racy.
  await scheduleFullBattery(seed, deps);
}

async function onActivationStep(
  evt: { user_id: string; workspace_id: string; ts: string },
  step: ActivationStep,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  await markStep({
    workspace_id: evt.workspace_id,
    user_id: evt.user_id,
    step,
    at: new Date(evt.ts),
    store: deps.store,
    emit: deps.emit,
    awards: deps.awards,
    referrals: deps.referrals,
  });

  // After this transition the user might no longer need pending nudges:
  // e.g. once source is connected, the Day-2 SMS is moot.
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  await applyStepSuppressions(state, step, deps);
}

async function touchActivity(
  user_id: string,
  workspace_id: string,
  ts: string,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(user_id);
  if (!state || state.workspace_id !== workspace_id) return;
  await deps.store.save({ ...state, last_action_at: ts, updated_at: ts });
}

async function onOptOut(
  evt: Extract<LifecycleInboundEvent, { name: "user_opted_out" }>,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  const next = { ...state, updated_at: evt.ts };
  switch (evt.level) {
    case "all":
      next.coaching_opt_out = true;
      break;
    case "email":
      next.email_opt_out = true;
      break;
    case "push":
      next.push_opt_out = true;
      break;
    case "sms":
      next.sms_opt_out = true;
      break;
    case "in_app":
      next.in_app_opt_out = true;
      break;
    case "revtry_sms":
      next.revtry_sms_opt_out = true;
      break;
  }
  await deps.store.save(next);
  if (evt.level === "all") {
    await deps.scheduler.cancelAll({
      user_id: evt.user_id,
      reason: "coaching_opt_out",
    });
  }
}

async function onUpgrade(
  evt: Extract<LifecycleInboundEvent, { name: "subscription_upgraded" }>,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  await deps.store.save({ ...state, plan_tier: evt.to_plan, updated_at: evt.ts });
  // Suppress D14 upgrade ask — they've already upgraded.
  await deps.scheduler.cancelInterventions({
    user_id: evt.user_id,
    kinds: ["d14_paid_ask"],
    reason: "already_upgraded",
  });
}

async function onDowngrade(
  evt: Extract<LifecycleInboundEvent, { name: "subscription_downgraded" }>,
  deps: LifecycleOrchestratorDeps,
  now: Date,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  // "Restart Day 0 sequence on the downgrade date, branded as 'fresh start.'"
  // — Doc 06a §3 Trigger override matrix.
  await onSignup(
    {
      name: "user_signed_up",
      user_id: evt.user_id,
      workspace_id: evt.workspace_id,
      ts: evt.ts,
      industry: state.industry,
      plan_tier: evt.to_plan,
    },
    deps,
    now,
  );
}

async function onAccountSuspended(
  evt: Extract<LifecycleInboundEvent, { name: "account_suspended" }>,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  await deps.store.save({ ...state, workspace_suspended: true, updated_at: evt.ts });
  await deps.scheduler.cancelAll({
    user_id: evt.user_id,
    reason: "workspace_suspended",
  });
}

async function onAccountRestored(
  evt: Extract<LifecycleInboundEvent, { name: "account_restored" }>,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  await deps.store.save({ ...state, workspace_suspended: false, updated_at: evt.ts });
  // Do not auto-reschedule retroactive interventions; CS team manually triages.
}

async function onTerminalAccountEvent(
  evt: Extract<LifecycleInboundEvent, { name: "subscription_canceled" | "refund_issued" }>,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(evt.user_id);
  if (!state) return;
  // "Refund issued → Cease all sequences immediately." — Doc 06a §3.
  await transitionState(state, "churned", evt.ts, deps);
  await deps.scheduler.cancelAll({
    user_id: evt.user_id,
    reason: evt.name,
  });
}

/* ===== State transition + suppression helpers ========================= */

async function transitionState(
  state: LifecycleUserState,
  to: LifecycleState,
  ts: string,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  if (state.current_state === to) return;
  await deps.store.save({
    ...state,
    current_state: to,
    last_action_at: ts,
    updated_at: ts,
  });
  await deps.emit("lifecycle_transition", {
    user_id: state.user_id,
    workspace_id: state.workspace_id,
    from: state.current_state,
    to,
    ts,
  });
}

/**
 * Cancel future interventions made moot by a step completion.
 */
async function applyStepSuppressions(
  state: LifecycleUserState,
  step: ActivationStep,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  switch (step) {
    case "traffic_source_connected":
      await deps.scheduler.cancelInterventions({
        user_id: state.user_id,
        kinds: ["d1_connect_source", "d2_no_source"],
        reason: "traffic_source_connected",
      });
      break;
    case "first_lead_captured":
      await deps.scheduler.cancelInterventions({
        user_id: state.user_id,
        kinds: ["d3_no_lead", "d5_concierge", "d7_not_activated"],
        reason: "first_lead_captured",
      });
      break;
    case "first_followup_completed":
      if (state.activated_at) {
        // Path: activated -> cancel "not activated" branches, keep upgrade ask
        await deps.scheduler.cancelInterventions({
          user_id: state.user_id,
          kinds: ["d7_not_activated", "d14_exit"],
          reason: "activated",
        });
      }
      break;
    default:
      // signed_up + first_funnel_generated don't immediately suppress anything.
      break;
  }
}

/**
 * On signup, lay down the full set of pre-scheduled interventions. Each job
 * re-checks state at fire-time, so this is safe to call repeatedly.
 *
 * `dedupe_key` follows Doc 06a §7 — `(user_id, intervention_kind, signup_day)`.
 */
async function scheduleFullBattery(
  state: LifecycleUserState,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const signupDate = new Date(state.signed_up_at);
  const cohortDay = isoDate(signupDate);
  const offsets: Record<InterventionKind, number> = {
    d0_welcome: 0,
    d1_connect_source: 24,
    d2_no_source: 36,
    d3_no_lead: 24 * 3,
    d4_community: 24 * 4,
    d5_concierge: 24 * 5,
    d7_activated: 24 * 7,
    d7_not_activated: 24 * 7,
    d14_paid_ask: 24 * 14,
    d14_exit: 24 * 14,
  };
  for (const kind of INTERVENTION_KINDS) {
    const fireAt = new Date(signupDate.getTime() + offsets[kind] * 3_600_000);
    await deps.scheduler.scheduleIntervention({
      user_id: state.user_id,
      workspace_id: state.workspace_id,
      kind,
      fire_at: fireAt.toISOString(),
      dedupe_key: `${state.user_id}:${kind}:${cohortDay}`,
    });
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ===== Stall + churn evaluators (called by scheduler periodically) ===== */

/**
 * Periodic sweep: mark users `stalled` at D7-no-lead and `churned` at
 * D14-not-activated-plus-dormant. Idempotent.
 */
export async function evaluateStallChurn(
  user_id: string,
  deps: LifecycleOrchestratorDeps,
): Promise<void> {
  const state = await deps.store.load(user_id);
  if (!state) return;
  const now = (deps.now ?? (() => new Date()))();
  const ageHours = (now.getTime() - Date.parse(state.signed_up_at)) / 3_600_000;
  const sinceLastActionHours =
    (now.getTime() - Date.parse(state.last_action_at)) / 3_600_000;

  // Terminal already
  if (state.current_state === "churned" || state.workspace_canceled) return;

  if (state.activated_at) {
    // Activated → churn only on dormancy >30d
    if (sinceLastActionHours > 24 * 30) {
      await transitionState(state, "churned", now.toISOString(), deps);
    }
    return;
  }

  // Not activated
  if (ageHours >= 24 * 14) {
    if (sinceLastActionHours > 24 * 7) {
      await transitionState(state, "churned", now.toISOString(), deps);
    } else if (state.current_state !== "stalled") {
      await transitionState(state, "stalled", now.toISOString(), deps);
    }
  } else if (ageHours >= 24 * 7 && !state.first_lead_at) {
    if (state.current_state !== "stalled") {
      await transitionState(state, "stalled", now.toISOString(), deps);
    }
  }
}

/* ===== Helpers ======================================================== */

/**
 * Compute whether the user is currently eligible to receive interventions.
 * Triggers consult this BEFORE doing any sending work.
 */
export function isInterventionEligible(state: LifecycleUserState): {
  ok: boolean;
  reason: string | null;
} {
  if (state.workspace_suspended) return { ok: false, reason: "workspace_suspended" };
  if (state.workspace_canceled) return { ok: false, reason: "workspace_canceled" };
  if (state.coaching_opt_out) return { ok: false, reason: "coaching_opt_out" };
  if (state.current_state === "churned") return { ok: false, reason: "churned" };
  return { ok: true, reason: null };
}
