/**
 * GoFunnelAI — Platform Recommendation agent (Level 2 Launch Center).
 *
 * Given the CampaignStrategy + funnel context, score every supported platform
 * for fit and emit a ranked recommendation with a per-platform rationale and
 * a starter daily budget.
 *
 * Heuristics (per-industry, applied additively, then clamped to 0..100):
 *   - B2B SaaS leans LinkedIn + Google; Meta as a retargeting accelerant; skip
 *     TikTok unless the buyer persona explicitly indexes there.
 *   - Consumer service verticals (med spa, dental, real estate, local services)
 *     lean Meta + TikTok; Google captures local intent; LinkedIn is irrelevant.
 *   - Regulated verticals (med_spa, insurance) DOWN-weight TikTok for medical
 *     or legal claims and disallow Snapchat for medical.
 *   - Solar + insurance favor Meta + Google + YouTube.
 *   - Default penalty for X / Snapchat / Pinterest / Reddit unless an explicit
 *     buyer hypothesis surfaces them.
 *
 * The agent never returns a fitScore < 0 or > 100. Platforms below
 * `minFitScore` (default 35) are excluded entirely.
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 */

import { Platform, getPlatformMeta } from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";
import type { CampaignStrategy, FunnelContext } from "./strategy.js";

export interface PlatformRecommendation {
  platform: Platform;
  fitScore: number; // 0..100
  rationale: string;
  recommendedBudgetDaily: number; // USD per day
  /** Sub-scores used to compute fitScore — surfaced for the cockpit. */
  signals: {
    audienceFit: number;
    creativeFit: number;
    intentFit: number;
    complianceFit: number;
  };
}

export interface RecommendPlatformsOptions {
  /** Total daily budget pool to allocate (USD). Default $100. */
  totalDailyBudgetUsd?: number;
  /** Drop platforms scoring below this threshold. Default 35. */
  minFitScore?: number;
  /** Hard exclusions the workspace has configured (e.g. for compliance). */
  excludePlatforms?: readonly Platform[];
  /** When true, return all platforms (no pruning) — useful for cockpit pickers. */
  includeAll?: boolean;
}

const DEFAULT_TOTAL_BUDGET_USD = 100;
const DEFAULT_MIN_FIT = 35;

/**
 * Score and rank platforms for the given strategy + funnel.
 *
 * @returns Recommendations sorted by fitScore desc, then by platform name asc
 *          for stable test snapshots.
 */
export async function recommendPlatforms(
  strategy: CampaignStrategy,
  funnel: FunnelContext,
  options: RecommendPlatformsOptions = {},
): Promise<PlatformRecommendation[]> {
  const totalBudget = options.totalDailyBudgetUsd ?? DEFAULT_TOTAL_BUDGET_USD;
  const minFit = options.minFitScore ?? DEFAULT_MIN_FIT;
  const excluded = new Set(options.excludePlatforms ?? []);

  const allPlatforms = Object.values(Platform) as Platform[];
  const scored = allPlatforms
    .filter((p) => !excluded.has(p))
    .map((platform) => scorePlatform({ platform, strategy, funnel }));

  const pruned = options.includeAll
    ? scored
    : scored.filter((rec) => rec.fitScore >= minFit);

  const ranked = pruned.sort((a, b) => {
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    return a.platform.localeCompare(b.platform);
  });

  // Allocate daily budget proportional to fitScore. Floor at $10/day per
  // recommended platform so cockpit doesn't suggest absurdly tiny budgets.
  const recommendations = allocateBudgets(ranked, totalBudget);

  await emitLaunch(
    "launch_platforms_recommended",
    {
      funnelId: funnel.funnelId,
      workspaceId: funnel.workspaceId,
      platforms: recommendations.map((r) => ({
        platform: r.platform,
        fitScore: r.fitScore,
        budgetDaily: r.recommendedBudgetDaily,
      })),
      totalDailyBudgetUsd: totalBudget,
    },
    { workspaceId: funnel.workspaceId },
  );

  return recommendations;
}

/* -------------------------------------------------------------------------
 * Scoring
 * ----------------------------------------------------------------------- */

interface IndustrySignals {
  bias: Partial<Record<Platform, number>>;
  intent: Partial<Record<Platform, number>>;
  compliancePenalty: Partial<Record<Platform, number>>;
  notes: Partial<Record<Platform, string>>;
}

