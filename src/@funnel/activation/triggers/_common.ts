/**
 * Shared scaffolding for every intervention trigger.
 *
 * A trigger is a function that, given a (user_id, workspace_id) at fire-time:
 *   1. Loads lifecycle state from the store
 *   2. Checks gating predicates (opt-out, suspended, dedupe, already-activated)
 *   3. Builds and enqueues a `NotificationMessage`
 *   4. Appends an `InterventionRecord` to lifecycle state
 *   5. Emits `activation_intervention_fired` (or `_suppressed`)
 *
 * Side effects are mediated by the `TriggerDeps` interface so every trigger
 * is testable with in-memory doubles.
 */

import { ulid } from "ulid";

import {
  ActivationEventEmitter,
  LifecycleStore,
} from "../success-path.js";
import {
  InterventionChannel,
  InterventionKind,
  InterventionRecord,
  LifecycleUserState,
  NotificationMessage,
  SenderPersona,
} from "../types.js";
import { isInterventionEligible } from "../lifecycle-orchestrator.js";

/* ===== Outbound adapter interfaces ==================================== */

/** Wraps @funnel/notifications. */
export interface NotificationQueue {
  enqueue(msg: NotificationMessage): Promise<{ accepted: boolean; dedupe_hit: boolean }>;
}

/** Wraps @funnel/email Resend adapter. */
export interface ResendEmailAdapter {
  send(input: {
    to_user_id: string;
    workspace_id: string;
    template_id: string;
    from_persona: SenderPersona;
    variables: Record<string, unknown>;
    idempotency_key: string;
  }): Promise<{ message_id: string }>;
}

/** Wraps SignalWire SMS via @funnel/integrations. */
export interface SignalWireSmsAdapter {
  send(input: {
    to_user_id: string;
    workspace_id: string;
    body: string;
    from_persona: SenderPersona;
    reply_keywords: string[];
    idempotency_key: string;
  }): Promise<{ message_id: string }>;
}

/** Wraps @funnel/revtry voice. */
export interface RevTryVoiceAdapter {
  startOutboundCall(input: {
    to_user_id: string;
    workspace_id: string;
    purpose: "oauth_screenshare" | "concierge" | "save_offer";
    callback_within_minutes: number;
    idempotency_key: string;
  }): Promise<{ call_id: string }>;
  hasReplyConsent(input: {
    user_id: string;
    keyword: "YES" | "STOP";
    within_hours: number;
  }): Promise<boolean>;
}

/** Wraps internal Slack notifier (concierge tasks, founder pings, etc.). */
export interface InternalSlackAdapter {
  postToChannel(input: {
    channel: string;
    blocks: Array<Record<string, unknown>>;
    text_fallback: string;
    idempotency_key: string;
  }): Promise<{ ts: string }>;
}

/** Wraps the CS-tool task creator (Linear / Zendesk / internal). */
export interface CsTaskAdapter {
  createTask(input: {
    user_id: string;
    workspace_id: string;
    kind: "concierge_call" | "final_outreach" | "founder_personal";
    assignee_role: "cs_rep" | "cs_lead" | "founder";
    sla_due_at: string;
    notes: string;
    idempotency_key: string;
  }): Promise<{ task_id: string }>;
}

/* ===== Aggregate dep bundle ============================================ */

export interface TriggerDeps {
  store: LifecycleStore;
  emit: ActivationEventEmitter;
  notifications: NotificationQueue;
  email: ResendEmailAdapter;
  sms: SignalWireSmsAdapter;
  revtry: RevTryVoiceAdapter;
  slack: InternalSlackAdapter;
  cs_tasks: CsTaskAdapter;
  /** Time source — overrideable in tests. */
  now?: () => Date;
}

/* ===== Trigger result ================================================= */

export type TriggerOutcome =
  | { fired: true; record: InterventionRecord }
  | { fired: false; record: InterventionRecord };

export interface TriggerContext {
  user_id: string;
  workspace_id: string;
  kind: InterventionKind;
}

/* ===== Channel-level opt-out gate ===================================== */

export function isChannelMuted(
  state: LifecycleUserState,
  channel: InterventionChannel,
): boolean {
  if (state.coaching_opt_out) return true;
  switch (channel) {
    case "email":
      return state.email_opt_out;
    case "sms":
      return state.sms_opt_out || state.revtry_sms_opt_out;
    case "push":
      return state.push_opt_out;
    case "in_app":
      return state.in_app_opt_out;
    case "call_task":
    case "voice":
    case "internal_slack":
      // Internal/CS-driven; users can't opt out of internal alerts.
      return false;
  }
}

/* ===== Cohort day (for dedupe keys) ==================================== */

export function cohortDay(state: LifecycleUserState): string {
  return state.signed_up_at.slice(0, 10);
}

/* ===== Standard intervention recorder ================================== */

/**
 * Run an intervention if eligible. Centralises:
 *   - workspace-state gate
 *   - dedupe via lifecycle_user_state.intervention_history
 *   - history append
 *   - event emission
 *
 * The trigger-specific work (build the notification message, hit the adapter)
 * happens inside `run`.
 */
