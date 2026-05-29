/**
 * GoFunnelAI — Launch Center: Image Creative agent (Level 2).
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 *
 * Responsibilities
 * ----------------
 * Given a campaign brief + brand tokens, fan out 5 image *concepts* per
 * platform size and route each one through the existing `@funnel/agents`
 * image client (Flux 1.1 Pro -> Ideogram v2 -> SDXL -> licensed stock). The
 * image client owns provider selection, NSFW classification, and R2 upload —
 * this module does NOT reimplement any of that. It is the strategic layer:
 *
 *   - Generate concept variants (hook angle, audience cut, proof angle, …)
 *   - Add platform-specific format dims + headline-overlay instructions
 *     (Ideogram is preferred for text-in-image; Flux for hero photography)
 *   - Score each result on brand-fit + visual quality + compliance
 *   - Surface a sortable `CreativeAsset[]` the Launch UI can pick from
 *
 * Platform format coverage (per concept)
 * --------------------------------------
 *   1080x1080  square (IG feed, generic ad library)
 *   1080x1350  portrait (Meta feed dense)
 *   1080x1920  story / reel (IG / TikTok / FB stories)
 *   1200x628   link ad (Meta link cards, X)
 *   1200x627   LinkedIn sponsored content
 *
 * Five concepts x five formats = up to 25 asset rows per campaign, but the
 * caller can throttle via `options.maxAssets` (defaults to no cap; the budget
 * middleware further upstream is the real ceiling).
 *
 * Scoring
 * -------
 * Three scalar scores in [0,1] are computed per asset:
 *   - brandScore       : palette adherence (LAB delta-E against brand colors,
 *                        approximated cheaply against hex codes for now since
 *                        we don't pull pixels back from R2 in-process)
 *   - qualityScore     : resolution adequacy + composition heuristics
 *                        (aspect-ratio match, model trust ranking, license)
 *   - complianceFlags  : aggregated from the image client's NSFW classifier
 *                        plus prompt-level red flags surfaced by composePrompt
 *
 * The image client surface is referenced via a structural type so this module
 * has no compile-time dependency on `@funnel/agents` (preserves the existing
 * orchestrator/agents decoupling).
 */

import { emitLaunch } from "./events.js";

/* ---------------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------------ */

export type Industry =
  | "solar"
  | "hvac"
  | "real_estate"
  | "coaching"
  | "fitness"
  | "med_spa"
  | "cosmetic_surgery"
  | "dental"
  | "chiropractic"
  | "insurance"
  | "mortgage"
  | "financial_advisor"
  | "legal"
  | "saas"
  | "ecommerce"
  | "agency"
  | "education"
  | "home_services"
  | "supplements"
  | "info_products"
  | "other";

export interface CampaignBrief {
  campaignId: string;
  workspaceId?: string;
  /** Funnel id used as the R2 key prefix when uploading. */
  funnelId?: string;
  industry?: Industry | string;
  /** Plain-language description of the offer, audience, mechanism. */
  offer: string;
  /** Single sentence describing who the ad targets. */
  audience: string;
  /** Up to ~6 short headlines to overlay on-image (Ideogram path). */
  headlines: string[];
  /** Up to 3 CTAs. The first is used for the hero concept. */
  ctas?: string[];
  /** Free-form scene/visual direction from the user or upstream Creative Brief. */
  visualDirection?: string;
  /** Optional seed for reproducible runs (passed through to the image client). */
  seed?: number;
}

export interface BrandTokens {
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    bg?: string;
    fg?: string;
  };
  imagery: {
    mood: string;
    lighting: string;
    subjectGuidance: string;
  };
  voice?: {
    register?: "formal" | "casual" | "authoritative" | "playful";
    signaturePhrases?: string[];
  };
}

/** The five platform formats the Launch Center ships at L2. */
export type PlatformFormatId =
  | "ig_square_1080x1080"
  | "meta_portrait_1080x1350"
  | "story_reel_1080x1920"
  | "link_ad_1200x628"
  | "linkedin_1200x627";

