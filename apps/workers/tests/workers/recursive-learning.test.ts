import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const kb = {
  aggregateConversionsFromLake: vi.fn().mockResolvedValue({ cohorts: 12, examples_written: 240, pack_ids_updated: ["solar"] }),
  retrainRankingModel: vi.fn().mockResolvedValue({ model_version: "rk_2026.06", train_examples: 50_000, eval_auc: 0.83, promoted: true }),
};
vi.mock("@funnel/kb", () => kb);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("recursive-learning worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { recursiveLearningWorker } = await import("../../src/workers/recursive-learning.js");
    return getHandlerForTests(recursiveLearningWorker as never);
  }

  it("aggregates without retrain on non-1st of month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T03:00:00Z"));
    const handler = await load();
    const out = await handler.run({ job: makeJob({ retrain: false }) as never, data: { retrain: false } });
    expect(out.retrained).toBe(false);
    expect(kb.retrainRankingModel).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("retrains when forced", async () => {
    kb.retrainRankingModel.mockClear();
    const handler = await load();
    const out = await handler.run({ job: makeJob({ retrain: true }) as never, data: { retrain: true } });
    expect(out.retrained).toBe(true);
  });
});