function industryKeyOf(strategy: CampaignStrategy): string {
  return strategy.offerSnapshot.industryKey;
}

function industrySignals(strategy: CampaignStrategy): IndustrySignals {
  const key = industryKeyOf(strategy);
  switch (key) {
    case "saas":
      return {
        bias: {
          [Platform.LinkedIn]: 96,
          [Platform.Google]: 90,
          [Platform.Meta]: 60,
          [Platform.YouTube]: 55,
          [Platform.Reddit]: 38,
          [Platform.X]: 30,
          [Platform.TikTok]: 5,
          [Platform.Snapchat]: 0,
          [Platform.Pinterest]: 0,
        },
        intent: {
          [Platform.LinkedIn]: 84,
          [Platform.Google]: 90,
          [Platform.Meta]: 45,
          [Platform.Reddit]: 40,
          [Platform.TikTok]: 5,
          [Platform.Snapchat]: 0,
          [Platform.Pinterest]: 0,
          [Platform.X]: 25,
          [Platform.YouTube]: 45,
        },
        // B2B buying committees don't greenlight purchases from short-form
        // social — deprioritise TikTok/Snapchat hard. Pinterest is irrelevant
        // for SaaS demos.
        compliancePenalty: {
          [Platform.TikTok]: 40,
          [Platform.Snapchat]: 40,
          [Platform.Pinterest]: 25,
        },
        notes: {
          [Platform.LinkedIn]: "B2B buyer lives here — job title, industry, seniority targeting align with the ICP.",
          [Platform.Google]: "Bottom-funnel intent on competitor + category keywords closes the buying committee.",
          [Platform.TikTok]: "B2B buying committees do not greenlight purchases from TikTok creative — deprioritise.",
        },
      };
    case "solar":
      return {
        bias: {
          [Platform.Meta]: 95,
          [Platform.Google]: 86,
          [Platform.YouTube]: 80,
          [Platform.TikTok]: 55,
          [Platform.Pinterest]: 25,
          [Platform.LinkedIn]: 8,
          [Platform.Snapchat]: 20,
          [Platform.X]: 15,
          [Platform.Reddit]: 28,
        },
        intent: {
          [Platform.Google]: 86,
          [Platform.Meta]: 82,
          [Platform.LinkedIn]: 5,
          [Platform.X]: 15,
          [Platform.Snapchat]: 15,
          [Platform.Pinterest]: 20,
          [Platform.Reddit]: 25,
          [Platform.YouTube]: 65,
        },
        compliancePenalty: {
          // Savings-claim policies tighter on short-form social; small penalty.
          [Platform.TikTok]: 10,
        },
        notes: {
          [Platform.Meta]: "Homeowner persona + detailed targeting + lookalikes from converted installs.",
          [Platform.Google]: "High intent on bill-shock and incentive searches; capture click-to-quote.",
          [Platform.YouTube]: "Skeptical buyers need long-form proof and demo content.",
          [Platform.TikTok]: "Risk of savings-claim flags; restrict to UGC proof-led content with disclaimers.",
        },
      };
    case "insurance":
      return {
        bias: {
          [Platform.Meta]: 80,
          [Platform.Google]: 92,
          [Platform.YouTube]: 65,
          [Platform.LinkedIn]: 35,
          [Platform.TikTok]: 25,
          [Platform.Pinterest]: 15,
          [Platform.Snapchat]: 10,
          [Platform.X]: 20,
          [Platform.Reddit]: 25,
        },
        intent: {
          [Platform.Google]: 95,
          [Platform.Meta]: 60,
        },
        compliancePenalty: {
          [Platform.TikTok]: 15,
          [Platform.Snapchat]: 20,
        },
        notes: {
          [Platform.Google]: "Quote-comparison and coverage-gap intent searches dominate.",
          [Platform.Meta]: "Lookalike seeds from policy-bound customer match.",
          [Platform.TikTok]: "Carrier and license disclosures harder to surface in short-form — restrict.",
        },
      };
    case "med_spa":
      return {
        bias: {
          [Platform.Meta]: 88,
          [Platform.TikTok]: 78,
          [Platform.Google]: 72,
          [Platform.Pinterest]: 60,
          [Platform.YouTube]: 50,
          [Platform.Snapchat]: 30,
          [Platform.LinkedIn]: 10,
          [Platform.X]: 15,
          [Platform.Reddit]: 25,
        },
        intent: {
          [Platform.Google]: 80,
          [Platform.Meta]: 70,
          [Platform.Pinterest]: 65,
        },
        // Regulated vertical: TikTok medical-claim policies, Snapchat
        // medical-imagery policies, both get a penalty.
        compliancePenalty: {
          [Platform.TikTok]: 25,
          [Platform.Snapchat]: 35,
          [Platform.Meta]: 10,
        },
        notes: {
          [Platform.Meta]: "Detailed-targeting plus consented before/after proof drives consult bookings.",
          [Platform.TikTok]: "Medical-claim policy risk — restrict to educational, no-result-claim creatives.",
          [Platform.Snapchat]: "Medical imagery policy + ephemeral format unfit for safety-led claims.",
        },
      };
    case "dental":
      return {
        bias: {
          [Platform.Google]: 90,
          [Platform.Meta]: 78,
          [Platform.YouTube]: 50,
          [Platform.TikTok]: 40,
          [Platform.LinkedIn]: 5,
          [Platform.Pinterest]: 25,
          [Platform.Snapchat]: 20,
          [Platform.X]: 10,
          [Platform.Reddit]: 15,
        },
        intent: {
          [Platform.Google]: 92,
          [Platform.Meta]: 60,
        },
        compliancePenalty: {
          [Platform.TikTok]: 10,
        },
        notes: {
          [Platform.Google]: "Local-intent search + Maps + appointment extensions dominate dental funnels.",
          [Platform.Meta]: "Detailed targeting plus benefits-check lead magnet for new patients.",
          [Platform.TikTok]: "Avoid clinical-outcome claims; restrict to comfort-care brand content.",
        },
      };
    case "real_estate":
      return {
        bias: {
          [Platform.Meta]: 90,
          [Platform.Google]: 78,
          [Platform.YouTube]: 60,
          [Platform.TikTok]: 65,
          [Platform.Pinterest]: 55,
          [Platform.LinkedIn]: 30,
          [Platform.Snapchat]: 35,
          [Platform.X]: 20,
          [Platform.Reddit]: 25,
        },
        intent: {
          [Platform.Google]: 80,
          [Platform.Meta]: 75,
        },
        compliancePenalty: {},
        notes: {
          [Platform.Meta]: "Neighborhood + value-snapshot lookalikes from past sellers.",
          [Platform.TikTok]: "Short-form market updates and listing tours drive seller curiosity.",
          [Platform.Google]: "Capture 'home value' and 'sell my house' search intent.",
        },
      };
    case "local_services":
    default:
      return {
        bias: {
          [Platform.Meta]: 80,
          [Platform.Google]: 88,
          [Platform.YouTube]: 45,
          [Platform.TikTok]: 50,
          [Platform.LinkedIn]: 10,
          [Platform.Pinterest]: 30,
          [Platform.Snapchat]: 25,
          [Platform.X]: 15,
          [Platform.Reddit]: 25,
        },
        intent: {
          [Platform.Google]: 90,
          [Platform.Meta]: 60,
        },
        compliancePenalty: {},
        notes: {
          [Platform.Google]: "Emergency + scheduled service intent searches drive most local-services leads.",
          [Platform.Meta]: "Service-area + interest targeting for non-urgent home services demand.",
        },
      };
  }
}