export interface PlatformFormat {
  id: PlatformFormatId;
  /** Human label. */
  label: string;
  widthPx: number;
  heightPx: number;
  /** Aspect ratio string the image client understands. */
  aspectRatio: string;
  /** Channels where this format ships natively. */
  channels: ("instagram" | "facebook" | "tiktok" | "linkedin" | "x" | "google")[];
}

export const PLATFORM_FORMATS: readonly PlatformFormat[] = Object.freeze([
  {
    id: "ig_square_1080x1080",
    label: "Instagram square",
    widthPx: 1080,
    heightPx: 1080,
    aspectRatio: "1:1",
    channels: ["instagram", "facebook"],
  },
  {
    id: "meta_portrait_1080x1350",
    label: "Meta feed portrait",
    widthPx: 1080,
    heightPx: 1350,
    aspectRatio: "4:5",
    channels: ["instagram", "facebook"],
  },
  {
    id: "story_reel_1080x1920",
    label: "Story / Reel",
    widthPx: 1080,
    heightPx: 1920,
    aspectRatio: "9:16",
    channels: ["instagram", "facebook", "tiktok"],
  },
  {
    id: "link_ad_1200x628",
    label: "Link ad",
    widthPx: 1200,
    heightPx: 628,
    aspectRatio: "1.91:1",
    channels: ["facebook", "x", "google"],
  },
  {
    id: "linkedin_1200x627",
    label: "LinkedIn sponsored",
    widthPx: 1200,
    heightPx: 627,
    aspectRatio: "1.91:1",
    channels: ["linkedin"],
  },
]);

/** The strategic angle of an image concept. */
export type ConceptAngle =
  | "hero_offer"
  | "transformation_result"
  | "social_proof"
  | "founder_authenticity"
  | "scarcity_urgency";

/** Strategic concept (independent of platform format). */
export interface ImageConcept {
  conceptId: string;
  angle: ConceptAngle;
  /** Short headline for the on-image overlay (Ideogram). */
  headline: string;
  /** CTA button label rendered into the image. */
  cta: string;
  /** Description of the scene (subject, framing, action). */
  sceneDescription: string;
  /** Prefer Ideogram (better text rendering) when this concept needs in-image type. */
  preferTextInImage: boolean;
}

export interface CreativeAsset {
  /** Stable id (`<campaignId>_<conceptId>_<formatId>`). */
  assetId: string;
  campaignId: string;
  conceptId: string;
  angle: ConceptAngle;
  format: PlatformFormat;
  /** Final CDN URL (R2-hosted if available, else provider URL). */
  url: string;
  thumbUrl?: string;
  /** Resolved model id (e.g. "flux-1.1-pro" / "ideogram-v2" / "unsplash-stock"). */
  modelUsed: string;
  promptUsed: string;
  /** Headline copy baked into the image (Ideogram) or intended for overlay (Flux). */
  headlineOverlay: string;
  cta: string;
  altText: string;
  licenseType: "generated" | "stock_unsplash" | "stock_pexels" | "customer_owned";
  hostedOnR2: boolean;
  r2Key?: string;
  /** Stock attribution (when sourced from Unsplash/Pexels). */
  attribution?: {
    photographer: string;
    photographerUrl?: string;
    sourceUrl: string;
    htmlCredit: string;
  };
  /** Brand-palette adherence score in [0,1]. */
  brandScore: number;
  /** Resolution + composition score in [0,1]. */
  qualityScore: number;
  /** Strings the trust/safety reviewer should flag (NSFW, banned-claim, ...). */
  complianceFlags: string[];
  /** Set when the image client surfaced an NSFW score. */
  nsfwScore?: number;
  /** Per-asset gen cost in cents (from the image client meter). */
  costCents: number;
}

/* ---------------------------------------------------------------------------
 * Image client surface (structural — kept here so this module has no
 * compile-time dep on @funnel/agents).
 *
 * This shape MUST stay in sync with packages/agents/src/llm/image-client.ts.
 * ------------------------------------------------------------------------ */

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  slotId: string;
  funnelId?: string;
  industry?: string;
  paletteHex?: string[];
  stockConceptQuery?: string;
  forceChain?: ("flux-1.1-pro" | "ideogram-v2" | "sdxl" | "stock")[];
  seed?: number;
  abortSignal?: AbortSignal;
}