export async function runIntervention<R>(args: {
  ctx: TriggerContext;
  deps: TriggerDeps;
  channel: InterventionChannel;
  sender: SenderPersona;
  template_id: string | null;
  /** If true, channel opt-out gates this trigger; if false (internal alerts),
   *  the trigger fires regardless. */
  user_facing: boolean;
  run: (state: LifecycleUserState) => Promise<{ ok: true; result: R } | { ok: false; reason: string }>;
}): Promise<{ outcome: TriggerOutcome; result?: R }> {
  const now = (args.deps.now ?? (() => new Date()))();
  const ts = now.toISOString();
  const state = await args.deps.store.load(args.ctx.user_id);

  if (!state) {
    const rec = makeRecord(args, ts, "suppressed", "user_state_missing", null);
    await emitFired(args, rec);
    return { outcome: { fired: false, record: rec } };
  }

  if (state.workspace_id !== args.ctx.workspace_id) {
    const rec = makeRecord(args, ts, "suppressed", "workspace_mismatch", null);
    await emitFired(args, rec);
    return { outcome: { fired: false, record: rec } };
  }

  const eligibility = isInterventionEligible(state);
  if (!eligibility.ok) {
    const rec = makeRecord(args, ts, "suppressed", eligibility.reason!, null);
    await persistAndEmit(args, state, rec);
    return { outcome: { fired: false, record: rec } };
  }

  if (args.user_facing && isChannelMuted(state, args.channel)) {
    const rec = makeRecord(args, ts, "suppressed", `channel_muted:${args.channel}`, null);
    await persistAndEmit(args, state, rec);
    return { outcome: { fired: false, record: rec } };
  }

  const dedupeKey = `${args.ctx.user_id}:${args.ctx.kind}:${cohortDay(state)}`;
  const alreadyFired = state.intervention_history.some(
    (h) => h.dedupe_key === dedupeKey && h.outcome === "fired",
  );
  if (alreadyFired) {
    const rec = makeRecord(args, ts, "suppressed", "dedupe", dedupeKey);
    // Don't append duplicate suppression rows — already audited.
    return { outcome: { fired: false, record: rec } };
  }

  try {
    const r = await args.run(state);
    if (!r.ok) {
      const rec = makeRecord(args, ts, "suppressed", r.reason, dedupeKey);
      await persistAndEmit(args, state, rec);
      return { outcome: { fired: false, record: rec } };
    }
    const rec = makeRecord(args, ts, "fired", null, dedupeKey);
    await persistAndEmit(args, state, rec);
    return { outcome: { fired: true, record: rec }, result: r.result };
  } catch (err) {
    const rec = makeRecord(
      args,
      ts,
      "failed",
      err instanceof Error ? err.message : "unknown_error",
      dedupeKey,
    );
    await persistAndEmit(args, state, rec);
    return { outcome: { fired: false, record: rec } };
  }
}

function makeRecord(
  args: {
    ctx: TriggerContext;
    channel: InterventionChannel;
    sender: SenderPersona;
    template_id: string | null;
  },
  ts: string,
  outcome: InterventionRecord["outcome"],
  reason: string | null,
  dedupeKey: string | null,
): InterventionRecord {
  return {
    kind: args.ctx.kind,
    channel: args.channel,
    sender_persona: args.sender,
    fired_at: ts,
    outcome,
    reason,
    dedupe_key: dedupeKey ?? `${args.ctx.user_id}:${args.ctx.kind}:no-state`,
    template_id: args.template_id,
  };
}

async function persistAndEmit(
  args: { ctx: TriggerContext; deps: TriggerDeps },
  state: LifecycleUserState,
  record: InterventionRecord,
): Promise<void> {
  const next: LifecycleUserState = {
    ...state,
    intervention_history: [...state.intervention_history, record],
    last_action_at: record.fired_at,
    updated_at: record.fired_at,
  };
  await args.deps.store.save(next);
  await emitFired(args, record);
}

async function emitFired(
  args: { ctx: TriggerContext; deps: TriggerDeps },
  record: InterventionRecord,
): Promise<void> {
  const eventName =
    record.outcome === "fired"
      ? "activation_intervention_fired"
      : record.outcome === "suppressed"
        ? "activation_intervention_suppressed"
        : "activation_intervention_failed";
  await args.deps.emit(eventName, {
    intervention_id: ulid(),
    user_id: args.ctx.user_id,
    workspace_id: args.ctx.workspace_id,
    kind: record.kind,
    channel: record.channel,
    sender_persona: record.sender_persona,
    template_id: record.template_id,
    fired_at: record.fired_at,
    outcome: record.outcome,
    reason: record.reason,
    dedupe_key: record.dedupe_key,
  });
}

/* ===== Quiet-hours helper ============================================= */

/**
 * Returns whether `at` falls within the user's local quiet hours (8pm–8am
 * local). `tz_offset_minutes` is the user's offset from UTC at `at` —
 * resolved by the caller from `users.timezone`.
 *
 * Quiet hours apply to SMS and voice only per Doc 06a §7.
 */
export function isQuietHours(at: Date, tz_offset_minutes: number): boolean {
  const localMs = at.getTime() + tz_offset_minutes * 60_000;
  const local = new Date(localMs);
  const h = local.getUTCHours();
  return h >= 21 || h < 8;
}
