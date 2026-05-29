/**
 * Image agent — pipeline tests.
 *
 * Covers:
 *   - Tier guardrail (free → stock only; starter → 5 AI then stock)
 *   - Brand palette hex injection
 *   - NSFW retry → fallback to stock
 *   - R2 CDN URL surfaced in the final output
 *   - License + attribution propagation
 */
import { describe, expect, it, vi } from "vitest";
import { createImageAgent } from "../src/agents/image.js";
import { ImageClient } from "../src/llm/image-client.js";
import type {
  AgentContext,
  BrandTokensOutput,
  ImageInput,
  PageOutput,
  Tier,
} from "../src/types.js";

const PAGE: PageOutput = {
  sections: [
    { type: "hero", body: "Hero copy long enough." },
    { type: "proof", body: "Proof copy long enough." },
  ],
  metaTitle: "Solar funnel",
  metaDescription: "We install solar panels for suburban homeowners across California.",
  schemaOrg: {},
};

const BRAND: BrandTokensOutput = {
  palette: {
    primary: "#1E40AF",
    secondary: "#F97316",
    accent: "#10B981",
    bg: "#FFFFFF",
    fg: "#0F172A",
  },
  typography: { headingFont: "Inter", bodyFont: "Inter", scale: [12, 14, 16, 18, 24, 32] },
  voice: { register: "authoritative", bannedWords: [], signaturePhrases: [] },
  imagery: {
    mood: "optimistic, warm",
    lighting: "golden hour, natural",
    subjectGuidance: "real homeowners, real roofs, no posed handshakes",
  },
};