export interface ImageGenResult {
  modelUsed: string;
  url: string;
  thumbUrl?: string;
  costCents: number;
  safetyChecks: {
    passed: boolean;
    classifier: string;
    flags: string[];
    nsfwScore?: number;
  };
  promptUsed: string;
  licenseType: "generated" | "stock_unsplash" | "stock_pexels" | "customer_owned";
  attribution?: {
    photographer: string;
    photographerUrl?: string;
    sourceUrl: string;
    htmlCredit: string;
  };
  hostedOnR2: boolean;
  r2Key?: string;
}

/** Minimum surface this module needs from `ImageClient`. */
export interface ImageGenClientLike {
  generate(params: ImageGenParams): Promise<ImageGenResult>;
}

export interface RunImageCreativeOptions {
  /** Image client (typically a `@funnel/agents` ImageClient). REQUIRED. */
  client: ImageGenClientLike;
  /** Restrict to a subset of platform formats (defaults to all five). */
  formats?: readonly PlatformFormat[];
  /** Cap the asset count (concepts x formats). 0 / undefined = no cap. */
  maxAssets?: number;
  /** Override the concept-angle plan; defaults to the standard 5-angle ladder. */
  concepts?: ImageConcept[];
  abortSignal?: AbortSignal;
  /** Inject a clock for deterministic tests. */
  now?: () => Date;
}

/* ---------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

/**
 * Run the Launch Center Image Creative agent for one campaign.
 *
 * Generates 5 concepts (or the caller's override) across 5 platform formats,
 * sequentially to respect the upstream image client's provider rate limits.
 * Failures on individual slots are swallowed and recorded as a missing asset;
 * the caller decides whether the resulting count is acceptable.
 */
export async function runImageCreative(
  brief: CampaignBrief,
  brandTokens: BrandTokens,
  options: RunImageCreativeOptions,
): Promise<CreativeAsset[]> {
  if (!brief.campaignId) throw new Error("runImageCreative: brief.campaignId required");
  if (!brief.offer || brief.offer.length < 4) {
    throw new Error("runImageCreative: brief.offer required");
  }
  if (!options?.client) throw new Error("runImageCreative: options.client required");

  const concepts = options.concepts ?? defaultConceptLadder(brief);
  const formats = options.formats ?? PLATFORM_FORMATS;
  const cap = options.maxAssets && options.maxAssets > 0 ? options.maxAssets : Infinity;
  const paletteHex = extractPaletteHex(brandTokens);
  const assets: CreativeAsset[] = [];

  await emitLaunch(
    "launch_strategy_started",
    {
      stage: "image_creative",
      conceptCount: concepts.length,
      formatCount: formats.length,
      brand: "GoFunnelAI",
    },
    { campaignId: brief.campaignId, workspaceId: brief.workspaceId ?? null },
  );

  outer: for (const concept of concepts) {
    for (const format of formats) {
      if (assets.length >= cap) break outer;
      if (options.abortSignal?.aborted) break outer;

      const prompt = composePrompt({
        brief,
        brandTokens,
        concept,
        format,
      });
      const slotId = `${brief.campaignId}_${concept.conceptId}_${format.id}`;
      const useIdeogramFirst = concept.preferTextInImage;
      const forceChain = useIdeogramFirst
        ? (["ideogram-v2", "flux-1.1-pro", "sdxl", "stock"] as const)
        : undefined;

      try {
        const result = await options.client.generate({
          prompt,
          negativePrompt: NEGATIVE_PROMPT_DEFAULTS,
          aspectRatio: format.aspectRatio,
          slotId,
          funnelId: brief.funnelId,
          industry: typeof brief.industry === "string" ? brief.industry : undefined,
          paletteHex,
          stockConceptQuery: composeConceptQuery(concept, brief.industry),
          forceChain: forceChain ? [...forceChain] : undefined,
          seed: brief.seed,
          abortSignal: options.abortSignal,
        });

        const brandScore = computeBrandScore({
          modelUsed: result.modelUsed,
          licenseType: result.licenseType,
          paletteHex,
          promptUsed: result.promptUsed,
        });
        const qualityScore = computeQualityScore({
          modelUsed: result.modelUsed,
          format,
          licenseType: result.licenseType,
        });
        const complianceFlags = collectComplianceFlags({
          safety: result.safetyChecks,
          promptUsed: result.promptUsed,
          concept,
        });

        assets.push({
          assetId: slotId,
          campaignId: brief.campaignId,
          conceptId: concept.conceptId,
          angle: concept.angle,
          format,
          url: result.url,
          thumbUrl: result.thumbUrl,
          modelUsed: result.modelUsed,
          promptUsed: result.promptUsed,
          headlineOverlay: concept.headline,
          cta: concept.cta,
          altText: deriveAltText(concept.sceneDescription),
          licenseType: result.licenseType,
          hostedOnR2: result.hostedOnR2,
          r2Key: result.r2Key,
          attribution: result.attribution,
          brandScore,
          qualityScore,
          complianceFlags,
          nsfwScore: result.safetyChecks?.nsfwScore,
          costCents: result.costCents,
        });
      } catch {
        // Single-slot failure should not abort the campaign. Skip and continue.
        continue;
      }
    }
  }

  await emitLaunch(
    "launch_strategy_completed",
    {
      stage: "image_creative",
      assetCount: assets.length,
      modelMix: tallyModelMix(assets),
      avgBrandScore: avg(assets.map((a) => a.brandScore)),
      avgQualityScore: avg(assets.map((a) => a.qualityScore)),
    },
    { campaignId: brief.campaignId, workspaceId: brief.workspaceId ?? null },
  );

  return assets;
}

