/**
 * GoFunnelAI — Launch Strategy agent (Level 2 Launch Center).
 *
 * Produces a `CampaignStrategy` summarising:
 *   - campaign name + objective
 *   - primary + secondary audience descriptors
 *   - the dominant pain point being addressed
 *   - the main offer + primary CTA
 *   - the creative angle anchoring all variants
 *   - a recommended starter platform mix
 *
 * Reasoning model: Anthropic Claude Sonnet (Sonnet-4-6 in production). The
 * agent is structured so callers can inject a deterministic reasoner for
 * tests — the default synthesiser is a deterministic blend of:
 *   1. The industry KB pack (via `buildOfferIntelligence`) — pulls audience,
 *      pain points, offer stack, lead magnet, and proof assets.
 *   2. Workspace brand tokens (palette, voice register) when supplied.
 *   3. The 8 canonical ad angles in `@funnel/shared/launch/angles`.
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 */

import { AdAngle, Platform } from "@funnel/shared/launch";

import {
  buildOfferIntelligence,
  type OfferIntelligenceProfile,
  type OfferIntelligenceResult,
} from "../offer-intelligence.js";
import { emitLaunch } from "./events.js";

/** Brand token snapshot passed in from the workspace. Minimal by design. */
export interface WorkspaceBrandTokens {
  workspaceId: string;
  brandName?: string;
  primaryColor?: string;
  voiceRegister?: "casual" | "formal" | "playful" | "authoritative" | "warm";
  bannedWords?: readonly string[];
  signaturePhrases?: readonly string[];
}

/** Funnel context handed to the strategy agent. */
export interface FunnelContext {
  funnelId: string;
  workspaceId: string;
  /** Industry vertical key or label, e.g. "Solar installation", "dental". */
  industry: string;
  /** Geography ISO-2 (default `US`). */
  geography?: string;
  /** The offer body the funnel pitches. */
  offer?: string;
  /** Description of the target customer (free text). */
  targetCustomer?: string;
  /** Optional traffic awareness — drives angle selection. */
  awareness?: "cold" | "warm" | "hot";
  /** Optional headline price point (used to bias platforms + offer copy). */
  pricePointCents?: number;
}

/** Caller-supplied audience hint (used to seed primary persona). */
export interface AudienceHint {
  primary?: string;
  secondary?: string;
  ageMin?: number;
  ageMax?: number;
  geo?: { countries?: string[]; cities?: string[]; radiusKm?: number | null };
}

export interface RunLaunchStrategyInput {
  funnelId: string;
  workspaceId: string;
  /** Campaign goal — e.g. "book qualified consults", "drive trials", "demo requests". */
  goal: string;
  funnel: FunnelContext;
  brand?: WorkspaceBrandTokens;
  targetAudience?: AudienceHint;
}

export interface RecommendedPlatformSeed {
  platform: Platform;
  rationale: string;
}

export interface CampaignStrategy {
  campaignName: string;
  objective: string;
  primaryAudienceDesc: string;
  secondaryAudienceDesc: string;
  painPoint: string;
  mainOffer: string;
  primaryCta: string;
  creativeAngle: AdAngle;
  creativeAngleRationale: string;
  recommendedPlatforms: RecommendedPlatformSeed[];
  /** Free-text rationale for why this strategy was selected. */
  rationale: string;
  /** Stable identifier of the reasoning model used (for cost accounting). */
  reasoningModel: string;
  /** Snapshot of the offer-intelligence inputs that produced this strategy. */
  offerSnapshot: {
    industryKey: OfferIntelligenceResult["industryKey"];
    industryLabel: string;
    archetype: OfferIntelligenceResult["archetype"];
    kbVersion: string;
  };
}

/**
 * Pluggable reasoner. Defaults to a deterministic synthesiser that does not
 * need network credentials; production wires this to Anthropic Claude Sonnet
 * via the `@funnel/agents` LLM client.
 */
export interface StrategyReasoner {
  modelId: string;
  reason(args: {
    input: RunLaunchStrategyInput;
    offerIntel: OfferIntelligenceResult;
  }): CampaignStrategy | Promise<CampaignStrategy>;
}

const DEFAULT_REASONING_MODEL = "claude-sonnet-4-6";

/**
 * Default deterministic reasoner. Production replaces this with an Anthropic
 * Claude Sonnet call by passing `{ reasoner }` to `runLaunchStrategy`.
 */
