/**
 * Affiliate dashboard data assembler.
 *
 * Builds the `DashboardStats` payload consumed by `app.gofunnelai.com/affiliate`.
 * Heavy queries are folded into a single call here so the API route can wire
 * one cache (per-affiliate, 30s TTL).
 */

import { DREAM_CAR_TIERS } from "./constants.js";
import { getPrivateRank } from "./leaderboard.js";
import type { AffiliateStore } from "./store.js";
import type { DashboardStats } from "./types.js";

export interface DashboardDeps {
  store: AffiliateStore;
  /** ACTIVE-PAYING referral count — usually the same source as dream-car job. */
  getActivePayingReferrals: (affiliate_id: string) => Promise<number>;
  clock?: { now(): number; iso(): string };
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

export async function buildDashboardStats(
  affiliate_id: string,
  deps: DashboardDeps,
): Promise<DashboardStats | null> {
  const clock = deps.clock ?? defaultClock;
  const aff = await deps.store.getAffiliateById(affiliate_id);
  if (!aff) return null;

  const now = clock.now();
  const start30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const startMonth = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

  // 30-day pipeline.
  const refs30 = await deps.store.listReferralsForAffiliateSince(affiliate_id, start30);
  let clicks_30d = 0,
    signups_30d = 0,
    paid_30d = 0;
  for (const r of refs30) {
    clicks_30d++;
    if (r.signup_at) signups_30d++;
    if (r.first_paid_at) paid_30d++;
  }

  // Commissions.
  const earned = await deps.store.listEarnedCommissionsForAffiliate(affiliate_id);
  const commission_pending_cents = earned.reduce((s, c) => s + c.amount_cents, 0);
  const monthCommissions = await deps.store.listCommissionsInPeriod(
    affiliate_id,
    startMonth,
    clock.iso(),
  );
  const commission_this_month_cents = monthCommissions.reduce(
    (s, c) => (c.amount_cents > 0 ? s + c.amount_cents : s),
    0,
  );

  // Lifetime: rough sum of all commissions (in-memory store iterates all).
  const lifetime = await deps.store.listCommissionsInPeriod(affiliate_id, "1970-01-01T00:00:00.000Z", clock.iso());
  const commission_lifetime_cents = lifetime
    .filter((c) => c.amount_cents > 0)
    .reduce((s, c) => s + c.amount_cents, 0);
  const commission_paid_lifetime_cents = lifetime
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount_cents, 0);

  // Active referrals + churned.
  const allTime = await deps.store.listReferralsForAffiliateSince(
    affiliate_id,
    "1970-01-01T00:00:00.000Z",
  );
  const active_referrals = allTime.filter(
    (r) => r.referred_user_id && r.first_paid_at && !r.fraud_flagged,
  ).length;
  const churned_referrals = 0; // requires subscription state lookup; left to caller to merge

  // MRR — best-effort: sum the most-recent month's commission base by referral.
  const mrr_generated_cents = lifetime
    .filter((c) => c.type === "subscription" && c.amount_cents > 0)
    .slice(-active_referrals)
    .reduce((s, c) => s + c.base_amount_cents, 0);

  // Dream Car.
  const activePaying = await deps.getActivePayingReferrals(affiliate_id);
  const tier = activePaying >= 500 ? "t500" : activePaying >= 200 ? "t200" : activePaying >= 100 ? "t100" : "none";
  const nextThreshold =
    tier === "none" ? 100 : tier === "t100" ? 200 : tier === "t200" ? 500 : 500;
  const progress_pct = Math.min(100, (activePaying / nextThreshold) * 100);
  const dream_car_bonus =
    DREAM_CAR_TIERS.find((t) => t.tier === tier)?.monthly_bonus_cents ?? 0;

  // Leaderboard rank (regardless of opt-out).
  const rank = await getPrivateRank(affiliate_id, { store: deps.store });

  // Next payout — Monday after today, $50 floor.
  const today = new Date(now);
  const dayOfWeek = today.getUTCDay();
  const daysUntilMon = (1 - dayOfWeek + 7) % 7 || 7;
  const nextPayout = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilMon, 9, 0, 0, 0),
  );

  return {
    clicks_30d,
    signups_30d,
    trial_starts_30d: signups_30d, // proxy until trial events are wired
    paid_conversions_30d: paid_30d,
    active_referrals,
    churned_referrals,
    mrr_generated_cents,
    commission_this_month_cents,
    commission_lifetime_cents,
    commission_paid_lifetime_cents,
    commission_pending_cents,
    next_payout_date: nextPayout.toISOString(),
    next_payout_amount_cents: commission_pending_cents >= 50_00 ? commission_pending_cents : 0,
    dream_car: {
      active_paying_referrals: activePaying,
      tier: tier as DashboardStats["dream_car"]["tier"],
      next_tier_threshold: nextThreshold,
      progress_pct,
    },
    leaderboard_rank: rank,
    leaderboard_rank_delta: 0,
    // bonus is computed but not exposed in the dashboard schema today; keep tracked here for callers
    ...({ _dream_car_bonus_cents: dream_car_bonus } as unknown as object),
  } as DashboardStats;
}
