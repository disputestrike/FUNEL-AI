import { describe, expect, it } from "vitest";

import {
  MYFUNNELA_APP_URL,
  buildOfferCrosswalk,
  buildOfferIntelligence,
} from "../src/offer-intelligence.js";
import { funnelService, generate, runInlineEdit } from "../src/index.js";

describe("offer intelligence fusion", () => {
  it("selects an industry-specific free asset before the ask", () => {
    const result = buildOfferIntelligence({
      industry: "Med spa",
      geography: "US",
      target_customer: "Dallas aesthetic prospects",
      offer: "Find the right treatment path before booking a consult.",
    });

    expect(result.industryKey).toBe("med_spa");
    expect(result.leadMagnet.title).toBe("Treatment Match Quiz");
    expect(result.leadMagnet.format).toBe("quiz");
    expect(result.offerStack.freeValue).toBe(result.leadMagnet.title);
    expect(result.offerStack.mainCta).toBe("Take the treatment quiz");
    expect(result.qualityGates.every((gate) => gate.pass)).toBe(true);
  });

  it("stages upsells, creative assets, and all addendum evidence", () => {
    const result = buildOfferIntelligence({
      industry: "Solar installation",
      geography: "US",
      target_customer: "Homeowners with $175+ power bills",
      offer: "Cut wasted power spend with source-backed savings ranges.",
    });
    const areas = result.evidence.map((item) => item.area);

    expect(result.leadMagnet.title).toBe("Free Solar Savings Plan");
    expect(result.upsellLadder).toHaveLength(4);
    expect(result.upsellLadder.some((step) => step.stage === "one_click_upsell")).toBe(true);
    expect(result.creativeAssets.every((asset) => asset.license.length > 0)).toBe(true);
    expect(areas).toEqual(
      expect.arrayContaining([
        "Customer success activation",
        "Unit economics",
        "Competitive intelligence",
        "Crisis response",
        "Agency enablement",
        "International operations",
        "Data provenance and governance",
        "Key person risk",
        "Free value before ask",
        "Upsell staging",
        "Image and asset generation",
        "Credential-ready integrations",
        "No-lift launch path",
      ]),
    );
  });

  it("exports the crosswalk evidence independently for proof screens", () => {
    const crosswalk = buildOfferCrosswalk({ industry: "B2B SaaS", geography: "US" });

    expect(crosswalk.some((item) => item.area === "Free value before ask")).toBe(true);
    expect(crosswalk.some((item) => item.area === "Upsell staging")).toBe(true);
    expect(crosswalk.some((item) => item.area === "Credential-ready integrations")).toBe(true);
  });

  it("generates a real backend funnel payload with lead magnet, assets, and evidence", async () => {
    const result = await generate({
      generationId: "gen_test_001",
      workspaceId: "ws_test",
      vertical: "Insurance",
      prompt: "Build a policy review funnel that gives value before quoting.",
      kbPackIds: ["insurance-us-v1.3"],
      parentGenerationId: null,
    });
    const funnel = result.funnel;

    expect(result.quality_score).toBeGreaterThanOrEqual(80);
    expect(result.agent_breakdown.map((agent) => agent.agent_id)).toContain("offer_intelligence");
    expect(funnel.schema_version).toBe("myfunnela.offer-intelligence.v1");
    expect(funnel.url).toContain(MYFUNNELA_APP_URL);
    expect(funnel.lead_magnet).toMatchObject({ title: "Free Coverage Gap Check" });
    expect(Array.isArray(funnel.upsell_ladder)).toBe(true);
    expect(Array.isArray(funnel.creative_assets)).toBe(true);
    expect(Array.isArray(funnel.evidence)).toBe(true);
  });

  it("supports the public funnel service proof path", async () => {
    const created = await funnelService.create({
      workspaceId: "ws_service",
      name: "ProofWorks Solar",
      vertical: "Solar",
      goal: "Book qualified consultations",
      brief: "Give a savings plan first, then book a consult.",
    });
    const published = await funnelService.publish({ workspaceId: "ws_service", id: created.id });
    const page = await funnelService.list({ workspaceId: "ws_service", limit: 10 });

    expect(created.schema_json?.lead_magnet).toMatchObject({ title: "Free Solar Savings Plan" });
    expect(published.status).toBe("published");
    expect(published.published_url).toContain(MYFUNNELA_APP_URL);
    expect(page.items.some((item) => item.id === created.id)).toBe(true);
  });

  it("runs inline edits without provider credentials", async () => {
    const result = await runInlineEdit({
      workspaceId: "ws_edit",
      funnelId: "fun_edit",
      versionId: "ver_edit",
      sectionId: "hero",
      currentText: "Start now with a free plan and review the proof before you decide.",
      edit: { op: "softer" },
    });

    expect(result.section_id).toBe("hero");
    expect(result.patch.copy.text).toContain("when you are ready");
    expect(result.tokens.input).toBeGreaterThan(0);
  });
});
