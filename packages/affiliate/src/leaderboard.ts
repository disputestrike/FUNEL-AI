/**
 * Public leaderboard (Doc 16 §2.5).
 *
 * - Top 50 by trailing-30d commission earned.
 * - Refreshed every 15 minutes via cron → CDN cached.
 * - Affiliates can opt out via `leaderboard_visible = false` (still see private rank).
 */

import { LEADERBOARD_SIZE } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { LeaderboardRow } from "./types.js";

export interface LeaderboardDeps {
  store: AffiliateStore;
  clock?: { iso(): string };
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function refreshLeaderboard(deps: LeaderboardDeps): Promise<LeaderboardRow[]> {
  const clock = deps.clock ?? defaultClock;
  return deps.store.refreshLeaderboardMaterialized(clock.iso());
}

export async function getPublicLeaderboard(deps: LeaderboardDeps, top_n = LEADERBOARD_SIZE): Promise<LeaderboardRow[]> {
  return deps.store.getLeaderboard(top_n);
}

/**
 * Private rank lookup — returns the affiliate's rank even if they opted out of
 * the public listing. We page through the full sorted set on-demand because
 * the count is small (10K affiliates × 8 bytes ≈ 80KB).
 */
export async function getPrivateRank(affiliate_id: string, deps: LeaderboardDeps): Promise<number | null> {
  const rows = await deps.store.getLeaderboard(10_000);
  const i = rows.findIndex((r) => r.affiliate_id === affiliate_id);
  return i === -1 ? null : i + 1;
}
