/**
 * In-memory test doubles. Pure JS, no Postgres / Redis dependency.
 *
 * Keep the surface minimal â€” only the ports each test actually reaches for.
 */

import {
  AwardLevel,
  AwardRecord,
  ConciergeScoresheet,
  LifecycleUserState,
  NotificationMessage,
  PlanTier,
} from "../src/types.js";
import { ActivationStep } from "../src/types.js";
import {
  AwardsTracker,
  LifecycleStore,
  ReferralAskTrigger,
} from "../src/success-path.js";
import {
  CsTaskAdapter,
  InternalSlackAdapter,
  NotificationQueue,
  ResendEmailAdapter,
  RevTryVoiceAdapter,
  SignalWireSmsAdapter,
  TriggerDeps,
} from "../src/triggers/_common.js";
import { InterventionScheduler } from "../src/lifecycle-orchestrator.js";
import { ConciergeStore } from "../src/concierge-playbook.js";
import { CohortQueryStore } from "../src/cohort.js";
import { StalledWorkspaceQuery } from "../src/weekly-digest.js";
import { OptOutStore } from "../src/opt-out.js";

export class InMemoryLifecycleStore implements LifecycleStore {
  states = new Map<string, LifecycleUserState>();
  awards = new Map<string, AwardRecord>();
  medians: Array<{
    from: ActivationStep;
    to: ActivationStep;
    industry: string | null;
    hours: number;
  }> = [];

  async load(user_id: string): Promise<LifecycleUserState | null> {
    return this.states.get(user_id) ?? null;
  }
  async save(state: LifecycleUserState): Promise<void> {
    this.states.set(state.user_id, { ...state });
  }
  async medianHoursBetweenSteps(
    from: ActivationStep,
    to: ActivationStep,
    industry: string | null,
  ): Promise<number | null> {
    const hit = this.medians.find(
      (m) =>
        m.from === from && m.to === to && (m.industry ?? null) === (industry ?? null),
    );
    return hit?.hours ?? null;
  }
  async recordAward(award: AwardRecord): Promise<void> {
    this.awards.set(`${award.user_id}:${award.level}`, { ...award });
  }
  async loadAward(user_id: string, level: AwardLevel): Promise<AwardRecord | null> {
    return this.awards.get(`${user_id}:${level}`) ?? null;
  }
}

export class InMemoryEmitter {
  events: Array<{ name: string; payload: unknown; ts: number }> = [];
  emit = async (name: string, payload: Record<string, unknown>): Promise<void> => {
    this.events.push({ name, payload, ts: Date.now() });
  };
  byName(name: string): unknown[] {
    return this.events.filter((e) => e.name === name).map((e) => e.payload);
  }
}

export class InMemoryNotificationQueue implements NotificationQueue {
  messages: NotificationMessage[] = [];
  seen = new Set<string>();
  async enqueue(
    msg: NotificationMessage,
  ): Promise<{ accepted: boolean; dedupe_hit: boolean }> {
    if (this.seen.has(msg.dedupe_key)) {
      return { accepted: false, dedupe_hit: true };
    }
    this.seen.add(msg.dedupe_key);
    this.messages.push(msg);
    return { accepted: true, dedupe_hit: false };
  }
}

export class InMemoryEmail implements ResendEmailAdapter {
  sent: Array<{ template_id: string; to_user_id: string; idem: string; vars: Record<string, unknown> }> = [];
  async send(input: {
    to_user_id: string;
    workspace_id: string;
    template_id: string;
    from_persona: string;
    variables: Record<string, unknown>;
    idempotency_key: string;
  }): Promise<{ message_id: string }> {
    this.sent.push({
      template_id: input.template_id,
      to_user_id: input.to_user_id,
      idem: input.idempotency_key,
      vars: input.variables,
    });
    return { message_id: `mem_${this.sent.length}` };
  }
}

export class InMemorySms implements SignalWireSmsAdapter {
  sent: Array<{ to_user_id: string; body: string; idem: string }> = [];
  async send(input: {
    to_user_id: string;
    workspace_id: string;
    body: string;
    from_persona: string;
    reply_keywords: string[];
    idempotency_key: string;
  }): Promise<{ message_id: string }> {
    this.sent.push({
      to_user_id: input.to_user_id,
      body: input.body,
      idem: input.idempotency_key,
    });
    return { message_id: `sw_${this.sent.length}` };
  }
}

