/**
 * Milestone detector.
 *
 * Daily scan that walks every published funnel's cumulative revenue and
 * detects crossings of $10K → $100K → $1M → $10M → $100M. Idempotent at the
 * (funnel_id × tier) level — a funnel that already received its Bronze never
 * gets a duplicate, even after a payment-event replay.
 *
 * Anti-gaming guards (Doc 16 §3 & Risks section):
 *   - Refunds + chargebacks are subtracted from the cumulative number BEFORE
 *     comparison.
 *   - Bronze tier requires `unique_customer_count ≥ 10` AND
 *     `days_since_publish ≥ 14`.
 *   - Internal/employee accounts are excluded (caller-supplied flag).
 */

import {
  MIN_DAYS_SINCE_PUBLISH_BRONZE,
  MIN_UNIQUE_CUSTOMERS_BRONZE,
} from "./constants.js";
import type { AwardsStore } from "./store.js";
import { AwardThresholds, TIER_ORDER } from "./types.js";
import type { Award, AwardTier, FunnelRevenueSnapshot } from "./types.js";

export interface MilestoneDetectorDeps {
  store: AwardsStore;
  newId: (entity: "request") => string;
  clock?: { now(): number; iso(): string };
  emit?: (
    name: "milestone_hit",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/** Compute net revenue (refunds + chargebacks subtracted). */
export function netRevenueCents(s: FunnelRevenueSnapshot): number {
  return Math.max(0, s.revenue_cumulative_cents - s.refunds_cumulative_cents - s.chargebacks_cumulative_cents);
}

/** Which tiers has this snapshot crossed? Returns ordered low→high. */
export function tiersCrossed(net_cents: number): AwardTier[] {
  return TIER_ORDER.filter((t) => net_cents >= AwardThresholds[t]);
}

export interface DetectResult {
  newAwards: Award[];
  /** Tiers that were withheld by anti-gaming guards. */
  withheld: { tier: AwardTier; reason: string }[];
}

/**
 * Evaluate a single funnel snapshot and issue any new awards.
 * The caller normally walks every funnel; we keep the unit small for testability.
 */
export async function detectAndIssue(
  snapshot: FunnelRevenueSnapshot,
  deps: MilestoneDetectorDeps,
): Promise<DetectResult> {
  if (snapshot.internal_account) return { newAwards: [], withheld: [] };

  const clock = deps.clock ?? defaultClock;
  const net = netRevenueCents(snapshot);
  const crossings = tiersCrossed(net);

  const newAwards: Award[] = [];
  const withheld: { tier: AwardTier; reason: string }[] = [];

  const publish = new Date(snapshot.funnel_first_published_at).valueOf();
  const daysSincePublish = Math.floor((clock.now() - publish) / (24 * 3600 * 1000));

  for (const tier of crossings) {
    const existing = await deps.store.findAward(snapshot.funnel_id, tier);
    if (existing) continue;

    // Anti-gaming guards. Bronze is the most-targeted tier so it gets the strictest checks;
    // higher tiers are protected by sheer magnitude.
    if (tier === "bronze") {
      if (snapshot.unique_customer_count < MIN_UNIQUE_CUSTOMERS_BRONZE) {
        withheld.push({
          tier,
          reason: `requires ≥${MIN_UNIQUE_CUSTOMERS_BRONZE} unique customers; have ${snapshot.unique_customer_count}`,
        });
        continue;
      }
      if (daysSincePublish < MIN_DAYS_SINCE_PUBLISH_BRONZE) {
        withheld.push({
          tier,
          reason: `requires ≥${MIN_DAYS_SINCE_PUBLISH_BRONZE} days since publish; have ${daysSincePublish}`,
        });
        continue;
      }
    }

    const award: Award = {
      id: deps.newId("request"),
      workspace_id: snapshot.workspace_id,
      funnel_id: snapshot.funnel_id,
      tier,
      revenue_at_milestone_cents: net,
      time_to_milestone_days: daysSincePublish,
      unique_customer_count: snapshot.unique_customer_count,
      days_since_publish: daysSincePublish,
      awarded_at: clock.iso(),
    };
    const inserted = await deps.store.insertAward(award);
    newAwards.push(inserted);

    if (deps.emit) {
      await deps.emit("milestone_hit", {
        funnel_id: snapshot.funnel_id,
        workspace_id: snapshot.workspace_id,
        tier,
        revenue_cumulative_usd: Math.round(net / 100),
        time_to_milestone_days: daysSincePublish,
      });
    }
  }
  return { newAwards, withheld };
}

/**
 * Scan a bulk batch of snapshots — typically used as the daily cron entrypoint.
 * Continues on per-funnel errors so one bad row doesn't block the rest.
 */
export async function runDailyScan(
  snapshots: AsyncIterable<FunnelRevenueSnapshot>,
  deps: MilestoneDetectorDeps,
): Promise<{ totalAwarded: number; totalWithheld: number }> {
  let awarded = 0;
  let withheld = 0;
  for await (const snap of snapshots) {
    try {
      const r = await detectAndIssue(snap, deps);
      awarded += r.newAwards.length;
      withheld += r.withheld.length;
    } catch {
      /* continue */
    }
  }
  return { totalAwarded: awarded, totalWithheld: withheld };
}