function scorePlatform(args: {
  platform: Platform;
  strategy: CampaignStrategy;
  funnel: FunnelContext;
}): PlatformRecommendation {
  const { platform, strategy } = args;
  const sig = industrySignals(strategy);
  const meta = getPlatformMeta(platform);

  const audienceFit = sig.bias[platform] ?? 30;
  const intentFit = sig.intent[platform] ?? Math.max(20, audienceFit - 25);
  const creativeFit = creativeFitFor({ platform, strategy });
  const compliancePenalty = sig.compliancePenalty[platform] ?? 0;
  const complianceFit = Math.max(0, 100 - compliancePenalty);

  // Weighted blend — audience and intent dominate; creative + compliance
  // shape the tail.
  const raw =
    audienceFit * 0.4 +
    intentFit * 0.3 +
    creativeFit * 0.2 +
    complianceFit * 0.1 -
    compliancePenalty;
  const fitScore = Math.round(clamp(raw, 0, 100));

  const rationale = buildPlatformRationale({
    platform,
    strategy,
    audienceFit,
    intentFit,
    creativeFit,
    compliancePenalty,
    note: sig.notes[platform],
    meta,
  });

  return {
    platform,
    fitScore,
    rationale,
    recommendedBudgetDaily: 0, // populated by allocateBudgets()
    signals: {
      audienceFit,
      creativeFit,
      intentFit,
      complianceFit,
    },
  };
}