/* ---------------------------------------------------------------------------
 * Concept ladder — the canonical 5-angle plan
 *
 * Calibrated against the GoFunnelAI direct-response playbook (doc 20 §4.7):
 * every campaign ships a hero + a transformation + a proof + a founder +
 * a scarcity angle so creative testing can isolate which angle wins.
 * ------------------------------------------------------------------------ */

export function defaultConceptLadder(brief: CampaignBrief): ImageConcept[] {
  const headlines = brief.headlines.length > 0 ? brief.headlines : [brief.offer];
  const ctas = brief.ctas && brief.ctas.length > 0 ? brief.ctas : ["Get started"];
  const get = <T,>(arr: T[], i: number): T => arr[Math.min(i, arr.length - 1)]!;
  const visual = brief.visualDirection?.trim();
  const industry = String(brief.industry ?? "other").toLowerCase();
  const anchor = INDUSTRY_VISUAL_ANCHORS[industry] ?? INDUSTRY_VISUAL_ANCHORS["other"]!;

  return [
    {
      conceptId: "c1_hero_offer",
      angle: "hero_offer",
      headline: get(headlines, 0),
      cta: get(ctas, 0),
      sceneDescription: visual
        ? `${anchor.hero}. ${visual}`
        : `${anchor.hero}. Audience: ${brief.audience}.`,
      preferTextInImage: false,
    },
    {
      conceptId: "c2_transformation",
      angle: "transformation_result",
      headline: get(headlines, 1),
      cta: get(ctas, 0),
      sceneDescription: `${anchor.transformation}. Outcome of: ${brief.offer}.`,
      preferTextInImage: false,
    },
    {
      conceptId: "c3_social_proof",
      angle: "social_proof",
      headline: get(headlines, 2),
      cta: get(ctas, 0),
      sceneDescription: `${anchor.proof}. Real customer of: ${brief.audience}.`,
      preferTextInImage: true,
    },
    {
      conceptId: "c4_founder",
      angle: "founder_authenticity",
      headline: get(headlines, 3),
      cta: get(ctas, 0),
      sceneDescription: `${anchor.founder}. Speaking to: ${brief.audience}.`,
      preferTextInImage: false,
    },
    {
      conceptId: "c5_scarcity",
      angle: "scarcity_urgency",
      headline: get(headlines, 4),
      cta: get(ctas, Math.min(1, ctas.length - 1)),
      sceneDescription: `${anchor.scarcity}. Offer: ${brief.offer}.`,
      preferTextInImage: true,
    },
  ];
}

