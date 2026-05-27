/**
 * Dunning state machine â€” D0/D3/D7/D14/D21/D28/D60/D90.
 *
 * Step semantics (per the brief):
 *   D0  â†’ charge fails â†’ past_due, dunning email 1
 *   D3  â†’ retry â†’ email 2
 *   D7  â†’ retry â†’ "final notice" email 3
 *   D14 â†’ retry â†’ "suspension imminent" email 4
 *   D21 â†’ suspended, funnels live 7 more days, email
 *   D28 â†’ funnels paused (watermarked), email
 *   D60 â†’ deletion warning email
 *   D90 â†’ permanent deletion
 *
 * Restore-from-suspended: card updated + back-charge succeeds â†’ immediate
 * restoration to `active` (we set step='recovered' and clear past_due).
 *
 * The hourly cron calls `advanceDueDunningStates()` which fetches every
 * dunning row whose `next_step_at <= now` and advances it one step.
 */

import { writeAuditLog } from "./audit.js";
import { BILLING_EMAIL_TEMPLATES, sendBillingEmail } from "./email.js";
import { emitBilling } from "./events.js";
import { BillingError, DUNNING_STEP_DAYS, type DunningStep } from "./types.js";
import { getBillingStore } from "./store.js";
import type { Subscription } from "./types.js";

export interface DunningStepDefinition {
  step: DunningStep;
  /** Day offset from D0. */
  day_offset: number;
  /** Email template to send. */
  email_template: string;
  /** Whether the processor should retry the failed charge at this step. */
  retry_charge: boolean;
  /** Funnels still live to the public? */
  funnels_live: boolean;
  /** Apply GoFunnelAI watermark to published funnels? */
  funnels_watermarked: boolean;
  /** Status transition applied to the subscription at this step (if any). */
  status_transition?:
    | "past_due"
    | "suspended"
    | "canceled";
  /** Mark workspace for deletion. */
  delete_workspace: boolean;
  /** Human description. */
  description: string;
}

export const DUNNING_PLAN: DunningStepDefinition[] = [
  {
    step: "d0",
    day_offset: 0,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d0,
    retry_charge: true,
    funnels_live: true,
    funnels_watermarked: false,
    status_transition: "past_due",
    delete_workspace: false,
    description: "Initial charge failure",
  },
  {
    step: "d3",
    day_offset: 3,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d3,
    retry_charge: true,
    funnels_live: true,
    funnels_watermarked: false,
    delete_workspace: false,
    description: "Second retry + reminder",
  },
  {
    step: "d7",
    day_offset: 7,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d7,
    retry_charge: true,
    funnels_live: true,
    funnels_watermarked: false,
    delete_workspace: false,
    description: "Final notice retry",
  },
  {
    step: "d14",
    day_offset: 14,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d14,
    retry_charge: true,
    funnels_live: true,
    funnels_watermarked: false,
    delete_workspace: false,
    description: "Suspension imminent",
  },
  {
    step: "d21",
    day_offset: 21,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d21,
    retry_charge: false,
    funnels_live: true, // suspended at the *account* level but funnels keep running 7 more days
    funnels_watermarked: false,
    status_transition: "suspended",
    delete_workspace: false,
    description: "Account suspended; funnels live 7 more days",
  },
  {
    step: "d28",
    day_offset: 28,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d28,
    retry_charge: false,
    funnels_live: true,
    funnels_watermarked: true, // watermarked, not removed
    delete_workspace: false,
    description: "Funnels watermarked",
  },
  {
    step: "d60",
    day_offset: 60,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d60,
    retry_charge: false,
    funnels_live: false,
    funnels_watermarked: true,
    delete_workspace: false,
    description: "Deletion warning",
  },
  {
    step: "d90",
    day_offset: 90,
    email_template: BILLING_EMAIL_TEMPLATES.dunning_d90,
    retry_charge: false,
    funnels_live: false,
    funnels_watermarked: false,
    status_transition: "canceled",
    delete_workspace: true,
    description: "Permanent deletion",
  },
];

const stepOrder: DunningStep[] = DUNNING_PLAN.map((s) => s.step);

export function stepConfig(step: DunningStep): DunningStepDefinition {
  const cfg = DUNNING_PLAN.find((s) => s.step === step);
  if (!cfg) {
    throw new BillingError(`Unknown dunning step: ${step}`, "dunning.unknown_step", 500);
  }
  return cfg;
}

/** Enter dunning at D0 â€” called by `webhook.ts` on payment_failed. */
export async function enterDunning(args: {
  subscription_id: string;
  reason: string;
}): Promise<void> {
  const store = getBillingStore();
  const sub = await store.getSubscription(args.subscription_id);
  if (!sub) throw new BillingError("No subscription to enter dunning", "dunning.no_subscription", 404);

  const existing = await store.getDunningState(args.subscription_id);
  if (existing && existing.resolved_at == null) {
    // Already in dunning â€” don't re-enter, but bump attempts.
    await store.upsertDunningState({
      ...existing,
      attempts: existing.attempts + 1,
    });
    return;
  }

  const now = new Date().toISOString();
  await store.upsertDunningState({
    subscription_id: args.subscription_id,
    workspace_id: sub.workspace_id,
    current_step: 0,
    last_step_kind: undefined,
    next_step_kind: undefined,
    last_step_at: now,
    next_step_at: now, // fire immediately
    attempts: 1,
    resolved_at: null,
  });
  await executeStep(sub, "d0");
}

