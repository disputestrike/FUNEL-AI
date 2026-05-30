/**
 * GoFunnelAI — The 8 canonical ad angles.
 *
 * The variant generator produces one (or more) AdVariants per angle per
 * platform per campaign. This file is the single source of truth for the
 * angle taxonomy: short label, prompt-style description, example hook, and
 * a hint to the creative system about which emotional register to lean on.
 *
 * Keep the entries in `AdAngle` enum order so consumers can iterate
 * deterministically.
 */

import { AdAngle } from "./types.js";

export interface AdAngleMeta {
  /** The enum value (stable wire string). */
  key: AdAngle;
  /** Short title (Title Case, <= 16 chars). */
  title: string;
  /** Two-to-three-sentence positioning brief used as part of the LLM system prompt. */
  description: string;
  /** One illustrative headline-style hook in this angle's voice. */
  exampleHook: string;
  /** Primary emotional register the creative team should lean on. */
  register:
    | "urgent_problem"
    | "rational_value"
    | "instant_gratification"
    | "social_validation"
    | "competitive_positioning"
    | "loss_aversion"
    | "frictionless_ease"
    | "authority_safety";
}

export const AD_ANGLES: Readonly<Record<AdAngle, AdAngleMeta>> = {
  [AdAngle.Pain]: {
    key: AdAngle.Pain,
    title: "Pain",
    description:
      "Lead with the prospect's most acute, named pain. Mirror the language they use about it. Demonstrate that you understand the cost of doing nothing, then position the product as the relief mechanism. Avoid generic hand-wringing — get specific about the symptom, the time wasted, or the money lost.",
    exampleHook: "Stop losing 3 hours every Friday rebuilding the same broken funnel.",
    register: "urgent_problem",
  },

  [AdAngle.Roi]: {
    key: AdAngle.Roi,
    title: "ROI",
    description:
      "Quantify the economic upside. Lead with the number — dollars saved, hours reclaimed, conversion lift — and back it with a concrete unit-economics example. Bias toward conservatively-stated, defensible math the buyer can run themselves. This angle is for the spreadsheet brain.",
    exampleHook: "Replace a $5,400/mo agency with one $99 GoFunnelAI seat.",
    register: "rational_value",
  },

  [AdAngle.Speed]: {
    key: AdAngle.Speed,
    title: "Speed",
    description:
      "Lead with how fast the prospect goes from cold start to working result. Compress the time-to-value into a vivid before/after that makes the legacy workflow feel embarrassing. Anchor on a specific clock — '90 seconds', 'one coffee break' — not a vague 'faster'.",
    exampleHook: "From a blank cursor to a live, conversion-tuned funnel in 90 seconds.",
    register: "instant_gratification",
  },

  [AdAngle.Proof]: {
    key: AdAngle.Proof,
    title: "Proof",
    description:
      "Lead with social proof: customer counts, named logos, testimonials with attribution, screenshots of real results, or third-party validation. The hook should make the prospect feel late to a party that everyone they respect is already at. Use real names and real numbers, never composites.",
    exampleHook: "2,841 founders shipped funnels with GoFunnelAI last month. Here's what they built.",
    register: "social_validation",
  },

  [AdAngle.Comparison]: {
    key: AdAngle.Comparison,
    title: "Comparison",
    description:
      "Frame the product against a named or strongly-implied competitor (or against the legacy approach). Highlight the specific dimension where you win. Stay above the line — punch up, not down — and let the asymmetry speak for itself. Tables and side-by-side visuals work especially well here.",
    exampleHook: "ClickFunnels charges $297/mo for what GoFunnelAI ships in your first 30 free seconds.",
    register: "competitive_positioning",
  },

  [AdAngle.Fear]: {
    key: AdAngle.Fear,
    title: "Fear",
    description:
      "Lead with what the prospect stands to lose by not acting — a market window closing, a competitor pulling ahead, a deadline expiring, a regulation tightening. The fear must be real, specific, and within the prospect's window of agency; vague existential dread is off-limits. Always pair with a clear, immediate remedy.",
    exampleHook: "Your competitor's AI-generated funnels are converting 2x yours. You have 90 days.",
    register: "loss_aversion",
  },

  [AdAngle.Convenience]: {
    key: AdAngle.Convenience,
    title: "Convenience",
    description:
      "Lead with how little the prospect has to do. Lean into the absence of friction: no setup, no contracts, no migrations, no learning curve. Use second-person verbs in the present tense ('paste', 'click', 'done') to make the workflow feel almost passive. This angle pairs well with one-click demo CTAs.",
    exampleHook: "Paste your idea. We build the funnel. You launch. Zero setup.",
    register: "frictionless_ease",
  },

  [AdAngle.Trust]: {
    key: AdAngle.Trust,
    title: "Trust",
    description:
      "Lead with reasons to feel safe handing the prospect's brand, data, or money to GoFunnelAI: certifications (SOC 2, GDPR), uptime guarantees, money-back terms, audit trails, named human support. The voice is calm and authoritative — no exclamation marks, no urgency theatre.",
    exampleHook: "SOC 2 Type II. GDPR-native. 99.99% uptime. The funnel platform your CFO already approved.",
    register: "authority_safety",
  },
} as const;

/** The 8 angles in canonical (spec) order. */
export const AD_ANGLE_ORDER: readonly AdAngle[] = [
  AdAngle.Pain,
  AdAngle.Roi,
  AdAngle.Speed,
  AdAngle.Proof,
  AdAngle.Comparison,
  AdAngle.Fear,
  AdAngle.Convenience,
  AdAngle.Trust,
] as const;

/**
 * Typed accessor with explicit error for unregistered angles.
 */
export function getAngleMeta(angle: AdAngle): AdAngleMeta {
  const meta = AD_ANGLES[angle];
  if (!meta) throw new Error(`Unknown ad angle: ${String(angle)}`);
  return meta;
}
