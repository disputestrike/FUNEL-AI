/**
 * Public Hall of Fame.
 *
 *   `gofunnelai.com/wins` — chronological feed of published case studies,
 *   filterable by tier + industry. Aggregated tier counts at the top:
 *   "23 Diamond, 187 Platinum, 1,200 Gold, …".
 */

import { TIER_ORDER } from "./types.js";
import type { AwardsStore } from "./store.js";
import type { AwardTier, CaseStudyPage } from "./types.js";

export interface HallOfFameView {
  total_counts: Record<AwardTier, number>;
  pages: CaseStudyPage[];
  next_offset: number | null;
}

export interface HallOfFameDeps {
  store: AwardsStore;
}

export async function getHallOfFame(
  args: { tier?: AwardTier; industry?: string; limit?: number; offset?: number },
  deps: HallOfFameDeps,
): Promise<HallOfFameView> {
  const limit = args.limit ?? 24;
  const counts = await tierCounts(deps);

  const pages = await deps.store.listPublishedCaseStudies({
    tier: args.tier,
    industry: args.industry,
    limit: limit + 1,
  });
  const has_more = pages.length > limit;
  return {
    total_counts: counts,
    pages: pages.slice(0, limit),
    next_offset: has_more ? (args.offset ?? 0) + limit : null,
  };
}

async function tierCounts(deps: HallOfFameDeps): Promise<Record<AwardTier, number>> {
  const out: Record<AwardTier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0,
  };
  for (const t of TIER_ORDER) {
    const rows = await deps.store.listAwardsByTier(t);
    out[t] = rows.length;
  }
  return out;
}