function creativeFitFor(args: {
  platform: Platform;
  strategy: CampaignStrategy;
}): number {
  const { platform, strategy } = args;
  const meta = getPlatformMeta(platform);
  // If the platform requires video and the strategy doesn't lean into a
  // video-friendly angle (Speed/Pain/Proof do — Trust/ROI lean static), gently
  // penalise.
  const videoAngles: Record<string, boolean> = {
    pain: true,
    proof: true,
    speed: true,
    fear: true,
    comparison: true,
    convenience: true,
    roi: false,
    trust: false,
  };
  const angleLeansVideo = videoAngles[strategy.creativeAngle] ?? true;
  if (meta.requiresVideoFormat && !angleLeansVideo) return 55;
  if (meta.requiresVideoFormat && angleLeansVideo) return 80;
  // Carousel-rich platforms (Meta, LinkedIn, Pinterest) handle Proof + ROI
  // particularly well.
  if (
    meta.adFormats.includes("carousel") &&
    (strategy.creativeAngle === "proof" || strategy.creativeAngle === "roi")
  ) {
    return 85;
  }
  return 70;
}

function buildPlatformRationale(args: {
  platform: Platform;
  strategy: CampaignStrategy;
  audienceFit: number;
  intentFit: number;
  creativeFit: number;
  compliancePenalty: number;
  note?: string;
  meta: ReturnType<typeof getPlatformMeta>;
}): string {
  const { platform, note, audienceFit, intentFit, compliancePenalty, meta } = args;
  const parts: string[] = [];
  if (note) parts.push(note);
  parts.push(`Audience signal ${audienceFit}/100, intent ${intentFit}/100.`);
  if (compliancePenalty > 0) {
    parts.push(`Compliance penalty -${compliancePenalty}: tighten creative review before launch.`);
  }
  if (!meta.supportsLeadGen) {
    parts.push(`No native lead-gen form on ${platform} — route to the funnel landing page.`);
  }
  return parts.join(" ");
}

/* -------------------------------------------------------------------------
 * Budget allocation
 * ----------------------------------------------------------------------- */

function allocateBudgets(
  ranked: PlatformRecommendation[],
  totalDailyBudgetUsd: number,
): PlatformRecommendation[] {
  if (ranked.length === 0) return ranked;
  const scoreSum = ranked.reduce((acc, rec) => acc + rec.fitScore, 0);
  if (scoreSum === 0) {
    const flat = Math.round(totalDailyBudgetUsd / ranked.length);
    return ranked.map((rec) => ({ ...rec, recommendedBudgetDaily: flat }));
  }
  const FLOOR = 10;
  // Ensure floor is feasible — if the floor would over-allocate, reduce it.
  const feasibleFloor = Math.min(
    FLOOR,
    Math.floor(totalDailyBudgetUsd / Math.max(1, ranked.length)),
  );
  const floored = ranked.map((rec) => ({
    rec,
    pct: rec.fitScore / scoreSum,
  }));
  let allocated = 0;
  const out: PlatformRecommendation[] = floored.map(({ rec, pct }) => {
    const proposed = Math.max(feasibleFloor, Math.round(totalDailyBudgetUsd * pct));
    allocated += proposed;
    return { ...rec, recommendedBudgetDaily: proposed };
  });
  // Adjust the last entry so the totals line up exactly with the requested
  // pool — deterministic for snapshot tests.
  const delta = totalDailyBudgetUsd - allocated;
  if (delta !== 0 && out.length > 0) {
    const last = out[out.length - 1]!;
    const adjusted = Math.max(feasibleFloor, last.recommendedBudgetDaily + delta);
    out[out.length - 1] = { ...last, recommendedBudgetDaily: adjusted };
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
