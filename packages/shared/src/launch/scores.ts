/**
 * GoFunnelAI — Launch Readiness Score computation.
 *
 * Per the Level 2 spec, the LaunchReadinessScore is a weighted blend of
 * seven sub-scores. Each sub-score is independently bounded to [0, 100] and
 * the final score is rounded to the nearest integer in the same range. The
 * weights are tuned so that:
 *
 *   - Tracking and compliance carry the most weight (you cannot rescue a
 *     campaign that can't measure or that's blocked at review).
 *   - Creative quality and audience fit dominate the second tier (driver
 *     of actual performance).
 *   - Funnel readiness, budget realism, and follow-up coverage are tier
 *     three (correctable post-launch but degrade ROI when neglected).
 *
 *   weight(tracking_coverage)       = 0.20
 *   weight(compliance_confidence)   = 0.18
 *   weight(creative_quality)        = 0.18
 *   weight(audience_fit)            = 0.15
 *   weight(funnel_readiness)        = 0.12
 *   weight(budget_realism)          = 0.10
 *   weight(followup_coverage)       = 0.07
 *                                   ------
 *                                   = 1.00
 *
 * If any "critical floor" sub-score is below the floor threshold, the
 * overall score is hard-capped at 49 (i.e. "not launch ready"). Critical
 * floors are tracking_coverage and compliance_confidence; both must be
 * >= 60 for the campaign to be considered launch-ready.
 */

import type { LaunchScore } from "./types.js";

// ---------------------------------------------------------------------------
// Weights & floors
// ---------------------------------------------------------------------------

export const LAUNCH_SCORE_WEIGHTS = {
  trackingCoverage: 0.2,
  complianceConfidence: 0.18,
  creativeQuality: 0.18,
  audienceFit: 0.15,
  funnelReadiness: 0.12,
  budgetRealism: 0.1,
  followupCoverage: 0.07,
} as const;

export const LAUNCH_SCORE_FLOORS = {
  trackingCoverage: 60,
  complianceConfidence: 60,
} as const;

export const NOT_LAUNCH_READY_CAP = 49;
export const LAUNCH_READY_THRESHOLD = 70;

export type LaunchSubScores = Pick<
  LaunchScore,
  | "creativeQuality"
  | "audienceFit"
  | "trackingCoverage"
  | "complianceConfidence"
  | "budgetRealism"
  | "funnelReadiness"
  | "followupCoverage"
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function weightsSum(): number {
  const w = LAUNCH_SCORE_WEIGHTS;
  return (
    w.trackingCoverage +
    w.complianceConfidence +
    w.creativeQuality +
    w.audienceFit +
    w.funnelReadiness +
    w.budgetRealism +
    w.followupCoverage
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the weighted overall LaunchReadinessScore from the sub-scores.
 * Returns an integer in [0, 100]. Applies the critical-floor cap when
 * tracking_coverage or compliance_confidence is below the floor.
 */
export function computeLaunchReadinessScore(sub: LaunchSubScores): number {
  const tracking = clamp01to100(sub.trackingCoverage);
  const compliance = clamp01to100(sub.complianceConfidence);
  const creative = clamp01to100(sub.creativeQuality);
  const audience = clamp01to100(sub.audienceFit);
  const funnel = clamp01to100(sub.funnelReadiness);
  const budget = clamp01to100(sub.budgetRealism);
  const followup = clamp01to100(sub.followupCoverage);

  const w = LAUNCH_SCORE_WEIGHTS;
  const raw =
    tracking * w.trackingCoverage +
    compliance * w.complianceConfidence +
    creative * w.creativeQuality +
    audience * w.audienceFit +
    funnel * w.funnelReadiness +
    budget * w.budgetRealism +
    followup * w.followupCoverage;

  // Normalize against weight sum to keep math correct even if weights are
  // tweaked at runtime via a future config knob.
  const normalized = raw / weightsSum();

  let overall = Math.round(normalized);

  if (
    tracking < LAUNCH_SCORE_FLOORS.trackingCoverage ||
    compliance < LAUNCH_SCORE_FLOORS.complianceConfidence
  ) {
    overall = Math.min(overall, NOT_LAUNCH_READY_CAP);
  }

  return clamp01to100(overall) | 0;
}

/**
 * Convenience: returns true iff the campaign is at or above the launch-ready
 * threshold AND clears both critical floors.
 */
export function isLaunchReady(sub: LaunchSubScores): boolean {
  if (sub.trackingCoverage < LAUNCH_SCORE_FLOORS.trackingCoverage) return false;
  if (sub.complianceConfidence < LAUNCH_SCORE_FLOORS.complianceConfidence) return false;
  return computeLaunchReadinessScore(sub) >= LAUNCH_READY_THRESHOLD;
}

/**
 * Returns the human-readable explanation of why a campaign fell short, or
 * `null` if it is launch-ready. Useful for surfacing diagnostic UI in the
 * Launch Center cockpit.
 */
export function explainScore(sub: LaunchSubScores): string | null {
  if (sub.trackingCoverage < LAUNCH_SCORE_FLOORS.trackingCoverage) {
    return `Tracking coverage (${sub.trackingCoverage}) below floor (${LAUNCH_SCORE_FLOORS.trackingCoverage}). Install pixel + Conversions API before launching.`;
  }
  if (sub.complianceConfidence < LAUNCH_SCORE_FLOORS.complianceConfidence) {
    return `Compliance confidence (${sub.complianceConfidence}) below floor (${LAUNCH_SCORE_FLOORS.complianceConfidence}). Resolve high-severity findings before launching.`;
  }
  const overall = computeLaunchReadinessScore(sub);
  if (overall < LAUNCH_READY_THRESHOLD) {
    return `Overall readiness (${overall}) below launch threshold (${LAUNCH_READY_THRESHOLD}). Improve the lowest-weighted sub-scores.`;
  }
  return null;
}
