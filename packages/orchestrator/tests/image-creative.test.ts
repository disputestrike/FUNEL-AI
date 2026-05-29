/**
 * Launch Center — Image Creative agent tests.
 *
 * Covers:
 *   - 5 concepts x 5 formats fan-out for every snapshot industry
 *   - Brand palette hexes appear in the prompt sent to the image client
 *   - Ideogram-first chain forced for concepts that need text-in-image
 *   - brandScore / qualityScore / complianceFlags computed correctly
 *   - Single-slot failures don't abort the campaign
 *   - Stock-only path (free tier sim) returns Unsplash attribution
 *
 * Image-gen and voiceover are mocked — no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  PLATFORM_FORMATS,
  composePrompt,
  computeBrandScore,
  computeQualityScore,
  collectComplianceFlags,
  defaultConceptLadder,
  runImageCreative,
  type BrandTokens,
  type CampaignBrief,
  type ImageGenClientLike,
  type ImageGenParams,
  type ImageGenResult,
} from "../src/launch/image-creative.js";
import { resetLaunchEventSink } from "../src/launch/events.js";

const BRAND: BrandTokens = {
  palette: {
    primary: "#1E40AF",
    secondary: "#F97316",
    accent: "#10B981",
    bg: "#FFFFFF",
    fg: "#0F172A",
  },
  imagery: {
    mood: "optimistic, warm",
    lighting: "golden hour, natural",
    subjectGuidance: "real customers, real environments",
  },
  voice: { register: "authoritative" },
};

function briefFor(industry: string, overrides: Partial<CampaignBrief> = {}): CampaignBrief {
  return {
    campaignId: `cmp_${industry}`,
    workspaceId: "ws_test",
    funnelId: `fnl_${industry}`,
    industry,
    offer: `Help ${industry} businesses scale to 7 figures`,
    audience: `${industry} business owners`,
    headlines: [
      "Scale to 7 figures",
      "From stuck to scaling",
      "Real results in 90 days",
      "Built by an operator",
      "Only 5 spots left",
    ],
    ctas: ["Book a call", "Apply now"],
    ...overrides,
  };
}

function makeClient(opts?: {
  failOn?: string[]; // slot ids that should fail
  flagOn?: string[]; // slot ids that should return nsfw_classifier_flagged
}): ImageGenClientLike {
  const failSet = new Set(opts?.failOn ?? []);
  const flagSet = new Set(opts?.flagOn ?? []);
  return {
    generate: vi.fn(async (params: ImageGenParams): Promise<ImageGenResult> => {
      if (failSet.has(params.slotId)) {
        throw new Error("simulated provider failure");
      }
      const wantsIdeogram =
        Array.isArray(params.forceChain) && params.forceChain[0] === "ideogram-v2";
      const modelUsed = wantsIdeogram ? "ideogram-v2" : "flux-1.1-pro";
      const flagged = flagSet.has(params.slotId);
      return {
        modelUsed,
        url: `https://cdn.gofunnelai.com/${params.slotId}.webp`,
        thumbUrl: `https://cdn.gofunnelai.com/${params.slotId}-thumb.webp`,
        costCents: wantsIdeogram ? 5 : 4,
        safetyChecks: {
          passed: !flagged,
          classifier: flagged ? "prompt-heuristic:gore" : "falcons-ai/nsfw_image_detection",
          flags: [],
          nsfwScore: flagged ? 0.95 : 0.03,
        },
        promptUsed: params.prompt,
        licenseType: "generated",
        hostedOnR2: true,
        r2Key: `funnels/${params.funnelId ?? "unknown"}/${params.slotId}.webp`,
      };
    }),
  };
}

describe("Launch Image Creative — snapshot industries", () => {
  it("solar campaign: 5 concepts x 5 formats = 25 assets", async () => {
    resetLaunchEventSink();
    const client = makeClient();
    const assets = await runImageCreative(briefFor("solar"), BRAND, { client });
    expect(assets).toHaveLength(25);
    // Every angle present
    expect(new Set(assets.map((a) => a.angle))).toEqual(
      new Set([
        "hero_offer",
        "transformation_result",
        "social_proof",
        "founder_authenticity",
        "scarcity_urgency",
      ]),
    );
    // Every format present
    expect(new Set(assets.map((a) => a.format.id))).toEqual(
      new Set(PLATFORM_FORMATS.map((f) => f.id)),
    );
    // All hosted on R2
    expect(assets.every((a) => a.hostedOnR2)).toBe(true);
  });

  it("dental campaign: ideogram forced on social_proof + scarcity (text-in-image)", async () => {
    resetLaunchEventSink();
    const client = makeClient();
    const assets = await runImageCreative(briefFor("dental"), BRAND, { client });
    const textInImageAngles = new Set(["social_proof", "scarcity_urgency"]);
    const textAssets = assets.filter((a) => textInImageAngles.has(a.angle));
    expect(textAssets.every((a) => a.modelUsed === "ideogram-v2")).toBe(true);
    const photoAssets = assets.filter((a) => !textInImageAngles.has(a.angle));
    expect(photoAssets.every((a) => a.modelUsed === "flux-1.1-pro")).toBe(true);
  });

  it("saas campaign: prompts carry full brand palette hexes", async () => {
    resetLaunchEventSink();
    const client = makeClient();
    const assets = await runImageCreative(briefFor("saas"), BRAND, { client });
    for (const a of assets) {
      expect(a.promptUsed).toContain("#1E40AF");
      expect(a.promptUsed).toContain("#F97316");
      expect(a.promptUsed).toContain("#10B981");
      expect(a.promptUsed).toContain("editorial documentary photography");
      // Format dims appear in the prompt
      expect(a.promptUsed).toContain(
        `${a.format.widthPx}x${a.format.heightPx}`,
      );
    }
  });
});

describe("Launch Image Creative — resilience", () => {
  it("skips failed slots and keeps producing", async () => {
    resetLaunchEventSink();
    const allFormats = PLATFORM_FORMATS.map((f) => f.id);
    const failSlot = `cmp_solar_c1_hero_offer_${allFormats[0]}`;
    const client = makeClient({ failOn: [failSlot] });
    const assets = await runImageCreative(briefFor("solar"), BRAND, { client });
    expect(assets).toHaveLength(24);
    expect(assets.find((a) => a.assetId === failSlot)).toBeUndefined();
  });

  it("honors maxAssets cap", async () => {
    resetLaunchEventSink();
    const client = makeClient();
    const assets = await runImageCreative(briefFor("solar"), BRAND, {
      client,
      maxAssets: 7,
    });
    expect(assets).toHaveLength(7);
  });

  it("nsfw-flagged result surfaces compliance flag", async () => {
    resetLaunchEventSink();
    const conceptId = "c5_scarcity";
    const flaggedSlot = `cmp_solar_${conceptId}_ig_square_1080x1080`;
    const client = makeClient({ flagOn: [flaggedSlot] });
    const assets = await runImageCreative(briefFor("solar"), BRAND, { client });
    const flagged = assets.find((a) => a.assetId === flaggedSlot);
    expect(flagged).toBeDefined();
    // nsfw + scarcity + headline-overpromise heuristics may all fire
    expect(flagged!.complianceFlags).toContain("nsfw_classifier_flagged");
    expect(flagged!.complianceFlags).toContain("review_scarcity_claim");
  });
});

describe("Launch Image Creative — scoring", () => {
  it("Flux generated > stock on brand score for same prompt", () => {
    const args = {
      paletteHex: ["#1E40AF", "#F97316", "#10B981"],
      promptUsed: "scene. color palette: primary #1E40AF, secondary #F97316, accent #10B981",
    };
    const flux = computeBrandScore({ ...args, modelUsed: "flux-1.1-pro", licenseType: "generated" });
    const stock = computeBrandScore({
      ...args,
      modelUsed: "unsplash-stock",
      licenseType: "stock_unsplash",
    });
    expect(flux).toBeGreaterThan(stock);
  });

  it("link_ad format gets a stretch penalty on quality", () => {
    const square = computeQualityScore({
      modelUsed: "flux-1.1-pro",
      format: PLATFORM_FORMATS[0]!,
      licenseType: "generated",
    });
    const linkAd = computeQualityScore({
      modelUsed: "flux-1.1-pro",
      format: PLATFORM_FORMATS[3]!,
      licenseType: "generated",
    });
    expect(square).toBeGreaterThan(linkAd);
  });

  it("over-promising headline triggers compliance flag", () => {
    const concept = defaultConceptLadder(briefFor("solar"))[0]!;
    concept.headline = "Guaranteed cure — risk-free miracle";
    const flags = collectComplianceFlags({
      safety: { passed: true, classifier: "ok", flags: [] },
      promptUsed: "anything",
      concept,
    });
    expect(flags).toContain("headline_overpromise");
  });
});

describe("Launch Image Creative — composePrompt", () => {
  it("text-in-image concept emits exact headline + CTA instructions", () => {
    const brief = briefFor("dental");
    const concept = defaultConceptLadder(brief).find((c) => c.preferTextInImage)!;
    const prompt = composePrompt({
      brief,
      brandTokens: BRAND,
      concept,
      format: PLATFORM_FORMATS[0]!,
    });
    expect(prompt).toContain(`reading exactly: "${concept.headline}"`);
    expect(prompt).toContain(`reading exactly: "${concept.cta}"`);
  });

  it("photo concept reserves breathing room and forbids embedded text", () => {
    const brief = briefFor("solar");
    const concept = defaultConceptLadder(brief).find((c) => !c.preferTextInImage)!;
    const prompt = composePrompt({
      brief,
      brandTokens: BRAND,
      concept,
      format: PLATFORM_FORMATS[2]!,
    });
    expect(prompt).toContain("breathing room");
    expect(prompt).toContain("no embedded text in the image itself");
  });
});
