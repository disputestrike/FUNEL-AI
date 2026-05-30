/**
 * Light-touch profanity + AUP heuristics. For deep moderation, results
 * with `profanityScore() >= 0.6` are queued for trust-safety review.
 *
 * Word list is intentionally small here — real production uses a managed
 * service (Hive, Perspective API). This is the local-deterministic fallback
 * so tests don't depend on a network round-trip.
 */

const FOUL_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "slut",
  "whore",
  "nigger",
  "faggot",
  "retard",
];

const SLUR_WORDS = ["nigger", "faggot", "retard"];

export function profanityScore(text: string): number {
  if (!text) return 0;
  const tokens = text.toLowerCase().split(/[^a-z]+/g).filter(Boolean);
  if (tokens.length === 0) return 0;
  let hits = 0;
  let slurHits = 0;
  for (const t of tokens) {
    if (FOUL_WORDS.includes(t)) hits++;
    if (SLUR_WORDS.includes(t)) slurHits++;
  }
  // Slur = automatic high score; mild profanity scales with density.
  if (slurHits > 0) return 1;
  return Math.min(1, hits / Math.max(20, tokens.length) + (hits > 0 ? 0.3 : 0));
}
