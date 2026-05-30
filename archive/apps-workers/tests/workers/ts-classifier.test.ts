import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const compliance = {
  classify: vi.fn(),
  recordClassification: vi.fn().mockResolvedValue(undefined),
};
const db = {
  prisma: {
    generation: { update: vi.fn().mockResolvedValue(undefined) },
    humanReviewQueue: { create: vi.fn().mockResolvedValue(undefined) },
  },
};

vi.mock("@funnel/compliance", () => compliance);
vi.mock("@funnel/db", () => db);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("ts-classifier worker", () => {
  const data = { generation_id: "gen_1", workspace_id: "wsp_1", content_hash: "h", content: "hello world" };

  beforeEach(() => {
    compliance.classify.mockReset();
    db.prisma.humanReviewQueue.create.mockClear();
    db.prisma.generation.update.mockClear();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { tsClassifierWorker } = await import("../../src/workers/ts-classifier.js");
    return getHandlerForTests(tsClassifierWorker as never);
  }

  it("allow path: updates ts_action without review", async () => {
    compliance.classify.mockResolvedValue({
      action: "allow",
      classes: {},
      cost_usd_micros: 100,
      provider: "openai",
      model: "moderation-2",
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out.action).toBe("allow");
    expect(db.prisma.humanReviewQueue.create).not.toHaveBeenCalled();
  });

  it("route_to_review path: creates a review row", async () => {
    compliance.classify.mockResolvedValue({
      action: "route_to_review",
      classes: { regulated_claims: { score: 0.8, verdict: "review" } },
      cost_usd_micros: 1,
      provider: "openai",
      model: "moderation-2",
    });
    const handler = await load();
    await handler.run({ job: makeJob(data) as never, data });
    expect(db.prisma.humanReviewQueue.create).toHaveBeenCalled();
  });

  it("block path: returns action 'block' (worker does not throw)", async () => {
    compliance.classify.mockResolvedValue({
      action: "block",
      classes: { csam_or_csae: { score: 0.99, verdict: "block" } },
      cost_usd_micros: 1,
      provider: "openai",
      model: "moderation-2",
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out.action).toBe("block");
  });
});