export class InMemoryRevTry implements RevTryVoiceAdapter {
  calls: Array<{ to_user_id: string; purpose: string; idem: string }> = [];
  yesReplies = new Set<string>();
  async startOutboundCall(input: {
    to_user_id: string;
    workspace_id: string;
    purpose: "oauth_screenshare" | "concierge" | "save_offer";
    callback_within_minutes: number;
    idempotency_key: string;
  }): Promise<{ call_id: string }> {
    this.calls.push({
      to_user_id: input.to_user_id,
      purpose: input.purpose,
      idem: input.idempotency_key,
    });
    return { call_id: `rv_${this.calls.length}` };
  }
  async hasReplyConsent(input: {
    user_id: string;
    keyword: "YES" | "STOP";
    within_hours: number;
  }): Promise<boolean> {
    return input.keyword === "YES" && this.yesReplies.has(input.user_id);
  }
}

export class InMemorySlack implements InternalSlackAdapter {
  posts: Array<{ channel: string; text: string; idem: string }> = [];
  async postToChannel(input: {
    channel: string;
    blocks: Array<Record<string, unknown>>;
    text_fallback: string;
    idempotency_key: string;
  }): Promise<{ ts: string }> {
    this.posts.push({
      channel: input.channel,
      text: input.text_fallback,
      idem: input.idempotency_key,
    });
    return { ts: `${Date.now()}` };
  }
}

export class InMemoryCsTasks implements CsTaskAdapter {
  tasks: Array<{
    user_id: string;
    kind: string;
    assignee_role: string;
    sla_due_at: string;
    idem: string;
  }> = [];
  async createTask(input: {
    user_id: string;
    workspace_id: string;
    kind: "concierge_call" | "final_outreach" | "founder_personal";
    assignee_role: "cs_rep" | "cs_lead" | "founder";
    sla_due_at: string;
    notes: string;
    idempotency_key: string;
  }): Promise<{ task_id: string }> {
    this.tasks.push({
      user_id: input.user_id,
      kind: input.kind,
      assignee_role: input.assignee_role,
      sla_due_at: input.sla_due_at,
      idem: input.idempotency_key,
    });
    return { task_id: `task_${this.tasks.length}` };
  }
}

export class InMemoryAwards implements AwardsTracker {
  minted: AwardRecord[] = [];
  async awardBronze(input: {
    user_id: string;
    workspace_id: string;
  }): Promise<AwardRecord> {
    const existing = this.minted.find(
      (m) => m.user_id === input.user_id && m.level === "bronze",
    );
    if (existing) return existing;
    const record: AwardRecord = {
      user_id: input.user_id,
      workspace_id: input.workspace_id,
      level: "bronze",
      awarded_at: new Date().toISOString(),
      share_card_url: `https://gofunnelai.com/awards/${input.user_id}/bronze.png`,
    };
    this.minted.push(record);
    return record;
  }
}

export class InMemoryReferrals implements ReferralAskTrigger {
  asks: Array<{ user_id: string; incentive_cents: number }> = [];
  async triggerReferralAsk(input: {
    user_id: string;
    workspace_id: string;
    incentive_cents: number;
  }): Promise<{ referral_campaign_id: string }> {
    const seen = this.asks.find((a) => a.user_id === input.user_id);
    if (seen) return { referral_campaign_id: `ref_${input.user_id}` };
    this.asks.push({ user_id: input.user_id, incentive_cents: input.incentive_cents });
    return { referral_campaign_id: `ref_${input.user_id}` };
  }
}

export class InMemoryScheduler implements InterventionScheduler {
  scheduled: Array<{
    user_id: string;
    kind: string;
    fire_at: string;
    dedupe_key: string;
  }> = [];
  cancelled: Array<{ user_id: string; kind: string | "ALL"; reason: string }> = [];
  async scheduleIntervention(input: {
    user_id: string;
    workspace_id: string;
    kind: import("../src/types.js").InterventionKind;
    fire_at: string;
    dedupe_key: string;
  }): Promise<void> {
    if (this.scheduled.some((s) => s.dedupe_key === input.dedupe_key)) return;
    this.scheduled.push({
      user_id: input.user_id,
      kind: input.kind,
      fire_at: input.fire_at,
      dedupe_key: input.dedupe_key,
    });
  }
  async cancelInterventions(input: {
    user_id: string;
    kinds: import("../src/types.js").InterventionKind[];
    reason: string;
  }): Promise<void> {
    for (const k of input.kinds) {
      this.cancelled.push({ user_id: input.user_id, kind: k, reason: input.reason });
      const idx = this.scheduled.findIndex(
        (s) => s.user_id === input.user_id && s.kind === k,
      );
      if (idx >= 0) this.scheduled.splice(idx, 1);
    }
  }
  async cancelAll(input: { user_id: string; reason: string }): Promise<void> {
    this.cancelled.push({ user_id: input.user_id, kind: "ALL", reason: input.reason });
    this.scheduled = this.scheduled.filter((s) => s.user_id !== input.user_id);
  }
}

