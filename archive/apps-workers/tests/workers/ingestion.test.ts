import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const kb = { runIngestionCycle: vi.fn() };
vi.mock("@funnel/kb", () => kb);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("ingestion worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { ingestionWorker } = await import("../../src/workers/ingestion.js");
    return getHandlerForTests(ingestionWorker as never);
  }

  it("runs the daily cycle + reports per-provider cost", async () => {
    kb.runIngestionCycle.mockResolvedValue({
      sources_pulled: ["newsapi", "rss", "youtube"],
      items_fetched: 200,
      items_kept: 80,
      items_discarded: 120,
      candidates_created: 80,
      cost_usd_micros: 1_234_567,
      per_provider_cost: [{ provider: "openai", model: "text-embedding-3-small", cost_usd_micros: 234_000 }],
    });
    const handler = await load();
    const data = { sources: ["newsapi"] };
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out.candidates_created).toBe(80);
    expect(kb.runIngestionCycle).toHaveBeenCalledWith({ sources: ["newsapi"], budget_usd_micros: undefined });
  });

  it("idempotency is per-day per-sources", async () => {
    const handler = await load();
    const day = new Date().toISOString().slice(0, 10);
    expect(handler.idempotencyKey!({ sources: ["a", "b"] })).toBe(`ingestion:${day}:a,b`);
    expect(handler.idempotencyKey!({ sources: ["b", "a"] })).toBe(`ingestion:${day}:a,b`);
  });
});
