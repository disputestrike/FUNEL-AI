/**
 * Plan-limit enforcement.
 *
 * - Soft warning at 80% usage (in-app banner + email).
 * - Hard cap at 100% (canCreate() returns false; upgrade CTA surfaced).
 * - Per-resource caps:
 *     funnels, leads_per_month, revtry_minutes_per_month,
 *     monthly_ad_spend_usd_cents, storage_gb, team_seats
 *
 * The Cost Governor (Doc 07c §3) reads plan ceilings via this module so a
 * single change here propagates.
 */

import { BILLING_EMAIL_TEMPLATES, sendBillingEmail } from "./email.js";
import { writeAuditLog } from "./audit.js";
import {
  BillingError,
  type BillingPlanSlug,
  PLAN_LIMITS,
  type ResourceKind,
} from "./types.js";
import { getBillingStore } from "./store.js";

export interface LimitCheck {
  resource: ResourceKind;
  plan: BillingPlanSlug;
  limit: number;
  used: number;
  remaining: number;
  /** True if the next unit would still fit. */
  allowed: boolean;
  /** Whether we're at the soft-warning threshold (>=80%). */
  soft_warning: boolean;
  /** Used / limit (0..1). */
  utilization: number;
}

const SOFT_THRESHOLD = 0.8;

/** Pre-flight check before a write that consumes resource. */
export async function canCreate(args: {
  workspace_id: string;
  resource: ResourceKind;
  /** Default 1 — pass the actual quantity for batch-creates (e.g. importing 250 leads). */
  quantity?: number;
}): Promise<LimitCheck> {
  const store = getBillingStore();
  const sub = await store.getSubscriptionByWorkspace(args.workspace_id);
  if (!sub) {
    throw new BillingError("No subscription for workspace", "limits.no_subscription", 404);
  }
  const plan = sub.plan as BillingPlanSlug;
  const limits = PLAN_LIMITS[plan];
  const limit = limits[args.resource];
  const used = await store.getCurrentUsage(args.workspace_id, args.resource);
  const qty = args.quantity ?? 1;
  const remaining = Math.max(0, limit - used);
  const allowed = limit === 0 ? false : used + qty <= limit;
  const utilization = limit === 0 ? 1 : used / limit;
  return {
    resource: args.resource,
    plan,
    limit,
    used,
    remaining,
    allowed,
    soft_warning: utilization >= SOFT_THRESHOLD,
    utilization,
  };
}

/**
 * Hard-enforce: throws BillingError if the action is blocked.
 *
 * Emits a soft-warning email exactly once per resource per day if the user
 * crosses the 80% threshold.
 */
export async function enforceLimit(args: {
  workspace_id: string;
  actor_user_id: string;
  resource: ResourceKind;
  quantity?: number;
}): Promise<LimitCheck> {
  const check = await canCreate({
    workspace_id: args.workspace_id,
    resource: args.resource,
    quantity: args.quantity ?? 1,
  });

  // Soft-warning emit (one per day per resource per workspace tracked elsewhere).
  if (check.soft_warning && check.allowed) {
    await sendBillingEmail({
      template: "billing.limit_soft_warning",
      workspace_id: args.workspace_id,
      to_user_id: args.actor_user_id,
      data: {
        resource: args.resource,
        utilization: Math.round(check.utilization * 100),
        plan: check.plan,
        upgrade_target: nextTier(check.plan),
      },
    });
  }

  if (!check.allowed) {
    await writeAuditLog({
      workspace_id: args.workspace_id,
      actor_user_id: args.actor_user_id,
      action: "billing.limit_blocked",
      resource_type: args.resource,
      resource_id: `${args.workspace_id}:${args.resource}`,
      metadata: {
        plan: check.plan,
        limit: check.limit,
        used: check.used,
        attempted_quantity: args.quantity ?? 1,
      },
    });
    throw new BillingError(
      `${args.resource} limit reached on ${check.plan} (${check.used}/${check.limit}). Upgrade to ${nextTier(check.plan)}.`,
      "limits.hard_cap",
      402,
      { ...check, upgrade_target: nextTier(check.plan) },
    );
  }
  return check;
}

const RANK: BillingPlanSlug[] = ["free", "pro_boost_7d", "starter", "growth", "scale", "agency"];

export function nextTier(plan: BillingPlanSlug): BillingPlanSlug | null {
  const idx = RANK.indexOf(plan);
  return idx >= 0 && idx + 1 < RANK.length ? RANK[idx + 1]! : null;
}