function makeCtx(tier: Tier, overrides: Partial<AgentContext> = {}): AgentContext {
  const calls: Array<unknown> = [];
  const ctx: AgentContext = {
    generationId: "gen_test_123",
    workspaceId: "ws_1",
    userId: "u_1",
    language: "en-US",
    geography: "US",
    tier,
    industry: "solar",
    voicePersona: "coach",
    businessProfile: {
      workspaceId: "ws_1",
      businessName: "SunCo",
      industry: "solar",
      geography: { country: "US" },
      language: "en-US",
      offer: { description: "Solar panel installation for suburban homes." },
      targetCustomer: { description: "Suburban homeowners with high power bills.", painPoints: [] },
      proof: { testimonials: [], caseStudies: [], statistics: [], certifications: [] },
      brand: { fonts: [], voiceSamples: [], brandValues: [] },
      contact: {},
      regulated: false,
    },
    plan: null,
    brandTokens: BRAND,
    kb: { retrieve: async () => [] },
    cache: {
      key: () => "k",
      markEphemeral: (c) => ({ content: c, cache_control: { type: "ephemeral" } as const }),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    clock: { now: () => new Date("2026-05-29T12:00:00Z") },
    abortSignal: new AbortController().signal,
    recordCost: vi.fn(async (_n, c) => {
      calls.push(...c);
      return { status: "ok", recommendation: "continue", remainingCents: 1000, spentCents: 0, capCents: 1000 };
    }),
    ...overrides,
  };
  return ctx;
}

function input(slotCount: number): ImageInput {
  return {
    page: PAGE,
    brandTokens: BRAND,
    slots: Array.from({ length: slotCount }, (_, i) => ({
      slotId: i === 0 ? "hero" : `section.proof.${i - 1}`,
      sceneDescription: `Solar panels on suburban roof, scene ${i}`,
    })),
  };
}

describe("image agent — tier guardrails", () => {
  it("free tier uses stock only (zero AI cost)", async () => {
    const stockSearch = vi.fn(async () => ({
      url: "https://images.unsplash.com/photo-real",
      thumbUrl: "https://images.unsplash.com/photo-real-thumb",
      source: "unsplash" as const,
      license: "unsplash_license_v1",
      attribution: {
        photographer: "Test Photographer",
        photographerUrl: "https://unsplash.com/@test",
        sourceUrl: "https://unsplash.com/photo/abc",
        htmlCredit: "Photo by Test on Unsplash",
      },
    }));
    const client = new ImageClient({
      stockAdapter: { hasAnyKey: () => true, search: stockSearch, trackDownload: vi.fn() },
    });
    const agent = createImageAgent({ images: client });
    const ctx = makeCtx("free");

    const events = [];
    for await (const ev of agent.run(input(3), ctx)) events.push(ev);

    const finalEv = events.find((e) => e.type === "final");
    expect(finalEv).toBeDefined();
    expect(stockSearch).toHaveBeenCalledTimes(3);
    if (finalEv && finalEv.type === "final") {
      expect(finalEv.output.images).toHaveLength(3);
      expect(finalEv.output.images.every((i) => i.licenseType === "stock_unsplash")).toBe(true);
      expect(finalEv.cost.totalCents).toBe(0);
    }
  });

  it("starter tier uses AI for first 5 then falls back to stock", async () => {
    const replicateRun = vi.fn(async ({ model }: { model: string }) => ({
      url: `https://replicate.delivery/output-${model}.webp`,
      model,
      costCents: 4,
      predictionId: "p_x",
    }));
    const stockSearch = vi.fn(async () => ({
      url: "https://images.unsplash.com/photo-stock",
      thumbUrl: "https://images.unsplash.com/photo-stock-thumb",
      source: "unsplash" as const,
      license: "unsplash_license_v1",
      attribution: {
        photographer: "X",
        sourceUrl: "https://unsplash.com/p",
        htmlCredit: "Photo by X on Unsplash",
      },
    }));
    const client = new ImageClient({
      replicateAdapter: {
        hasToken: () => true,
        run: replicateRun,
        classifyNSFW: vi.fn(async () => ({ passed: true, nsfwScore: 0.01, classifier: "test" })),
      },
      stockAdapter: { hasAnyKey: () => true, search: stockSearch, trackDownload: vi.fn() },
    });
    const agent = createImageAgent({ images: client });
    const ctx = makeCtx("starter");

    const events = [];
    for await (const ev of agent.run(input(7), ctx)) events.push(ev);

    expect(replicateRun).toHaveBeenCalledTimes(5);
    expect(stockSearch).toHaveBeenCalledTimes(2);
  });
});

describe("image agent — brand palette enforcement", () => {
  it("injects hex codes into the Flux prompt", async () => {
    let capturedPrompt = "";
    const replicateRun = vi.fn(async (req: { model: string; prompt: string }) => {
      capturedPrompt = req.prompt;
      return {
        url: "https://replicate.delivery/x.webp",
        model: req.model,
        costCents: 4,
        predictionId: "p",
      };
    });
    const client = new ImageClient({
      replicateAdapter: {
        hasToken: () => true,
        run: replicateRun,
        classifyNSFW: vi.fn(async () => ({ passed: true, nsfwScore: 0, classifier: "test" })),
      },
    });
    const agent = createImageAgent({ images: client });
    const ctx = makeCtx("growth");

    const events = [];
    for await (const ev of agent.run(input(1), ctx)) events.push(ev);

    expect(capturedPrompt).toContain("#1E40AF");
    expect(capturedPrompt).toContain("#F97316");
    expect(capturedPrompt).toContain("#10B981");
    expect(capturedPrompt).toContain("editorial documentary photography");
  });
});

describe("image agent — NSFW pipeline", () => {
  it("on NSFW flag, retries with sanitized prompt then succeeds", async () => {
    let callIdx = 0;
    const replicateRun = vi.fn(async () => ({
      url: `https://replicate.delivery/img-${++callIdx}.webp`,
      model: "flux-1.1-pro",
      costCents: 4,
      predictionId: `p${callIdx}`,
    }));
    const classifyNSFW = vi
      .fn()
      .mockResolvedValueOnce({ passed: false, nsfwScore: 0.8, classifier: "test" })
      .mockResolvedValueOnce({ passed: true, nsfwScore: 0.05, classifier: "test" });

    const client = new ImageClient({
      replicateAdapter: { hasToken: () => true, run: replicateRun, classifyNSFW },
    });
    const agent = createImageAgent({ images: client });
    const ctx = makeCtx("growth");

    const events = [];
    for await (const ev of agent.run(input(1), ctx)) events.push(ev);

    // Should have called Flux twice (first NSFW, second clean).
    expect(replicateRun).toHaveBeenCalledTimes(2);
    expect(classifyNSFW).toHaveBeenCalledTimes(2);
    const finalEv = events.find((e) => e.type === "final");
    if (finalEv && finalEv.type === "final") {
      expect(finalEv.output.images[0]?.safetyChecks.passed).toBe(true);
    }
  });
});

describe("image agent — R2 CDN URL", () => {
  it("returns the cdn.gofunnelai.com URL when R2 upload succeeds", async () => {
    const uploadFromUrl = vi.fn(async ({ funnelId }: { funnelId: string }) => ({
      cdnUrl: `https://cdn.gofunnelai.com/funnels/${funnelId}/abc.webp`,
      key: `funnels/${funnelId}/abc.webp`,
    }));
    const client = new ImageClient({
      replicateAdapter: {
        hasToken: () => true,
        run: vi.fn(async () => ({
          url: "https://replicate.delivery/temp.webp",
          model: "flux-1.1-pro",
          costCents: 4,
          predictionId: "p",
        })),
        classifyNSFW: vi.fn(async () => ({ passed: true, nsfwScore: 0, classifier: "test" })),
      },
      r2Adapter: { hasCredentials: () => true, uploadFromUrl },
    });
    const agent = createImageAgent({ images: client });
    const ctx = makeCtx("growth");

    const events = [];
    for await (const ev of agent.run(input(1), ctx)) events.push(ev);

    expect(uploadFromUrl).toHaveBeenCalledOnce();
    const finalEv = events.find((e) => e.type === "final");
    if (finalEv && finalEv.type === "final") {
      expect(finalEv.output.images[0]?.url).toMatch(/^https:\/\/cdn\.gofunnelai\.com\/funnels\/gen_test_123\//);
    }
  });
});