interface IndustryAnchor {
  hero: string;
  transformation: string;
  proof: string;
  founder: string;
  scarcity: string;
}

const INDUSTRY_VISUAL_ANCHORS: Record<string, IndustryAnchor> = {
  solar: {
    hero: "Suburban home rooftop with installed solar panels, real family on porch at golden hour",
    transformation: "Side-by-side energy bill: before vs after panels, kitchen table with documents and laptop",
    proof: "Homeowner shaking hands with installer in front of completed array, sunlight on panels",
    founder: "Solar company founder at warehouse with panels, documentary portrait, work boots, hard hat off",
    scarcity: "Installer team loading the last truck of the quarter at dusk, schedule whiteboard partially visible",
  },
  hvac: {
    hero: "HVAC technician servicing outdoor condenser at a residential home, focused, no posed smile",
    transformation: "Thermostat upgrade montage — old dial thermostat next to a new smart unit on a living-room wall",
    proof: "Real homeowner thanking technician at front door, service van branded in background",
    founder: "HVAC shop owner at his counter, parts shelves behind, documentary lighting",
    scarcity: "Last service slot of the day, calendar visible, technician packing the van as the sun sets",
  },
  real_estate: {
    hero: "Modern home exterior with manicured landscaping, key handover moment at the front porch",
    transformation: "Couple walking through a freshly renovated kitchen they just bought, sunlight through windows",
    proof: "Agent and client signing closing documents at a clean modern desk, real expressions",
    founder: "Real-estate broker in a neighborhood she serves, candid documentary portrait",
    scarcity: "Just listed sign in front yard at golden hour with a small crowd at an open house",
  },
  coaching: {
    hero: "Coach mid-conversation across a desk with a client, real listening posture, natural office light",
    transformation: "Client journaling in a sunlit workspace, wall of progress notes behind",
    proof: "Coach and client celebrating a milestone with a quiet high-five, candid",
    founder: "Coach at her desk recording a video for her clients, documentary portrait",
    scarcity: "Calendar on screen with 2 remaining 1:1 slots highlighted, soft natural light",
  },
  fitness: {
    hero: "Real athlete training in a gym, mid-rep, sweat, no model-posing",
    transformation: "Before/after composite of a real client in their home gym, no commercial gloss",
    proof: "Trainer celebrating with a client after a personal record, real emotion",
    founder: "Gym owner restacking weights after class, documentary lighting",
    scarcity: "Whiteboard listing 'class fills at 6am' with only 3 spots left",
  },
  med_spa: {
    hero: "Clean modern aesthetic clinic, soft natural light, real client receiving a non-invasive treatment",
    transformation: "Calm client looking at a hand mirror after treatment, soft daylight, no over-retouching",
    proof: "Front-desk staff greeting a returning client by name in a clean lobby",
    founder: "Medical director in scrubs reviewing a patient chart at a modern desk",
    scarcity: "Glass cabinet of product, one box on a 'last of season' label",
  },
  cosmetic_surgery: {
    hero: "Modern surgical consultation room, warm lighting, real patient-doctor conversation",
    transformation: "Patient post-recovery looking peacefully out of a window in a soft-lit suite",
    proof: "Wall of accreditations behind a real surgeon mid-conversation with a patient",
    founder: "Surgeon documentary portrait in OR scrubs, mask off, in a clean modern corridor",
    scarcity: "Reception assistant marking a calendar with only two consult slots open this month",
  },
  dental: {
    hero: "Modern dental office, real patient smiling after care, hygienist in clean scrubs in the background",
    transformation: "Smile-design before/after composite in soft daylight, candid expression",
    proof: "Dentist showing X-ray comparison to patient on a wall-mounted screen",
    founder: "Practice owner at her front desk greeting patients by name",
    scarcity: "Wall calendar with only two openings highlighted in the next two weeks",
  },
  chiropractic: {
    hero: "Chiropractor adjusting patient on a modern table, clean wellness clinic, soft daylight",
    transformation: "Patient performing a mobility test post-treatment, smiling at the chiropractor",
    proof: "Wall of patient thank-you notes behind the front desk, real handwriting",
    founder: "Chiropractor in clinic explaining a spine model to a patient, documentary lighting",
    scarcity: "Booking screen showing this week's openings, only one Friday slot left",
  },
  insurance: {
    hero: "Advisor and family at a kitchen table reviewing documents, warm light",
    transformation: "Family looking relieved after a policy review, papers organized on the table",
    proof: "Advisor handing a printed proof-of-coverage to a homeowner at their front door",
    founder: "Independent agent in a small-office storefront, documentary portrait",
    scarcity: "Calendar showing renewal deadline this week, advisor circling a date for a client",
  },
  mortgage: {
    hero: "Couple receiving keys from agent at the front door of new home, candid moment",
    transformation: "First-time buyers moving boxes into a sunlit living room, real excitement",
    proof: "Loan officer reviewing a closing disclosure with a happy couple at a modern desk",
    founder: "Mortgage broker in his office, family photos visible, documentary portrait",
    scarcity: "Rate sheet on screen highlighted, broker on the phone explaining a rate hold",
  },
  financial_advisor: {
    hero: "Advisor and client at a modern office desk with laptop and printed charts",
    transformation: "Client smiling at a portfolio dashboard on a tablet, soft daylight",
    proof: "Advisor explaining a long-term plan to a couple, wall of credentials behind",
    founder: "Advisor documentary portrait in his office, plants and family photos visible",
    scarcity: "Client calendar showing only two open intake slots this quarter",
  },
  legal: {
    hero: "Lawyer at desk reading documents in a modern law office, no exaggerated gestures",
    transformation: "Client leaving the office shaking hands with attorney, relieved expression",
    proof: "Bookshelf of law volumes behind a real attorney mid-call with a client",
    founder: "Solo practitioner in her office, documentary portrait, plants and case files",
    scarcity: "Calendar with only two consultation slots open this week",
  },
  saas: {
    hero: "Real product UI on a laptop screen in a modern workspace, hands on keyboard, depth of field",
    transformation: "Dashboard showing metrics trending up, real workspace clutter around the laptop",
    proof: "Customer logos overlaid on a modern office wall behind a screen showing the product",
    founder: "Founder at home desk doing a customer call, documentary lighting",
    scarcity: "Pricing screen with a banner: 'Early-access seats limited', founder's hand near trackpad",
  },
  ecommerce: {
    hero: "Studio product flatlay or in-use lifestyle shot, soft directional light",
    transformation: "Customer unboxing the product at their kitchen counter, candid expression",
    proof: "Wall of 5-star review screenshots behind the product on a clean shelf",
    founder: "Founder in their fulfillment area packing orders, documentary portrait",
    scarcity: "Inventory shelf with only a few boxes left and a hand reaching for one",
  },
  agency: {
    hero: "Creative team at whiteboard mid-discussion, real collaboration energy",
    transformation: "Before/after client dashboard on a monitor, team standing around it",
    proof: "Wall of client logos behind the team standing around a project board",
    founder: "Agency founder at a standing desk on a customer call, documentary lighting",
    scarcity: "Whiteboard showing 'Q2 client roster — 1 spot left', agency lead capping a marker",
  },
  education: {
    hero: "Students engaged in classroom or workshop, natural curiosity, no posed group shots",
    transformation: "Student holding a completion certificate, real smile, classroom in background",
    proof: "Wall of student work behind an instructor mid-mentoring conversation",
    founder: "Instructor at a small whiteboard explaining a concept, documentary portrait",
    scarcity: "Roster sheet on screen with only three open seats for next cohort",
  },
  home_services: {
    hero: "Tradesperson working at a residential home, real action shot, no posed smile",
    transformation: "Homeowner inspecting a finished install, contractor packing up cleanly in background",
    proof: "Truck branded with the company at a real job site, neighbor waving in background",
    founder: "Owner-operator on a job site, documentary portrait, tools visible",
    scarcity: "Schedule on a clipboard showing one open day this week, sharpie circle",
  },
  supplements: {
    hero: "Wellness product flatlay with natural elements, soft daylight",
    transformation: "Customer in real kitchen taking the product as part of a morning routine",
    proof: "Real review screenshots layered next to the product on a clean countertop",
    founder: "Founder in a small lab or kitchen formulating, documentary lighting",
    scarcity: "Shelf with limited inventory, a sold-out tag next to one variant",
  },
  info_products: {
    hero: "Creator at home desk with camera and ring light, real workspace clutter",
    transformation: "Customer journaling alongside a printed worksheet from the course",
    proof: "Wall of student success screenshots behind the creator mid-recording",
    founder: "Creator setting up the next module, documentary portrait, microphone visible",
    scarcity: "Countdown on screen for cohort close, creator's hand reaching for a notebook",
  },
  other: {
    hero: "Real business owner working in their environment, documentary photography, natural light",
    transformation: "Customer using the product in real life, candid expression",
    proof: "Wall of customer testimonials behind a real working environment",
    founder: "Founder portrait at her place of business, documentary lighting",
    scarcity: "Schedule or inventory tool showing limited remaining availability",
  },
};