export const defaultStrategyReasoner: StrategyReasoner = {
  modelId: DEFAULT_REASONING_MODEL,
  reason({ input, offerIntel }) {
    const brand = input.brand;
    const brandName = brand?.brandName?.trim() || "Your brand";
    const goalLabel = (input.goal || "").trim() || offerIntel.offerStack.mainCta;
    const angle = pickCreativeAngle(input, offerIntel);
    const platforms = seedPlatforms(input, offerIntel);
    const primary =
      input.targetAudience?.primary?.trim() ||
      input.funnel.targetCustomer?.trim() ||
      offerIntel.audience;
    const secondary =
      input.targetAudience?.secondary?.trim() ||
      buildSecondaryAudience(offerIntel);
    const painPoint = pickPainPoint(offerIntel);
    const cta = offerIntel.offerStack.mainCta;
    const offerLine =
      input.funnel.offer?.trim() || offerIntel.offerStack.corePromise;

    return {
      campaignName: buildCampaignName(brandName, offerIntel, angle),
      objective: buildObjective(goalLabel, offerIntel),
      primaryAudienceDesc: primary,
      secondaryAudienceDesc: secondary,
      painPoint,
      mainOffer: offerLine,
      primaryCta: cta,
      creativeAngle: angle,
      creativeAngleRationale: angleRationale(angle, offerIntel),
      recommendedPlatforms: platforms,
      rationale: buildRationale(input, offerIntel, angle, platforms),
      reasoningModel: DEFAULT_REASONING_MODEL,
      offerSnapshot: {
        industryKey: offerIntel.industryKey,
        industryLabel: offerIntel.industryLabel,
        archetype: offerIntel.archetype,
        kbVersion: offerIntel.kbVersion,
      },
    };
  },
};

/**
 * Run the launch strategy agent.
 *
 * @param input  The funnel + brand + goal + (optional) audience hint.
 * @param deps   Test-injectable dependencies (reasoner override).
 * @returns The complete CampaignStrategy. Side-effect: emits
 *          `launch_strategy_started` + `launch_strategy_completed`.
 */
export async function runLaunchStrategy(
  input: RunLaunchStrategyInput,
  deps: { reasoner?: StrategyReasoner } = {},
): Promise<CampaignStrategy> {
  const reasoner = deps.reasoner ?? defaultStrategyReasoner;
  await emitLaunch(
    "launch_strategy_started",
    {
      funnelId: input.funnelId,
      workspaceId: input.workspaceId,
      goal: input.goal,
      industry: input.funnel.industry,
      reasoningModel: reasoner.modelId,
    },
    { workspaceId: input.workspaceId },
  );

  const offerIntel = buildOfferIntelligence(toOfferProfile(input));
  const strategy = await reasoner.reason({ input, offerIntel });

  await emitLaunch(
    "launch_strategy_completed",
    {
      funnelId: input.funnelId,
      workspaceId: input.workspaceId,
      campaignName: strategy.campaignName,
      creativeAngle: strategy.creativeAngle,
      platforms: strategy.recommendedPlatforms.map((p) => p.platform),
      reasoningModel: strategy.reasoningModel,
    },
    { workspaceId: input.workspaceId },
  );

  return strategy;
}

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function toOfferProfile(input: RunLaunchStrategyInput): OfferIntelligenceProfile {
  return {
    workspace_id: input.workspaceId,
    industry: input.funnel.industry,
    geography: input.funnel.geography ?? "US",
    offer: input.funnel.offer ?? input.goal,
    target_customer: input.targetAudience?.primary ?? input.funnel.targetCustomer ?? "qualified buyers",
    awareness: input.funnel.awareness,
    price_point_cents: input.funnel.pricePointCents,
  };
}

function buildCampaignName(
  brandName: string,
  offerIntel: OfferIntelligenceResult,
  angle: AdAngle,
): string {
  // "{Brand} — {Lead Magnet} ({angle title})" keeps names readable in ad
  // managers and stable for snapshot tests.
  const angleTitle = angle.charAt(0).toUpperCase() + angle.slice(1);
  return `${brandName} — ${offerIntel.leadMagnet.title} (${angleTitle})`;
}

function buildObjective(goalLabel: string, offerIntel: OfferIntelligenceResult): string {
  return `${goalLabel} via ${offerIntel.leadMagnet.title}; ladder to ${offerIntel.offerStack.mainCta} after the free asset lands.`;
}

function buildSecondaryAudience(offerIntel: OfferIntelligenceResult): string {
  // The secondary audience is always the "influencer/validator" — the spouse,
  // partner, ops lead, or buying-committee member who has to greenlight the
  // primary buyer's decision.
  switch (offerIntel.industryKey) {
    case "solar":
      return "Co-decision-making spouse or partner reviewing the savings plan before any consult.";
    case "med_spa":
      return "Friend or partner researching safety and provider credentials on behalf of the primary buyer.";
    case "dental":
      return "Parent or spouse coordinating insurance verification and appointment timing.";
    case "insurance":
      return "Household partner who shares renewal calendar and bundling decisions.";
    case "real_estate":
      return "Spouse or adult child involved in the listing timeline and pricing call.";
    case "saas":
      return "Buying-committee member (security, finance, or ops) needing the ROI doc and integration proof.";
    case "local_services":
    default:
      return "Household co-decision-maker reviewing reviews, scope, and quote-prep details.";
  }
}

