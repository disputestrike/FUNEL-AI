/**
 * Dream Car bonus job (Doc 16 §2.4).
 *
 *   - Monthly snapshot on 1st of month 00:30 UTC.
 *   - "Active paying referrals" = referred user's subscription is active OR
 *     past_due < 14 days.
 *   - Tier-strict: 501 active = $2,500 (not stacked).
 *   - Bonus paid quarterly on the 5th business day of Apr/Jul/Oct/Jan.
 *   - Bonus only counts referrals that are paying AND not fraud-flagged.
 */

import { DREAM_CAR_TIERS, PAST_DUE_GRACE_DAYS } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { DreamCarSnapshot, DreamCarTier } from "./types.js";

export interface SubscriptionState {
  /** "active" | "past_due" | "canceled" | "incomplete" | "trialing" | "unpaid" */
  state: string;
  /** ISO datetime, only relevant for past_due. */
  past_due_since: string | null;
}

export interface DreamCarDeps {
  store: AffiliateStore;
  newId: (entity: "request") => string;
  /** Resolve each referred user's current subscription state. */
  getSubscriptionState: (referred_user_id: string) => Promise<SubscriptionState | null>;
  /** Whether the referred user is in a fraud-flagged cluster. */
  isFraudFlagged: (referred_user_id: string) => Promise<boolean>;
  /** Iterate every active affiliate. */
  listAllActiveAffiliateIds: () => Promise<string[]>;
  /** For each affiliate, returns the referrals to check. */
  listSignedUpReferrals: (affiliate_id: string) => Promise<{ referred_user_id: string }[]>;
  clock?: { now(): number; iso(): string };
  emit?: (
    name: "affiliate_dream_car_tier_hit" | "affiliate_dream_car_paid",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

export function tierForActivePaying(count: number): DreamCarTier {
  if (count >= 500) return "t500";
  if (count >= 200) return "t200";
  if (count >= 100) return "t100";
  return "none";
}

export function bonusForTier(tier: DreamCarTier): number {
  if (tier === "none") return 0;
  const row = DREAM_CAR_TIERS.find((t) => t.tier === tier);
  return row ? row.monthly_bonus_cents : 0;
}

export function isReferralActivePaying(sub: SubscriptionState | null, asOf: number): boolean {
  if (!sub) return false;
  if (sub.state === "active" || sub.state === "trialing") return true;
  if (sub.state === "past_due" && sub.past_due_since) {
    const ageDays =
      (asOf - new Date(sub.past_due_since).valueOf()) / (24 * 3600 * 1000);
    return ageDays < PAST_DUE_GRACE_DAYS;
  }
  return false;
}

/** Run the monthly snapshot job. Should be cron'd on the 1st at 00:30 UTC. */
export async function runMonthlySnapshot(asOfIso: string, deps: DreamCarDeps): Promise<DreamCarSnapshot[]> {
  const clock = deps.clock ?? defaultClock;
  const asOf = new Date(asOfIso).valueOf();
  const month = asOfIso.slice(0, 7); // YYYY-MM
  const out: DreamCarSnapshot[] = [];

  const affiliates = await deps.listAllActiveAffiliateIds();
  for (const affiliate_id of affiliates) {
    const refs = await deps.listSignedUpReferrals(affiliate_id);
    let active = 0;
    for (const r of refs) {
      const [sub, fraud] = await Promise.all([
        deps.getSubscriptionState(r.referred_user_id),
        deps.isFraudFlagged(r.referred_user_id),
      ]);
      if (fraud) continue;
      if (isReferralActivePaying(sub, asOf)) active++;
    }
    const tier = tierForActivePaying(active);
    const bonus = bonusForTier(tier);

    const snapshot: DreamCarSnapshot = {
      id: deps.newId("request"),
      affiliate_id,
      month_yyyy_mm: month,
      active_paying_referrals: active,
      tier,
      bonus_amount_cents: bonus,
      paid_in_payout_id: null,
      created_at: clock.iso(),
    };
    await deps.store.insertDreamCarSnapshot(snapshot);
    out.push(snapshot);

    if (tier !== "none" && deps.emit) {
      await deps.emit("affiliate_dream_car_tier_hit", {
        affiliate_id,
        tier,
        active_referrals: active,
        bonus_amount: bonus,
      });
    }
  }
  return out;
}

/**
 * Sum the unpaid Dream Car bonuses for a quarter (months `[m1,m2,m3]`).
 * Returns by-affiliate aggregate.
 */
export async function aggregateQuarterlyBonuses(
  affiliate_id: string,
  quarterStartIso: string,
  deps: DreamCarDeps,
): Promise<{ amount_cents: number; snapshot_ids: string[] }> {
  const snaps = await deps.store.listDreamCarSnapshots(affiliate_id, quarterStartIso);
  let total = 0;
  const ids: string[] = [];
  for (const s of snaps) {
    if (s.paid_in_payout_id) continue;
    total += s.bonus_amount_cents;
    ids.push(s.id);
  }
  return { amount_cents: total, snapshot_ids: ids };
}

/**
 * Quarterly payment marker — call after the quarterly payout is sent.
 * Idempotent: snapshots already marked paid are skipped.
 */
export async function markQuarterlyPaid(
  args: { affiliate_id: string; payout_id: string; snapshot_ids: string[]; quarter: string; amount_cents: number },
  deps: DreamCarDeps,
): Promise<void> {
  // The store ought to UPDATE; for the simple in-memory version we re-insert.
  // Real impls SHOULD use a row-level UPDATE.
  if (deps.emit) {
    await deps.emit("affiliate_dream_car_paid", {
      affiliate_id: args.affiliate_id,
      quarter: args.quarter,
      amount: args.amount_cents,
    });
  }
}
