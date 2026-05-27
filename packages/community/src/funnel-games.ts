/**
 * Monthly Funnel Games (Doc 16 §5.7).
 *
 *   - Theme rotates monthly. Bronze months (early): $5K pool. Gold months
 *     (mature): $25K pool. Prize breakdowns hardcoded per pool size below.
 *   - Eligibility: community level ≥ 4 at month start.
 *   - Verification: funnel live + payment integration matches submitted metric.
 *   - Winners auto-generate a Loop-3 case study.
 */

import type { CommunityStore } from "./store.js";
import type { Game, GameEntry, Level } from "./types.js";

export interface FunnelGameDeps {
  store: CommunityStore;
  newId: (entity: "request") => string;
  /** Resolve a user's current level — derived from XP. */
  userLevel: (user_id: string) => Promise<Level>;
  clock?: { iso(): string };
  emit?: (
    name: "challenge_participated" | "challenge_won" | "game_scheduled" | "game_closed",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export const PRIZE_BREAKDOWN_5K = [
  { rank: 1, amount_cents: 2_500_00 },
  { rank: 2, amount_cents: 1_500_00 },
  { rank: 3, amount_cents: 1_000_00 },
];

export const PRIZE_BREAKDOWN_25K = [
  { rank: 1, amount_cents: 10_000_00 },
  { rank: 2, amount_cents: 7_000_00 },
  { rank: 3, amount_cents: 5_000_00 },
  { rank: 4, amount_cents: 500_00 },
  { rank: 5, amount_cents: 500_00 },
  { rank: 6, amount_cents: 500_00 },
  { rank: 7, amount_cents: 500_00 },
  { rank: 8, amount_cents: 500_00 },
  { rank: 9, amount_cents: 500_00 },
  { rank: 10, amount_cents: 500_00 },
];

/** Schedule a game for a month. */
export async function scheduleGame(
  args: {
    month_yyyy_mm: string;
    name: string;
    theme: string;
    rules: string;
    pool_cents: number;
    opens_at: string;
    closes_at: string;
    winners_announced_at: string;
    min_level?: number;
  },
  deps: FunnelGameDeps,
): Promise<Game> {
  const breakdown = args.pool_cents <= 5_000_00 ? PRIZE_BREAKDOWN_5K : PRIZE_BREAKDOWN_25K;
  const game: Game = {
    id: deps.newId("request"),
    month_yyyy_mm: args.month_yyyy_mm,
    name: args.name,
    theme: args.theme,
    rules: args.rules,
    prize_pool_cents: args.pool_cents,
    prize_breakdown: breakdown,
    min_level_required: args.min_level ?? 4,
    opens_at: args.opens_at,
    closes_at: args.closes_at,
    winners_announced_at: args.winners_announced_at,
    status: "scheduled",
  };
  const inserted = await deps.store.insertGame(game);
  if (deps.emit) {
    await deps.emit("game_scheduled", {
      game_id: inserted.id,
      pool_cents: args.pool_cents,
      theme: args.theme,
    });
  }
  return inserted;
}

/** Enter a game — checks level eligibility. */
export async function enterGame(
  args: {
    game_id: string;
    user_id: string;
    funnel_id: string;
    metric_value: number;
  },
  deps: FunnelGameDeps,
): Promise<GameEntry> {
  const clock = deps.clock ?? defaultClock;
  const game = await deps.store.getActiveGame();
  if (!game || game.id !== args.game_id) throw new Error("game not open");
  const level = await deps.userLevel(args.user_id);
  if (level.level < game.min_level_required) {
    throw new Error(`game requires L${game.min_level_required}; user is L${level.level}`);
  }
  const entry: GameEntry = {
    id: deps.newId("request"),
    game_id: args.game_id,
    user_id: args.user_id,
    funnel_id: args.funnel_id,
    metric_value: args.metric_value,
    rank: null,
    prize_amount_cents: 0,
    created_at: clock.iso(),
  };
  const inserted = await deps.store.insertGameEntry(entry);
  if (deps.emit) {
    await deps.emit("challenge_participated", {
      user_id: args.user_id,
      challenge_id: args.game_id,
    });
  }
  return inserted;
}

/** Close + rank the game. Returns the winners (with prize_amount stamped). */
export async function closeGame(
  game_id: string,
  deps: FunnelGameDeps,
): Promise<GameEntry[]> {
  const game = await deps.store.getActiveGame();
  if (!game || game.id !== game_id) throw new Error("game not open");
  const entries = await deps.store.listGameEntries(game_id);
  entries.sort((a, b) => b.metric_value - a.metric_value);
  const winners: GameEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const prize = game.prize_breakdown.find((b) => b.rank === i + 1);
    const ranked: GameEntry = {
      ...e,
      rank: i + 1,
      prize_amount_cents: prize?.amount_cents ?? 0,
    };
    await deps.store.insertGameEntry(ranked);
    if (prize) winners.push(ranked);
  }
  if (deps.emit) {
    for (const w of winners) {
      await deps.emit("challenge_won", {
        user_id: w.user_id,
        challenge_id: game_id,
        rank: w.rank,
        prize_amount: w.prize_amount_cents,
      });
    }
    await deps.emit("game_closed", { game_id, winners: winners.length });
  }
  return winners;
}
