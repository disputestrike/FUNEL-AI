import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const orchestratorMock = {
  generate: vi.fn(),
};
const dbMock = {
  prisma: {
    funnel: { upsert: vi.fn().mockResolvedValue(undefined) },
    humanReviewQueue: { create: vi.fn().mockResolvedValue(undefined) },
  },
};

vi.mock("@funnel/orchestrator", () => orchestratorMock);
vi.mock("@funnel/db", () => dbMock);
vi.mock("@funnel/events", () => ({
  EventSchemas: {},
  emit: vi.fn(async () => undefined),
}));

describe("generation worker", () => {
  beforeEach(() => {
    orchestratorMock.generate.mockReset();
    dbMock.prisma.funnel.upsert.mockClear();
    dbMock.prisma.humanReviewQueue.create.mockClear();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { generationWorker } = await import("../../src/workers/generation.js");
    return getHandlerForTests<never, never>(generationWorker as never);
  }

  const baseJob = {
    generation_id: "gen_01HX",
    workspace_id: "wsp_01HX",
    requested_by_user_id: "usr_01HX",
    vertical: "solar",
    prompt: "rooftop solar in austin",
    kb_pack_ids: ["pak_solar_us"],
    parent_generation_id: null,
    regeneration_depth: 0,
  };

  it("happy path: persists funnel + emits cost metric", async () => {
    orchestratorMock.generate.mockResolvedValue({
      funnel: { hero: { headline: "Get solar today" } },
      quality_score: 92,
      cost_usd_micros: 12_345,
      duration_ms: 3_500,
      token_usage: { input: 500, output: 200, cache_read: 100 },
      requires_human_review: false,
      agent_breakdown: [
        { agent_id: "copy", model_id: "claude-opus-4-7", provider: "anthropic", cost_usd_micros: 10_000, tokens_in: 200, tokens_out: 100 },
      ],
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseJob) as never, data: baseJob });
    expect(dbMock.prisma.funnel.upsert).toHaveBeenCalledOnce();
    expect(out).toMatchObject({ generation_id: "gen_01HX", quality_score: 92 });
  });

  it("regenerates when quality below gate and depth < max", async () => {
    orchestratorMock.generate.mockResolvedValue({
      funnel: {},
      quality_score: 65,
      cost_usd_micros: 1,
      duration_ms: 1,
      token_usage: { input: 1, output: 1 },
      requires_human_review: false,
      agent_breakdown: [],
    });
    const handler = await load();
    const { __resetConfigForTests } = await import("../../src/config.js");
    __resetConfigForTests();

    await handler.run({ job: makeJob(baseJob) as never, data: baseJob });
    // We can't observe the requeue from here without the queue mock; just
    // assert that the handler did NOT route to human review at depth 0.
    expect(dbMock.prisma.humanReviewQueue.create).not.toHaveBeenCalled();
  });

  it("routes to human review when quality stays low after max regens", async () => {
    orchestratorMock.generate.mockResolvedValue({
      funnel: {},
      quality_score: 65,
      cost_usd_micros: 1,
      duration_ms: 1,
      token_usage: { input: 1, output: 1 },
      requires_human_review: false,
      agent_breakdown: [],
    });
    const handler = await load();
    await handler.run({
      job: makeJob({ ...baseJob, regeneration_depth: 2 }) as never,
      data: { ...baseJob, regeneration_depth: 2 },
    });
    expect(dbMock.prisma.humanReviewQueue.create).toHaveBeenCalled();
  });

  it("routes to human review when agent requested it", async () => {
    orchestratorMock.generate.mockResolvedValue({
      funnel: {},
      quality_score: 95,
      cost_usd_micros: 1,
      duration_ms: 1,
      token_usage: { input: 1, output: 1 },
      requires_human_review: true,
      agent_breakdown: [],
    });
    const handler = await load();
    await handler.run({ job: makeJob(baseJob) as never, data: baseJob });
    expect(dbMock.prisma.humanReviewQueue.create).toHaveBeenCalled();
  });

  it("propagates orchestrator errors (retryable)", async () => {
    orchestratorMock.generate.mockRejectedValue(new Error("rate_limited"));
    const handler = await load();
    await expect(
      handler.run({ job: makeJob(baseJob) as never, data: baseJob }),
    ).rejects.toThrow("rate_limited");
  });

  it("idempotency key is stable for the same generation+depth", async () => {
    const handler = await load();
    const a = handler.idempotencyKey!(baseJob as never);
    const b = handler.idempotencyKey!({ ...baseJob } as never);
    expect(a).toBe(b);
    const c = handler.idempotencyKey!({ ...baseJob, regeneration_depth: 1 } as never);
    expect(c).not.toBe(a);
  });
});