export class InMemoryConciergeStore implements ConciergeStore {
  scoresheets: Array<ConciergeScoresheet & { id: string }> = [];
  async saveScoresheet(s: ConciergeScoresheet & { id: string }): Promise<void> {
    this.scoresheets.push({ ...s });
  }
}

export class InMemoryCohortStore implements CohortQueryStore, StalledWorkspaceQuery {
  rows: LifecycleUserState[] = [];
  paidUsers = new Set<string>();
  retentionPerUser = new Map<string, boolean>();

  async loadCohortRows(args: {
    from: string;
    to: string;
  }): Promise<LifecycleUserState[]> {
    return this.rows.filter(
      (r) => r.signed_up_at >= args.from && r.signed_up_at < args.to,
    );
  }
  async retentionRate(args: {
    user_ids: string[];
    from: string;
    to: string;
  }): Promise<number> {
    if (args.user_ids.length === 0) return 0;
    const retained = args.user_ids.filter((u) => this.retentionPerUser.get(u)).length;
    return Math.round((retained / args.user_ids.length) * 100) / 100;
  }
  async paidUpgradeRate(args: { user_ids: string[]; by: string }): Promise<number> {
    if (args.user_ids.length === 0) return 0;
    const paid = args.user_ids.filter((u) => this.paidUsers.has(u)).length;
    return Math.round((paid / args.user_ids.length) * 10_000) / 100;
  }
  async findStalled(args: {
    now: Date;
    min_age_days: number;
  }): Promise<LifecycleUserState[]> {
    return this.rows.filter(
      (r) =>
        !r.activated_at &&
        r.current_state !== "churned" &&
        args.now.getTime() - Date.parse(r.signed_up_at) >=
          args.min_age_days * 86_400_000,
    );
  }
}

export class InMemoryOptOutStore implements OptOutStore {
  workspaceMuteNonBilling = new Map<string, boolean>();
  async loadWorkspacePrefs(workspace_id: string): Promise<{
    workspace_mute_non_billing: boolean;
  }> {
    return {
      workspace_mute_non_billing: this.workspaceMuteNonBilling.get(workspace_id) ?? false,
    };
  }
}

/* ===== Builders ======================================================= */

export function makeState(overrides: Partial<LifecycleUserState> = {}): LifecycleUserState {
  const signedUp = overrides.signed_up_at ?? new Date().toISOString();
  return {
    user_id: "usr_test",
    workspace_id: "wsp_test",
    signed_up_at: signedUp,
    industry: "real_estate",
    plan_tier: "free" as PlanTier,
    funnel_created_at: null,
    source_connected_at: null,
    published_at: null,
    first_lead_at: null,
    first_followup_at: null,
    activated_at: null,
    current_state: "pre_active",
    last_action_at: signedUp,
    intervention_history: [],
    coaching_opt_out: false,
    revtry_sms_opt_out: false,
    email_opt_out: false,
    push_opt_out: false,
    sms_opt_out: false,
    in_app_opt_out: false,
    last_triggered_step: null,
    next_trigger_at: null,
    next_trigger_kind: null,
    pro_boost_extended_at: null,
    pro_boost_extends_until: null,
    workspace_suspended: false,
    workspace_canceled: false,
    updated_at: signedUp,
    ...overrides,
  };
}

export function makeTriggerDeps(
  overrides: Partial<TriggerDeps> = {},
): TriggerDeps & {
  _store: InMemoryLifecycleStore;
  _emitter: InMemoryEmitter;
  _notifications: InMemoryNotificationQueue;
  _email: InMemoryEmail;
  _sms: InMemorySms;
  _revtry: InMemoryRevTry;
  _slack: InMemorySlack;
  _cs: InMemoryCsTasks;
} {
  const store = (overrides.store as InMemoryLifecycleStore) ?? new InMemoryLifecycleStore();
  const emitter = new InMemoryEmitter();
  const notifications = new InMemoryNotificationQueue();
  const email = new InMemoryEmail();
  const sms = new InMemorySms();
  const revtry = new InMemoryRevTry();
  const slack = new InMemorySlack();
  const cs = new InMemoryCsTasks();
  return {
    store,
    emit: overrides.emit ?? emitter.emit,
    notifications,
    email,
    sms,
    revtry,
    slack,
    cs_tasks: cs,
    now: overrides.now,
    _store: store,
    _emitter: emitter,
    _notifications: notifications,
    _email: email,
    _sms: sms,
    _revtry: revtry,
    _slack: slack,
    _cs: cs,
  };
}
