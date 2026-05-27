import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const kb = { retireAndPromote: vi.fn() };
vi.mock("@funnel/kb", () => kb);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("model-version-promote worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { modelVersionPromoteWorker } = await import("../../src/workers/model-version-promote.js");
    return getHandlerForTests(modelVersionPromoteWorker as never);
  }

  it("returns promotion summary", async () => {
    kb.retireAndPromote.mockResolvedValue({
      promoted: [{ item_id: "i_1", pack_id: "p_1", metric: "ctr", value: 0.09 }],
      retired: [{ item_id: "i_old", pack_id: "p_1", reason: "stale" }],
      kept: 42,
      new_version: "2026.06",
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob({}) as never, data: {} });
    expect(out).toEqual({ new_version: "2026.06", promoted: 1, retired: 1, kept: 42 });
  });
});
