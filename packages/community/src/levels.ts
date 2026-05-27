/**
 * Level system L1 → L10 (Doc 16 §5.4).
 *
 * Static lookup; the per-user level is derived from their XP total at any
 * moment. Crossings emit `level_up` events from `grantXp`.
 */

import type { Level } from "./types.js";

export const LEVELS: readonly Level[] = [
  { level: 1, xp_threshold: 0, unlocks: ["Post in industry/stage hubs"] },
  { level: 2, xp_threshold: 100, unlocks: ["Reactions"] },
  { level: 3, xp_threshold: 300, unlocks: ["DMs"] },
  { level: 4, xp_threshold: 600, unlocks: ["Monthly office hours", "Post in #wins"] },
  { level: 5, xp_threshold: 1_000, unlocks: ["Custom flair"] },
  { level: 6, xp_threshold: 2_000, unlocks: ["Start hub events"] },
  { level: 7, xp_threshold: 4_000, unlocks: ["Mentor tag", "Auto-paired with new users"] },
  { level: 8, xp_threshold: 7_500, unlocks: ["Beta feature access", "Early KB pack access"] },
  { level: 9, xp_threshold: 12_000, unlocks: ["Private Slack-style L9+ channels"] },
  { level: 10, xp_threshold: 20_000, unlocks: ["Founder's personal Slack", "Lifetime Scale tier"] },
] as const;

export function levelForXp(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const lvl = LEVELS[i];
    if (lvl && xp >= lvl.xp_threshold) return lvl;
  }
  return LEVELS[0]!;
}

export function nextLevel(currentLevel: number): Level | null {
  return LEVELS.find((l) => l.level === currentLevel + 1) ?? null;
}

export function xpToNextLevel(xp: number): number {
  const cur = levelForXp(xp);
  const next = nextLevel(cur.level);
  if (!next) return 0;
  return Math.max(0, next.xp_threshold - xp);
}
