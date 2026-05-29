/**
 * GoFunnelAI — Launch Readiness Score agent.
 *
 * Computes a 0–100 overall readiness from 8 weighted sub-scores. The weights
 * are the Level-2 spec defaults (sum to 1.0):
 *
 *   funnelReadiness   0.15
 *   creativeQuality   0.15
 *   videoReadiness    0.10
 *   trackingReadiness 0.15
 *   offerStrength     0.15
 *   audienceFit       0.10
 *   complianceRisk    0.10   (inverted — higher risk LOWERS score)
 *   followupCoverage  0.10
 *                    ------
 *                    = 1.00
 *
 * The canonical `LaunchScore` shape in `@funnel/shared/launch` only carries
 * 7 sub-scores. We fill those 7 with their nearest analogue and stash the
 * full 8-axis breakdown plus the diagnostic list of "needs attention" axes
 * in `inputs` so the cockpit can render the full picture.
 *
 *   nearest analogue map (canonical ← spec):
 *     creativeQuality          ← creativeQuality
 *     audienceFit              ← audienceFit
 *     trackingCoverage         ← trackingReadiness
 *     complianceConfidence     ← 100 − complianceRisk
 *     budgetRealism            ← offerStrength      (proxy)
 *     funnelReadiness          ← funnelReadiness
 *     followupCoverage         ← followupCoverage
 *
 * Sub-scores under 60 are flagged in `inputs.needsAttention[]`.
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 */

import { createHash } from "node:crypto";

