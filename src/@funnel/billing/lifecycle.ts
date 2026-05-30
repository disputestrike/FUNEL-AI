/**
 * Subscription lifecycle state machine.
 *
 * States (per the brief):
 *
 *   free ─┬─► trial_active ─┬─► past_due ─► suspended ─► closed
 *         │                 │
 *         │                 └─► paid_active ─┬─► paused ──► paid_active
 *         │                                  │
 *         │                                  └─► canceled ─► closed
 *
 * Each transition:
 *   1. Validates the source state
 *   2. Writes the new subscription row
 *   3. Emits the canonical event
 *   4. Writes an audit_log row
 *   5. Triggers the matching transactional email
 *
 * Doc 12 PRD 4 §2 user stories 1–9; §9 acceptance criteria.
 */

import { createHash } from "node:crypto";

import { ulid } from "ulid";

import { writeAuditLog } from "./audit.js";
import { BILLING_EMAIL_TEMPLATES, sendBillingEmail } from "./email.js";
import { emitBilling } from "./events.js";
import { withIdempotency, randomIdempotencyKey } from "./idempotency.js";
import {
  BillingError,
  BillingPlanSlug,
  CancelRequest,
  CancelRequestSchema,
  PauseRequest,
  PauseRequestSchema,
  PLAN_PRICES_USD_CENTS,
  type Subscription,
  type SubscriptionStatus,
} from "./types.js";
import { getBillingStore } from "./store.js";

// Aliases for the lifecycle's "logical" state names from the brief. The
// store uses canonical Doc-03 statuses; we map between them.
export type LifecycleState =
  | "free"
  | "trial_active"
  | "paid_active"
  | "past_due"
  | "paused"
  | "suspended"
  | "canceled"
  | "closed";

/** Map subscription_status (DB) + plan to brief's lifecycle state. */
export function deriveLifecycleState(sub: Subscription): LifecycleState {
  if (sub.status === "canceled") {
    return sub.metadata.deleted_at ? "closed" : "canceled";
  }
  if (sub.status === "suspended") return "suspended";
  if (sub.status === "paused") return "paused";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "trialing") {
    return sub.plan === "free" ? "free" : "trial_active";
  }
  return "paid_active";
}

/** Allowed transitions table — invalid ones throw. */
const ALLOWED: Record<LifecycleState, LifecycleState[]> = {
  free: ["trial_active", "paid_active"],
  trial_active: ["paid_active", "canceled", "past_due", "free"],
  paid_active: ["past_due", "paused", "canceled"],
  past_due: ["paid_active", "suspended"],
  paused: ["paid_active", "canceled"],
  suspended: ["paid_active", "closed"],
  canceled: ["closed", "paid_active"], // resub-within-7-days re-activates
  closed: [],
};

function assertTransition(from: LifecycleState, to: LifecycleState): void {
  if (!ALLOWED[from].includes(to)) {
    throw new BillingError(
      `Invalid lifecycle transition: ${from} -> ${to}`,
      "lifecycle.invalid_transition",
      400,
      { from, to },
    );
  }
}

/** Helper: new ISO timestamp. */
const now = (): string => new Date().toISOString();
const isoPlusDays = (d: number): string => new Date(Date.now() + d * 86_400_000).toISOString();

