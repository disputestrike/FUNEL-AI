import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const compliance = { reviewCreative: vi.fn() };
const adapter = { validateCreative: vi.fn(), publishCampaign: vi.fn() };
const integrations = { getAdAdapter: vi.fn().mockResolvedValue(adapter) };

vi.mock("@funnel/compliance", () => compliance);
vi.mock("@funnel/integrations", () => integrations);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("ad-publishing worker", () => {
  const baseData = {
    workspace_id: "wsp_01HX",
    campaign_id: "cmp_01HX",
    platform: "meta" as const,
    ad_account_id: "act_1",
    creatives: [
      { creative_id: "cr_1", headline: "Get solar", body: "now", cta: "Sign up", media_url: "https://x/y.jpg" },
    ],
    budget_cents: 100_000,
    daily_cap_cents: 5_000,
    targeting: { geo: ["US"] },
    flight_start: "2026-06-01",
    flight_end: "2026-06-30",
  };

  beforeEach(() => {
    compliance.reviewCreative.mockReset().mockResolvedValue({ verdict: "allow", violations: [] });
    adapter.validateCreative.mockReset().mockResolvedValue({ ok: true, issues: [] });
    adapter.publishCampaign.mockReset().mockResolvedValue({ platform_campaign_id: "META_1" });
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { adPublishingWorker } = await import("../../src/workers/ad-publishing.js");
    return getHandlerForTests(adPublishingWorker as never);
  }

  it("publishes when compliance + platform validation pass", async () => {
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseData) as never, data: baseData });
    expect(out).toMatchObject({ platform_campaign_id: "META_1" });
  });

  it("blocks (terminal) when compliance returns block", async () => {
    compliance.reviewCreative.mockResolvedValue({ verdict: "block", violations: ["guaranteed_results"] });
    const job = makeJob(baseData);
    const handler = await load();
    await expect(handler.run({ job: job as never, data: baseData })).rejects.toThrow(/compliance_block/);
    expect(job.opts.attempts).toBe(1);
    expect(adapter.publishCampaign).not.toHaveBeenCalled();
  });

  it("retries (throws) when platform validation rejects", async () => {
    adapter.validateCreative.mockResolvedValue({ ok: false, issues: ["headline_too_long"] });
    const handler = await load();
    await expect(
      handler.run({ job: makeJob(baseData) as never, data: baseData }),
    ).rejects.toThrow(/platform_validation_failed/);
  });
});