/* ---------------------------------------------------------------------------
 * Prompt composition
 * ------------------------------------------------------------------------ */

const STYLE_DIRECTION = [
  "editorial documentary photography",
  "natural lighting, real-world setting",
  "candid composition, depth of field",
  "shot on full-frame mirrorless, 35mm or 50mm prime",
  "real-feeling humans, no model poses, no fake handshakes",
  "no stock-photo cliches, no businesspeople pointing at charts",
];

export const NEGATIVE_PROMPT_DEFAULTS =
  "watermark, logos of real brands, identifiable real public figures, blurry, distorted hands, low quality, jpeg artifacts, cartoon, anime, illustration unless specified, fake handshake, generic businesspeople, stock photo cliche";

interface ComposePromptArgs {
  brief: CampaignBrief;
  brandTokens: BrandTokens;
  concept: ImageConcept;
  format: PlatformFormat;
}

export function composePrompt(args: ComposePromptArgs): string {
  const { brief, brandTokens, concept, format } = args;
  const palette = brandTokens.palette;
  const paletteLine = [
    `primary ${palette.primary}`,
    `secondary ${palette.secondary}`,
    `accent ${palette.accent}`,
  ].join(", ");

  const parts: string[] = [];
  parts.push(concept.sceneDescription);
  parts.push(
    `format: ${format.label} ${format.widthPx}x${format.heightPx} (${format.aspectRatio})`,
  );
  if (concept.preferTextInImage) {
    // Ideogram path — instruct the model to render the headline + CTA.
    parts.push(
      `bold readable text overlay reading exactly: "${concept.headline}"`,
      `CTA button reading exactly: "${concept.cta}"`,
      "typography: clean sans-serif, high contrast, safe-margin away from edges",
    );
  } else {
    parts.push(
      `leave breathing room in the upper third for an overlay headline: "${concept.headline}"`,
      "no embedded text in the image itself",
    );
  }
  parts.push(`color palette: ${paletteLine}, neutral whites, soft greys`);
  parts.push(`mood: ${brandTokens.imagery.mood}`);
  parts.push(`lighting: ${brandTokens.imagery.lighting}`);
  parts.push(`subject guidance: ${brandTokens.imagery.subjectGuidance}`);
  parts.push(`audience: ${brief.audience}`);
  if (brief.industry) parts.push(`industry: ${brief.industry}`);
  parts.push(...STYLE_DIRECTION);
  parts.push("no logos of real brands, no identifiable real public figures");
  return parts.join(". ");
}