// --------------------------------------------------------------------------
// 1. startTrial — free → trial_active (7-day Pro Boost)
// --------------------------------------------------------------------------
export async function startTrial(args: {
  workspace_id: string;
  actor_user_id: string;
  /** What plan they're trialing on; defaults to pro_boost_7d. */
  trial_plan?: BillingPlanSlug;
  trial_days?: number;
  acquisition_source?: string;
  idempotency_key?: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const trial_plan = args.trial_plan ?? "pro_boost_7d";
  const trial_days = args.trial_days ?? 7;
  const key = args.idempotency_key ?? `${args.workspace_id}_trial_${trial_plan}`;

  const wrapped = await withIdempotency(
    { key, scope: "billing.start_trial", workspace_id: args.workspace_id },
    async () => {
      let sub = await store.getSubscriptionByWorkspace(args.workspace_id);
      if (sub) {
        const from = deriveLifecycleState(sub);
        assertTransition(from, "trial_active");
        sub = await store.updateSubscription(sub.id, {
          plan: trial_plan,
          status: "trialing",
          trial_ends_at: isoPlusDays(trial_days),
          updated_at: now(),
        });
      } else {
        sub = await store.upsertSubscription({
          id: `sub_${ulid()}`,
          workspace_id: args.workspace_id,
          plan: trial_plan,
          status: "trialing",
          external_processor: "paypal",
          cancel_at_period_end: false,
          trial_ends_at: isoPlusDays(trial_days),
          currency: "USD",
          quantity: 1,
          metadata: { acquisition_source: args.acquisition_source ?? "unknown" },
          created_at: now(),
          updated_at: now(),
        });
      }

      await emitBilling("trial_started", {
        subscription_id: sub.id,
        workspace_id: args.workspace_id,
        plan: sub.plan,
        trial_ends_at: sub.trial_ends_at,
        acquisition_source: args.acquisition_source ?? "unknown",
      });
      await writeAuditLog({
        workspace_id: args.workspace_id,
        actor_user_id: args.actor_user_id,
        action: "billing.trial_started",
        resource_type: "subscription",
        resource_id: sub.id,
        metadata: { plan: trial_plan, trial_days },
      });
      await sendBillingEmail({
        template: BILLING_EMAIL_TEMPLATES.trial_started,
        workspace_id: args.workspace_id,
        to_user_id: args.actor_user_id,
        data: { plan: trial_plan, trial_ends_at: sub.trial_ends_at },
      });
      return sub;
    },
  );
  if (!wrapped.result) {
    // duplicate — refetch
    const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
    if (!sub) throw new BillingError("Idempotency replay missing subscription", "lifecycle.replay_missing", 500);
    return sub;
  }
  return wrapped.result;
}

// --------------------------------------------------------------------------
// 2. convertTrialToPaid — trial_active → paid_active
// --------------------------------------------------------------------------
export async function convertTrialToPaid(args: {
  workspace_id: string;
  actor_user_id: string;
  to_plan: BillingPlanSlug;
  external_subscription_id: string;
  external_customer_id?: string;
  processor: "paypal" | "stripe";
  /** Unit amount in USD micros. */
  unit_amount_micros?: number;
  current_period_start?: string;
  current_period_end?: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
  if (!sub) {
    throw new BillingError("No subscription to convert", "lifecycle.no_subscription", 404);
  }
  const from = deriveLifecycleState(sub);
  assertTransition(from, "paid_active");

  const cycle_end = args.current_period_end ?? isoPlusDays(30);
  const updated = await store.updateSubscription(sub.id, {
    plan: args.to_plan,
    status: "active",
    external_processor: args.processor,
    external_subscription_id: args.external_subscription_id,
    external_customer_id: args.external_customer_id,
    unit_amount_micros: args.unit_amount_micros ?? PLAN_PRICES_USD_CENTS[args.to_plan] * 10_000,
    trial_ends_at: null,
    current_period_start: args.current_period_start ?? now(),
    current_period_end: cycle_end,
    updated_at: now(),
  });

  await emitBilling("trial_ended", {
    subscription_id: sub.id,
    outcome: "converted",
    plan_at_conversion: args.to_plan,
  });
  await emitBilling("plan_upgraded", {
    subscription_id: sub.id,
    workspace_id: args.workspace_id,
    from_plan: sub.plan,
    to_plan: args.to_plan,
    actor_user_id: args.actor_user_id,
    effective_at: now(),
  });
  await writeAuditLog({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.trial_converted",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { to_plan: args.to_plan, processor: args.processor },
  });
  await sendBillingEmail({
    template: BILLING_EMAIL_TEMPLATES.plan_upgraded,
    workspace_id: args.workspace_id,
    to_user_id: args.actor_user_id,
    data: { plan: args.to_plan, next_billing_at: cycle_end },
  });
  return updated;
}

// --------------------------------------------------------------------------
// 3. upgrade (immediate, prorated)
// --------------------------------------------------------------------------
export async function upgrade(args: {
  workspace_id: string;
  actor_user_id: string;
  to_plan: BillingPlanSlug;
  /** Pre-computed by proration.ts. */
  proration_amount_usd_cents?: number;
  idempotency_key?: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const key = args.idempotency_key ?? `${args.workspace_id}_upg_${args.to_plan}`;
  const wrapped = await withIdempotency(
    { key, scope: "billing.upgrade", workspace_id: args.workspace_id },
    async () => {
      const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
      if (!sub) throw new BillingError("No subscription to upgrade", "lifecycle.no_subscription", 404);
      const from = deriveLifecycleState(sub);
      assertTransition(from, "paid_active");

      const fromPlan = sub.plan as BillingPlanSlug;
      const fromIdx = ranked.indexOf(fromPlan);
      const toIdx = ranked.indexOf(args.to_plan);
      if (toIdx <= fromIdx) {
        throw new BillingError(
          `Upgrade target must be a higher tier (${args.to_plan} <= ${fromPlan})`,
          "lifecycle.not_an_upgrade",
          400,
        );
      }

      const updated = await store.updateSubscription(sub.id, {
        plan: args.to_plan,
        status: "active",
        unit_amount_micros: PLAN_PRICES_USD_CENTS[args.to_plan] * 10_000,
        updated_at: now(),
      });

      await emitBilling("plan_upgraded", {
        subscription_id: sub.id,
        workspace_id: args.workspace_id,
        from_plan: fromPlan,
        to_plan: args.to_plan,
        actor_user_id: args.actor_user_id,
        effective_at: now(),
        proration_amount_micros: (args.proration_amount_usd_cents ?? 0) * 10_000,
      });
      await writeAuditLog({
        workspace_id: args.workspace_id,
        actor_user_id: args.actor_user_id,
        action: "billing.plan_upgraded",
        resource_type: "subscription",
        resource_id: sub.id,
        metadata: { from: fromPlan, to: args.to_plan, proration_usd_cents: args.proration_amount_usd_cents },
      });
      await sendBillingEmail({
        template: BILLING_EMAIL_TEMPLATES.plan_upgraded,
        workspace_id: args.workspace_id,
        to_user_id: args.actor_user_id,
        data: { plan: args.to_plan, proration_usd_cents: args.proration_amount_usd_cents ?? 0 },
      });
      return updated;
    },
  );
  if (!wrapped.result) {
    const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
    if (!sub) throw new BillingError("Idempotency replay missing subscription", "lifecycle.replay_missing", 500);
    return sub;
  }
  return wrapped.result;
}

const ranked: BillingPlanSlug[] = ["free", "pro_boost_7d", "starter", "growth", "scale", "agency"];

// --------------------------------------------------------------------------
// 4. downgrade (scheduled at next period end)
// --------------------------------------------------------------------------
export async function downgrade(args: {
  workspace_id: string;
  actor_user_id: string;
  to_plan: BillingPlanSlug;
  reason_code?: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
  if (!sub) throw new BillingError("No subscription", "lifecycle.no_subscription", 404);
  const fromPlan = sub.plan as BillingPlanSlug;
  const fromIdx = ranked.indexOf(fromPlan);
  const toIdx = ranked.indexOf(args.to_plan);
  if (toIdx >= fromIdx) {
    throw new BillingError(
      `Downgrade target must be a lower tier (${args.to_plan} >= ${fromPlan})`,
      "lifecycle.not_a_downgrade",
      400,
    );
  }
  const updated = await store.updateSubscription(sub.id, {
    metadata: { ...sub.metadata, scheduled_downgrade_to: args.to_plan, scheduled_downgrade_reason: args.reason_code },
    updated_at: now(),
  });
  await emitBilling("plan_downgraded", {
    subscription_id: sub.id,
    workspace_id: args.workspace_id,
    from_plan: fromPlan,
    to_plan: args.to_plan,
    actor_user_id: args.actor_user_id,
    effective_at: sub.current_period_end,
    reason_code: args.reason_code,
  });
  await writeAuditLog({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.plan_downgrade_scheduled",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { from: fromPlan, to: args.to_plan, effective_at: sub.current_period_end, reason_code: args.reason_code },
  });
  await sendBillingEmail({
    template: BILLING_EMAIL_TEMPLATES.plan_downgraded,
    workspace_id: args.workspace_id,
    to_user_id: args.actor_user_id,
    data: { from: fromPlan, to: args.to_plan, effective_at: sub.current_period_end },
  });
  return updated;
}

// --------------------------------------------------------------------------
// 5. pauseSubscription — paid_active → paused (max 90 days)
// --------------------------------------------------------------------------
const MAX_PAUSE_DAYS_PER_YEAR = 90;

export async function pauseSubscription(req: PauseRequest): Promise<Subscription> {
  PauseRequestSchema.parse(req);
  const store = getBillingStore();
  const sub = await store.getSubscription(req.subscription_id);
  if (!sub) throw new BillingError("Subscription not found", "lifecycle.no_subscription", 404);
  const from = deriveLifecycleState(sub);
  assertTransition(from, "paused");

  // Enforce 90-day cap in 12-month rolling window.
  const usedDays = Number(sub.metadata.pause_days_used_12mo ?? 0);
  if (usedDays + req.duration_days > MAX_PAUSE_DAYS_PER_YEAR) {
    throw new BillingError(
      `Pause exceeds 90-day cap (already used ${usedDays} of 90 days in last 12 months)`,
      "lifecycle.pause_cap_exceeded",
      400,
      { used: usedDays, requested: req.duration_days, cap: MAX_PAUSE_DAYS_PER_YEAR },
    );
  }
  if ((sub.plan as BillingPlanSlug) === "free" || (sub.plan as BillingPlanSlug) === "starter") {
    throw new BillingError(
      "Pause is available on Growth and above",
      "lifecycle.pause_not_eligible",
      400,
    );
  }

  const resume_at = isoPlusDays(req.duration_days);
  const updated = await store.updateSubscription(sub.id, {
    status: "paused",
    paused_at: now(),
    resume_at,
    metadata: {
      ...sub.metadata,
      pause_days_used_12mo: usedDays + req.duration_days,
      funnels_watermarked: true,
    },
    updated_at: now(),
  });
  await emitBilling("plan_paused", {
    subscription_id: sub.id,
    workspace_id: sub.workspace_id,
    actor_user_id: req.actor_user_id,
    resume_at,
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: req.actor_user_id,
    action: "billing.subscription_paused",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { resume_at, duration_days: req.duration_days },
  });
  await sendBillingEmail({
    template: BILLING_EMAIL_TEMPLATES.plan_paused,
    workspace_id: sub.workspace_id,
    to_user_id: req.actor_user_id,
    data: { resume_at },
  });
  return updated;
}

// --------------------------------------------------------------------------
// 6. resumeSubscription — paused → paid_active
// --------------------------------------------------------------------------
export async function resumeSubscription(args: {
  workspace_id: string;
  subscription_id: string;
  actor_user_id: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const sub = await store.getSubscription(args.subscription_id);
  if (!sub) throw new BillingError("Subscription not found", "lifecycle.no_subscription", 404);
  const from = deriveLifecycleState(sub);
  assertTransition(from, "paid_active");

  const updated = await store.updateSubscription(sub.id, {
    status: "active",
    paused_at: null,
    resume_at: null,
    metadata: { ...sub.metadata, funnels_watermarked: false },
    updated_at: now(),
  });
  await emitBilling("plan_resumed", {
    subscription_id: sub.id,
    workspace_id: sub.workspace_id,
    actor_user_id: args.actor_user_id,
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.subscription_resumed",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: {},
  });
  await sendBillingEmail({
    template: BILLING_EMAIL_TEMPLATES.plan_resumed,
    workspace_id: sub.workspace_id,
    to_user_id: args.actor_user_id,
    data: {},
  });
  return updated;
}

// --------------------------------------------------------------------------
// 7. cancelSubscription — paid_active|paused → canceled (effective end-of-cycle)
// --------------------------------------------------------------------------
export async function cancelSubscription(req: CancelRequest): Promise<Subscription> {
  CancelRequestSchema.parse(req);
  const store = getBillingStore();
  const sub = await store.getSubscription(req.subscription_id);
  if (!sub) throw new BillingError("Subscription not found", "lifecycle.no_subscription", 404);
  const from = deriveLifecycleState(sub);
  assertTransition(from, "canceled");

  // Hash the feedback text for storage (don't store raw PII free-text).
  const feedback_hash = req.feedback_text
    ? createHash("sha256").update(req.feedback_text).digest("hex")
    : null;

  const updated = await store.updateSubscription(sub.id, {
    status: sub.current_period_end ? sub.status : "canceled",
    canceled_at: now(),
    cancel_at_period_end: true,
    cancellation_reason: req.reason_code,
    metadata: {
      ...sub.metadata,
      cancellation_feedback_hash: feedback_hash,
      cancellation_initiated_at: now(),
      scheduled_deletion_at: sub.current_period_end
        ? new Date(new Date(sub.current_period_end).getTime() + 30 * 86_400_000).toISOString()
        : isoPlusDays(30),
    },
    updated_at: now(),
  });
  await emitBilling("subscription_canceled", {
    subscription_id: sub.id,
    actor_user_id: req.actor_user_id,
    effective_at: sub.current_period_end ?? now(),
    reason_code: req.reason_code,
    feedback_hash,
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: req.actor_user_id,
    action: "billing.subscription_canceled",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { reason_code: req.reason_code, effective_at: sub.current_period_end ?? now() },
  });
  await sendBillingEmail({
    template: BILLING_EMAIL_TEMPLATES.subscription_canceled,
    workspace_id: sub.workspace_id,
    to_user_id: req.actor_user_id,
    data: { effective_at: sub.current_period_end, reason_code: req.reason_code },
  });
  return updated;
}

// --------------------------------------------------------------------------
// 8. renewSubscription (called by webhooks on successful invoice.paid)
// --------------------------------------------------------------------------
export async function renewSubscription(args: {
  subscription_id: string;
  new_period_start: string;
  new_period_end: string;
  invoice_amount_micros: number;
  currency: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const sub = await store.getSubscription(args.subscription_id);
  if (!sub) throw new BillingError("Subscription not found", "lifecycle.no_subscription", 404);

  const updated = await store.updateSubscription(sub.id, {
    status: "active",
    current_period_start: args.new_period_start,
    current_period_end: args.new_period_end,
    updated_at: now(),
  });
  await emitBilling("subscription_renewed", {
    subscription_id: sub.id,
    workspace_id: sub.workspace_id,
    new_period_end: args.new_period_end,
    amount_micros: args.invoice_amount_micros,
    currency: args.currency,
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: null,
    action: "billing.subscription_renewed",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { new_period_end: args.new_period_end },
  });
  return updated;
}

// --------------------------------------------------------------------------
// Misc helpers
// --------------------------------------------------------------------------

export { assertTransition as _internalAssertTransition };

/** Exported for direct admin reach into the state machine (with an audit row). */
export async function forceTransitionForAdmin(args: {
  workspace_id: string;
  subscription_id: string;
  actor_user_id: string;
  target_status: SubscriptionStatus;
  justification_ticket_id: string;
}): Promise<Subscription> {
  const store = getBillingStore();
  const sub = await store.getSubscription(args.subscription_id);
  if (!sub) throw new BillingError("Subscription not found", "lifecycle.no_subscription", 404);
  const updated = await store.updateSubscription(sub.id, {
    status: args.target_status,
    updated_at: now(),
  });
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.admin_force_transition",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: {
      target: args.target_status,
      justification_ticket_id: args.justification_ticket_id,
      previous_status: sub.status,
    },
  });
  // Random key — admin overrides should always run; no replay dedupe.
  void randomIdempotencyKey;
  return updated;
}