/** Cron entry-point â€” call hourly. */
export async function advanceDueDunningStates(now: Date = new Date()): Promise<{ advanced: number; recovered: number }> {
  const store = getBillingStore();
  const due = await store.listDunningStatesDue(now);
  let advanced = 0;
  let recovered = 0;
  for (const state of due) {
    if (state.resolved_at) continue;
    const sub = await store.getSubscription(state.subscription_id);
    if (!sub) continue;

    // Recovery check: if status is back to `active` and not past_due, mark resolved.
    if (sub.status === "active") {
      await store.upsertDunningState({ ...state, resolved_at: now.toISOString() });
      await emitBilling("account_restored", {
        subscription_id: sub.id,
        workspace_id: sub.workspace_id,
        recovered_at: now.toISOString(),
      });
      recovered++;
      continue;
    }

    const currentIdx = state.current_step;
    const nextIdx = currentIdx + 1;
    if (nextIdx >= stepOrder.length) continue;
    const nextStep = stepOrder[nextIdx]!;
    await executeStep(sub, nextStep);
    advanced++;
  }
  return { advanced, recovered };
}

/** Restoration path: customer updates card + we successfully back-charge. */
export async function restoreFromSuspended(args: {
  workspace_id: string;
  subscription_id: string;
  actor_user_id: string;
}): Promise<void> {
  const store = getBillingStore();
  const sub = await store.getSubscription(args.subscription_id);
  if (!sub) throw new BillingError("No subscription", "dunning.no_subscription", 404);

  await store.updateSubscription(sub.id, {
    status: "active",
    metadata: { ...sub.metadata, funnels_watermarked: false },
    updated_at: new Date().toISOString(),
  });

  const state = await store.getDunningState(sub.id);
  if (state) {
    await store.upsertDunningState({ ...state, resolved_at: new Date().toISOString() });
  }
  await emitBilling("account_restored", {
    subscription_id: sub.id,
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
  });
  await writeAuditLog({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    action: "billing.account_restored",
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { via: "dunning_restore" },
  });
}

async function executeStep(sub: Subscription, step: DunningStep): Promise<void> {
  const store = getBillingStore();
  const cfg = stepConfig(step);
  const stepIdx = stepOrder.indexOf(step);
  const nextIdx = stepIdx + 1;
  const nextStep = nextIdx < stepOrder.length ? stepOrder[nextIdx]! : undefined;
  const nextStepCfg = nextStep ? stepConfig(nextStep) : undefined;

  const nowDate = new Date();
  const next_step_at = nextStepCfg
    ? new Date(nowDate.getTime() + (nextStepCfg.day_offset - cfg.day_offset) * 86_400_000)
    : null;

  await store.upsertDunningState({
    subscription_id: sub.id,
    workspace_id: sub.workspace_id,
    current_step: stepIdx,
    last_step_kind: "soft_email",
    next_step_kind: nextStepCfg ? "soft_email" : "close",
    last_step_at: nowDate.toISOString(),
    next_step_at: next_step_at?.toISOString(),
    attempts: 0,
    resolved_at: null,
    suspended_at: cfg.status_transition === "suspended" ? nowDate.toISOString() : undefined,
  });

  if (cfg.status_transition) {
    await store.updateSubscription(sub.id, {
      status: cfg.status_transition,
      metadata: {
        ...sub.metadata,
        funnels_watermarked: cfg.funnels_watermarked,
        funnels_live: cfg.funnels_live,
      },
      updated_at: nowDate.toISOString(),
    });
  } else if (cfg.funnels_watermarked !== sub.metadata.funnels_watermarked || cfg.funnels_live !== sub.metadata.funnels_live) {
    await store.updateSubscription(sub.id, {
      metadata: {
        ...sub.metadata,
        funnels_watermarked: cfg.funnels_watermarked,
        funnels_live: cfg.funnels_live,
      },
      updated_at: nowDate.toISOString(),
    });
  }

  await sendBillingEmail({
    template: cfg.email_template,
    workspace_id: sub.workspace_id,
    to_user_id: sub.metadata.owner_user_id as string | undefined ?? "",
    data: {
      step,
      next_step_at: next_step_at?.toISOString(),
      funnels_live: cfg.funnels_live,
      funnels_watermarked: cfg.funnels_watermarked,
    },
  });

  await emitBilling("dunning_step_entered", {
    subscription_id: sub.id,
    workspace_id: sub.workspace_id,
    step,
    previous_step: stepIdx > 0 ? stepOrder[stepIdx - 1] : null,
    paused: false,
  });
  await emitBilling("dunning_step_executed", {
    subscription_id: sub.id,
    step,
    action: cfg.retry_charge ? "retry_charge" : "email_only",
    channel: "email",
  });
  if (cfg.status_transition === "suspended") {
    await emitBilling("account_suspended", {
      subscription_id: sub.id,
      workspace_id: sub.workspace_id,
      reason_code: "dunning_d21",
    });
  }
  if (cfg.delete_workspace) {
    await emitBilling("account_closed", {
      subscription_id: sub.id,
      workspace_id: sub.workspace_id,
      data_disposition: "deleted",
    });
  }
  await writeAuditLog({
    workspace_id: sub.workspace_id,
    actor_user_id: null,
    action: `billing.dunning_step.${step}`,
    resource_type: "subscription",
    resource_id: sub.id,
    metadata: { step, day_offset: cfg.day_offset, retry_charge: cfg.retry_charge },
  });
}

/** Re-export the step plan for tests / admin UI. */
export const DUNNING_STEP_OFFSETS = DUNNING_STEP_DAYS;