function composeConceptQuery(concept: ImageConcept, industry?: string): string {
  const head = concept.sceneDescription.split(",")[0]!.trim();
  return industry ? `${industry} ${head}` : head;
}

function extractPaletteHex(brand: BrandTokens): string[] {
  const p = brand.palette;
  return [p.primary, p.secondary, p.accent].filter(Boolean);
}

function deriveAltText(scene: string): string {
  return scene.length > 280 ? scene.slice(0, 277) + "..." : scene;
}

/* ---------------------------------------------------------------------------
 * Scoring
 * ------------------------------------------------------------------------ */

const BRAND_TRUSTED_MODELS: Record<string, number> = {
  "flux-1.1-pro": 0.95,
  "ideogram-v2": 0.92,
  sdxl: 0.78,
  "unsplash-stock": 0.7,
  "pexels-stock": 0.65,
};

interface BrandScoreArgs {
  modelUsed: string;
  licenseType: ImageGenResult["licenseType"];
  paletteHex: string[];
  promptUsed: string;
}

export function computeBrandScore(args: BrandScoreArgs): number {
  // We don't pull the asset back into Node memory to color-quantize it (R2 →
  // ImageMagick would burn CPU on every gen). Instead we approximate brand
  // adherence by combining:
  //   - whether the prompt carried our palette hexes (controllable signal)
  //   - the trust ranking of the model that produced the asset
  //   - a license discount for stock (stock can't be palette-controlled)
  const promptHits = args.paletteHex.filter((hex) => args.promptUsed.includes(hex)).length;
  const promptScore = args.paletteHex.length === 0 ? 0.5 : promptHits / args.paletteHex.length;
  const trust = BRAND_TRUSTED_MODELS[args.modelUsed] ?? 0.6;
  const stockPenalty =
    args.licenseType === "stock_unsplash" || args.licenseType === "stock_pexels" ? 0.18 : 0;
  return clamp01(promptScore * 0.5 + trust * 0.5 - stockPenalty);
}