import {
  type AdVariant,
  type Campaign,
  type CreativeAsset,
  type LaunchChecklist,
  type LaunchScore,
  type VideoAsset,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Weights & types
// ---------------------------------------------------------------------------

export const SPEC_WEIGHTS = {
  funnelReadiness: 0.15,
  creativeQuality: 0.15,
  videoReadiness: 0.1,
  trackingReadiness: 0.15,
  offerStrength: 0.15,
  audienceFit: 0.1,
  complianceRisk: 0.1,
  followupCoverage: 0.1,
} as const;

export const ATTENTION_THRESHOLD = 60;
export const LAUNCH_READY_THRESHOLD = 70;

export interface LaunchSubScoresSpec {
  funnelReadiness: number;
  creativeQuality: number;
  videoReadiness: number;
  trackingReadiness: number;
  offerStrength: number;
  audienceFit: number;
  /** 0..100. Higher = MORE risk. Inverted in overall calc. */
  complianceRisk: number;
  followupCoverage: number;
}

export interface FunnelReadinessInputs {
  hasPublishedFunnel: boolean;
  pagesComplete: boolean;
  styleGuideReady: boolean;
  domainConnected: boolean;
  leadMagnetWired: boolean;
  thankYouPageWired: boolean;
}

export interface OfferStrengthInputs {
  hasFreeValueAsset: boolean;
  hasRiskReversal: boolean;
  hasUrgencyMechanism: boolean;
  upsellLadderSteps: number;
  guaranteeStrengthScore: number; // 0..100
}

export interface ComputeLaunchScoreArgs {
  campaign: Pick<Campaign, "id" | "workspaceId" | "audienceProfileIds" | "primaryAngle" | "platforms">;
  funnel: FunnelReadinessInputs;
  variants: ReadonlyArray<Pick<AdVariant, "id" | "platform" | "angle" | "qualityScore" | "predictedCtr" | "status">>;
  creativeAssets: ReadonlyArray<Pick<CreativeAsset, "id" | "type">>;
  videoAssets: ReadonlyArray<Pick<VideoAsset, "id" | "videoType" | "hasCaptions" | "hasVoiceover" | "durationSec" | "aspectRatio">>;
  trackingChecklist: Pick<LaunchChecklist, "items">;
  complianceFindings: ReadonlyArray<{ severity: "info" | "low" | "medium" | "high" | "critical" | "blocker" }>;
  audience: {
    hasAtLeastOneProfile: boolean;
    profileCount: number;
    geoSpecified: boolean;
    estimatedReach: number | null;
  };
  offer: OfferStrengthInputs;
  followup: {
    hasSequence: boolean;
    immediateStepPresent: boolean;
    day1Present: boolean;
    day3Present: boolean;
    day7Present: boolean;
    reactivationPresent: boolean;
    noShowPresent: boolean;
    bookingGoal: boolean;
  };
}

// ---------------------------------------------------------------------------
// Sub-score helpers
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return clamp((part / whole) * 100);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return clamp(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function scoreFunnel(f: FunnelReadinessInputs): number {
  const flags = [
    f.hasPublishedFunnel,
    f.pagesComplete,
    f.styleGuideReady,
    f.domainConnected,
    f.leadMagnetWired,
    f.thankYouPageWired,
  ];
  return pctOf(flags.filter(Boolean).length, flags.length);
}

function scoreCreative(variants: ComputeLaunchScoreArgs["variants"], creative: ComputeLaunchScoreArgs["creativeAssets"]): number {
  const readyVariants = variants.filter((v) => v.status === "ready" || v.status === "approved");
  const variantCoverage = pctOf(readyVariants.length, Math.max(variants.length, 1));
  const qa = avg(readyVariants.map((v) => (v.qualityScore ?? 0)));
  const ctrSignal = avg(
    readyVariants.map((v) => {
      const ctr = v.predictedCtr ?? 0;
      return clamp(ctr * 1000); // 1% CTR → 10 pts, 10% → 100 pts (cap)
    }),
  );
  const assetCount = creative.length;
  const assetCoverage = pctOf(Math.min(assetCount, 16), 16);
  return clamp(variantCoverage * 0.35 + qa * 0.35 + ctrSignal * 0.15 + assetCoverage * 0.15);
}

function scoreVideo(videos: ComputeLaunchScoreArgs["videoAssets"]): number {
  if (videos.length === 0) return 0;
  let pts = 0;
  let denom = 0;
  // Coverage: target 3 videos, scaled.
  const coverage = pctOf(Math.min(videos.length, 3), 3);
  pts += coverage; denom += 1;
  const captions = pctOf(videos.filter((v) => v.hasCaptions).length, videos.length);
  pts += captions; denom += 1;
  const voiceover = pctOf(videos.filter((v) => v.hasVoiceover).length, videos.length);
  pts += voiceover; denom += 1;
  const aspectMix = new Set(videos.map((v) => v.aspectRatio)).size;
  pts += pctOf(Math.min(aspectMix, 3), 3); denom += 1;
  const durations = videos.map((v) => v.durationSec).filter((d) => d > 0);
  const hookable = durations.filter((d) => d <= 30).length;
  pts += pctOf(hookable, Math.max(durations.length, 1)); denom += 1;
  return clamp(pts / denom);
}

function scoreTracking(checklist: ComputeLaunchScoreArgs["trackingChecklist"]): number {
  if (!checklist.items || checklist.items.length === 0) return 0;
  const required = checklist.items.filter((i) => i.required);
  const requiredPassed = required.filter(
    (i) => i.status === "passed" || i.status === "not_applicable",
  );
  const requiredScore = pctOf(requiredPassed.length, Math.max(required.length, 1));
  const optional = checklist.items.filter((i) => !i.required);
  const optionalPassed = optional.filter(
    (i) => i.status === "passed" || i.status === "not_applicable",
  );
  const optionalScore = optional.length === 0 ? 100 : pctOf(optionalPassed.length, optional.length);
  return clamp(requiredScore * 0.8 + optionalScore * 0.2);
}

function scoreOffer(o: OfferStrengthInputs): number {
  const flagPoints = [
    o.hasFreeValueAsset ? 20 : 0,
    o.hasRiskReversal ? 15 : 0,
    o.hasUrgencyMechanism ? 10 : 0,
    Math.min(o.upsellLadderSteps, 4) * 5, // up to 20
    Math.round(clamp(o.guaranteeStrengthScore) * 0.35), // up to 35
  ];
  return clamp(flagPoints.reduce((a, b) => a + b, 0));
}

function scoreAudience(a: ComputeLaunchScoreArgs["audience"]): number {
  let v = 0;
  if (a.hasAtLeastOneProfile) v += 35;
  if (a.profileCount >= 2) v += 10;
  if (a.profileCount >= 4) v += 5;
  if (a.geoSpecified) v += 20;
  if (a.estimatedReach && a.estimatedReach >= 5_000) v += 15;
  if (a.estimatedReach && a.estimatedReach >= 50_000) v += 10;
  if (a.estimatedReach && a.estimatedReach >= 250_000) v += 5;
  return clamp(v);
}

const COMPLIANCE_WEIGHTS: Record<string, number> = {
  info: 0,
  low: 5,
  medium: 15,
  high: 30,
  critical: 50,
  blocker: 100,
};

/** Higher score = MORE risk. */
function scoreComplianceRisk(findings: ComputeLaunchScoreArgs["complianceFindings"]): number {
  if (findings.length === 0) return 0;
  let total = 0;
  for (const f of findings) total += COMPLIANCE_WEIGHTS[f.severity] ?? 0;
  return clamp(total);
}

function scoreFollowup(f: ComputeLaunchScoreArgs["followup"]): number {
  if (!f.hasSequence) return 0;
  const required: boolean[] = [f.immediateStepPresent, f.day1Present, f.day3Present, f.day7Present, f.reactivationPresent];
  if (f.bookingGoal) required.push(f.noShowPresent);
  return pctOf(required.filter(Boolean).length, required.length);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LaunchScoreResult {
  score: LaunchScore;
  /** Full 8-axis breakdown (the canonical shape only carries 7). */
  spec: LaunchSubScoresSpec;
  /** Sub-scores below `ATTENTION_THRESHOLD`. */
  needsAttention: Array<{ axis: keyof LaunchSubScoresSpec; value: number; gap: number }>;
  /** True iff overall ≥ LAUNCH_READY_THRESHOLD. */
  isLaunchReady: boolean;
}

export function computeLaunchScore(args: ComputeLaunchScoreArgs): LaunchScoreResult {
  const spec: LaunchSubScoresSpec = {
    funnelReadiness: scoreFunnel(args.funnel),
    creativeQuality: scoreCreative(args.variants, args.creativeAssets),
    videoReadiness: scoreVideo(args.videoAssets),
    trackingReadiness: scoreTracking(args.trackingChecklist),
    offerStrength: scoreOffer(args.offer),
    audienceFit: scoreAudience(args.audience),
    complianceRisk: scoreComplianceRisk(args.complianceFindings),
    followupCoverage: scoreFollowup(args.followup),
  };

  const w = SPEC_WEIGHTS;
  const overallRaw =
    spec.funnelReadiness * w.funnelReadiness +
    spec.creativeQuality * w.creativeQuality +
    spec.videoReadiness * w.videoReadiness +
    spec.trackingReadiness * w.trackingReadiness +
    spec.offerStrength * w.offerStrength +
    spec.audienceFit * w.audienceFit +
    (100 - spec.complianceRisk) * w.complianceRisk +
    spec.followupCoverage * w.followupCoverage;

  const overall = Math.round(clamp(overallRaw));

  const axisOrder: Array<keyof LaunchSubScoresSpec> = [
    "funnelReadiness",
    "creativeQuality",
    "videoReadiness",
    "trackingReadiness",
    "offerStrength",
    "audienceFit",
    "complianceRisk",
    "followupCoverage",
  ];
  const needsAttention: LaunchScoreResult["needsAttention"] = [];
  for (const axis of axisOrder) {
    const value = spec[axis];
    if (axis === "complianceRisk") {
      // For risk, "high" is bad → flag if risk > 100 - ATTENTION_THRESHOLD.
      if (value > 100 - ATTENTION_THRESHOLD) {
        needsAttention.push({ axis, value, gap: value - (100 - ATTENTION_THRESHOLD) });
      }
    } else if (value < ATTENTION_THRESHOLD) {
      needsAttention.push({ axis, value, gap: ATTENTION_THRESHOLD - value });
    }
  }

  const now = new Date();
  const idHash = createHash("sha256")
    .update(`${args.campaign.workspaceId}|${args.campaign.id}|${now.toISOString().slice(0, 10)}`, "utf8")
    .digest("hex")
    .slice(0, 16);

  const score: LaunchScore = {
    id: `lsc_${idHash}`,
    campaignId: args.campaign.id,
    overall,
    creativeQuality: spec.creativeQuality,
    audienceFit: spec.audienceFit,
    trackingCoverage: spec.trackingReadiness,
    complianceConfidence: clamp(100 - spec.complianceRisk),
    budgetRealism: spec.offerStrength,
    funnelReadiness: spec.funnelReadiness,
    followupCoverage: spec.followupCoverage,
    computedAt: now,
    inputs: {
      spec_weights: SPEC_WEIGHTS,
      spec_sub_scores: spec,
      needs_attention: needsAttention,
      attention_threshold: ATTENTION_THRESHOLD,
      launch_ready_threshold: LAUNCH_READY_THRESHOLD,
    },
  };

  const result: LaunchScoreResult = {
    score,
    spec,
    needsAttention,
    isLaunchReady: overall >= LAUNCH_READY_THRESHOLD && needsAttention.length === 0,
  };

  void emitLaunch(
    "launch_score_computed",
    {
      campaign_id: args.campaign.id,
      overall: overall,
      needs_attention_count: needsAttention.length,
      is_launch_ready: result.isLaunchReady,
    },
    { campaignId: args.campaign.id, workspaceId: args.campaign.workspaceId },
  );

  return result;
}

export const __internal = {
  scoreFunnel,
  scoreCreative,
  scoreVideo,
  scoreTracking,
  scoreOffer,
  scoreAudience,
  scoreComplianceRisk,
  scoreFollowup,
};
