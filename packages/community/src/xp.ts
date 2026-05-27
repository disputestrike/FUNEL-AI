/**
 * XP rules (Doc 16 §5.3).
 *
 *   Action                            XP
 *   ------------------------------------
 *   Ship a funnel                     10
 *   First lead through a funnel       50
 *   First $1K revenue                 200
 *   Upvoted answer (per upvote)       5
 *   Mentor mentee to first lead       100
 *   Win monthly community challenge   500
 *   Get featured                      250
 *
 * Anti-farming guards:
 *   - Max +50 XP/day from upvotes alone (`upvoted_answer`).
 *   - Mentor XP requires a verified mentor-mentee link (`mentor_matched`).
 *
 * All grants are idempotent on (source × source_id × user_id × day-bucket)
 * — the caller is expected to use `grantXp` exactly once per recognized
 * action. Re-running with the same source_id is a no-op.
 */

import type { CommunityStore } from "./store.js";
import type { XpRecord, XpSource } from "./types.js";

export const XP_AMOUNTS: Record<XpSource, number> = {
  funnel_shipped: 10,
  first_lead: 50,
  first_1k_revenue: 200,
  upvoted_answer: 5,
  mentor_mentee_first_lead: 100,
  win_challenge: 500,
  featured: 250,
  post_themed_thread: 2,
  post_general: 1,
  reaction_given: 1,
  comment_helpful: 3,
};

const XP_DAILY_CAP: Partial<Record<XpSource, number>> = {
  upvoted_answer: 50,
  reaction_given: 20,
  post_general: 20,
};

export interface XpDeps {
  store: CommunityStore;
  newId: (entity: "request") => string;
  clock?: { now(): number; iso(): string };
  emit?: (
    name: "xp_earned" | "level_up",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

export async function grantXp(
  args: { user_id: string; source: XpSource; source_id?: string | null; multiplier?: number },
  deps: XpDeps,
): Promise<{ granted: number; capped: boolean; total: number }> {
  const clock = deps.clock ?? defaultClock;
  const baseAmount = XP_AMOUNTS[args.source];
  if (baseAmount === 0) return { granted: 0, capped: false, total: await deps.store.totalXpForUser(args.user_id) };

  const cap = XP_DAILY_CAP[args.source];
  let proposed = baseAmount * (args.multiplier ?? 1);

  if (cap !== undefined) {
    const since = startOfUtcDay(clock.now()).toISOString();
    const todayAlready = await deps.store.sumXpForUserInWindow(args.user_id, since, [args.source]);
    const remaining = Math.max(0, cap - todayAlready);
    if (remaining <= 0) return { granted: 0, capped: true, total: await deps.store.totalXpForUser(args.user_id) };
    if (proposed > remaining) proposed = remaining;
  }

  const prevTotal = await deps.store.totalXpForUser(args.user_id);
  const record: XpRecord = {
    id: deps.newId("request"),
    user_id: args.user_id,
    amount: proposed,
    source: args.source,
    source_id: args.source_id ?? null,
    created_at: clock.iso(),
  };
  await deps.store.insertXp(record);
  const newTotal = prevTotal + proposed;

  if (deps.emit) {
    await deps.emit("xp_earned", {
      user_id: args.user_id,
      amount: proposed,
      source: args.source,
      source_id: args.source_id ?? null,
    });
  }

  // Detect level change.
  const fromLevel = levelForXp(prevTotal);
  const toLevel = levelForXp(newTotal);
  if (toLevel > fromLevel && deps.emit) {
    await deps.emit("level_up", {
      user_id: args.user_id,
      from_level: fromLevel,
      to_level: toLevel,
    });
  }

  return { granted: proposed, capped: cap !== undefined && proposed < baseAmount, total: newTotal };
}

function startOfUtcDay(ts: number): Date {
  const d = new Date(ts);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Returns the level number (1-10) for a given XP total. Defined locally to avoid circular import. */
function levelForXp(xp: number): number {
  const thresholds = [0, 100, 300, 600, 1_000, 2_000, 4_000, 7_500, 12_000, 20_000];
  let lvl = 1;
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    if (t !== undefined && xp >= t) lvl = i + 1;
  }
  return lvl;
}