interface QualityScoreArgs {
  modelUsed: string;
  format: PlatformFormat;
  licenseType: ImageGenResult["licenseType"];
}

export function computeQualityScore(args: QualityScoreArgs): number {
  // Resolution adequacy — the formats we ship are all >= 1080 on the short
  // side, which is the platform minimum. The image client emits webp at
  // provider native res; we can't measure pixels here, so we score based on
  // (a) provider trust and (b) whether the aspect-ratio is one the provider
  // handles natively (16:9, 1:1, 9:16 are best; 1.91:1 is a stretch).
  const trust = BRAND_TRUSTED_MODELS[args.modelUsed] ?? 0.6;
  const stretchPenalty = args.format.aspectRatio === "1.91:1" ? 0.08 : 0;
  const stockPenalty =
    args.licenseType === "stock_unsplash" || args.licenseType === "stock_pexels" ? 0.05 : 0;
  return clamp01(trust - stretchPenalty - stockPenalty);
}

interface ComplianceArgs {
  safety: ImageGenResult["safetyChecks"];
  promptUsed: string;
  concept: ImageConcept;
}

export function collectComplianceFlags(args: ComplianceArgs): string[] {
  const flags: string[] = [];
  if (args.safety && !args.safety.passed) flags.push("nsfw_classifier_flagged");
  if (args.safety?.classifier?.startsWith("prompt-heuristic")) {
    flags.push("prompt_red_flag");
  }
  if (args.concept.angle === "scarcity_urgency") {
    // The Trust & Safety layer downstream cares about urgency that may breach
    // FTC "false scarcity" rules. We mark it so Ad Policy can re-review the
    // overlay copy specifically; the image itself is not blocked.
    flags.push("review_scarcity_claim");
  }
  // Cheap claim-language sniff on the headline overlay — the image is what the
  // ad library scrapes, so we flag misleading words explicitly here.
  const lower = args.concept.headline.toLowerCase();
  if (/(guarantee|guaranteed|free money|cure|miracle|risk[- ]free)/.test(lower)) {
    flags.push("headline_overpromise");
  }
  return flags;
}

/* ---------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------ */

function tallyModelMix(assets: CreativeAsset[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of assets) {
    out[a.modelUsed] = (out[a.modelUsed] ?? 0) + 1;
  }
  return out;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 1000) / 1000;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 1000) / 1000;
}