function pickPainPoint(offerIntel: OfferIntelligenceResult): string {
  // The pain point is the first objection handler — it's the clearest verbatim
  // friction we have evidence for in the KB pack.
  return (
    offerIntel.offerStack.objectionHandlers[0] ??
    offerIntel.offerStack.corePromise
  );
}

function pickCreativeAngle(
  input: RunLaunchStrategyInput,
  offerIntel: OfferIntelligenceResult,
): AdAngle {
  const awareness = input.funnel.awareness ?? "cold";
  const industry = offerIntel.industryKey;

  // Hot traffic gets ROI/Proof (rational close). Warm traffic gets Proof.
  // Cold traffic uses Pain for high-emotion verticals and Convenience for
  // low-friction free-asset verticals.
  if (awareness === "hot") {
    return industry === "saas" ? AdAngle.Roi : AdAngle.Proof;
  }
  if (awareness === "warm") return AdAngle.Proof;

  // Cold:
  switch (industry) {
    case "solar":
    case "insurance":
      return AdAngle.Pain;
    case "med_spa":
      return AdAngle.Trust;
    case "dental":
      return AdAngle.Convenience;
    case "real_estate":
      return AdAngle.Proof;
    case "saas":
      return AdAngle.Roi;
    case "local_services":
    default:
      return AdAngle.Convenience;
  }
}

function angleRationale(angle: AdAngle, offerIntel: OfferIntelligenceResult): string {
  switch (angle) {
    case AdAngle.Pain:
      return `Lead with the named pain ("${(offerIntel.offerStack.objectionHandlers[0] ?? "rising costs").split(":")[0]}") because cold ${offerIntel.industryLabel} buyers respond to acute, specific friction.`;
    case AdAngle.Roi:
      return `Quantify the upside up-front — the ${offerIntel.industryLabel} buyer expects a number before they will engage.`;
    case AdAngle.Speed:
      return `Anchor on time-to-value of "${offerIntel.leadMagnet.title}" — the legacy workflow takes hours.`;
    case AdAngle.Proof:
      return `Lead with proof assets (${offerIntel.offerStack.proofAssets.slice(0, 2).join(", ")}) — warm/hot traffic needs validation, not novelty.`;
    case AdAngle.Comparison:
      return `Frame against the legacy ${offerIntel.industryLabel} approach so the asymmetry speaks for itself.`;
    case AdAngle.Fear:
      return `Surface a specific, time-bound loss the buyer can avoid by acting now.`;
    case AdAngle.Convenience:
      return `Lead with absence of friction — paste, click, done — because the lead magnet ("${offerIntel.leadMagnet.title}") rewards low-effort engagement.`;
    case AdAngle.Trust:
      return `Lead with safety + authority — ${offerIntel.industryLabel} buyers must feel safe before they will share personal data.`;
  }
}

function seedPlatforms(
  input: RunLaunchStrategyInput,
  offerIntel: OfferIntelligenceResult,
): RecommendedPlatformSeed[] {
  // Light seed — the platform-rec agent computes the full fit score later.
  // This list anchors the cockpit's first render so the user sees a starter
  // mix even before the recommendation agent runs.
  switch (offerIntel.industryKey) {
    case "solar":
    case "insurance":
      return [
        { platform: Platform.Meta, rationale: "Wide reach to homeowner persona with detailed targeting." },
        { platform: Platform.Google, rationale: "Capture high-intent search around bills, quotes, and incentives." },
        { platform: Platform.YouTube, rationale: "Long-form education for skeptical buyers." },
      ];
    case "med_spa":
    case "dental":
    case "real_estate":
    case "local_services":
      return [
        { platform: Platform.Meta, rationale: "Local lookalikes and detailed-targeting for consumer verticals." },
        { platform: Platform.Google, rationale: "Local-intent search and Maps placements." },
        { platform: Platform.TikTok, rationale: "Short-form UGC drives discovery in consumer service verticals." },
      ];
    case "saas":
      return [
        { platform: Platform.LinkedIn, rationale: "Job-title + industry + seniority targeting for B2B accounts." },
        { platform: Platform.Google, rationale: "Bottom-funnel intent on competitor + category keywords." },
        { platform: Platform.Meta, rationale: "Retarget the buying committee with proof-led content." },
      ];
    default:
      return [
        { platform: Platform.Meta, rationale: "Broad reach with detailed targeting." },
        { platform: Platform.Google, rationale: "Intent capture on category searches." },
      ];
  }
}

function buildRationale(
  input: RunLaunchStrategyInput,
  offerIntel: OfferIntelligenceResult,
  angle: AdAngle,
  platforms: RecommendedPlatformSeed[],
): string {
  return [
    `${offerIntel.industryLabel} (${offerIntel.kbVersion}) buyers respond best to ${angle} when awareness is ${input.funnel.awareness ?? "cold"}.`,
    `Anchor the funnel on "${offerIntel.leadMagnet.title}" before asking for ${offerIntel.offerStack.mainCta}.`,
    `Starter platforms: ${platforms.map((p) => p.platform).join(" + ")}.`,
  ].join(" ");
}
