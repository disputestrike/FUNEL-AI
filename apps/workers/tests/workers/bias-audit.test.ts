import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const compliance = {
  runBiasAudit: vi.fn(),
  saveBiasAuditReport: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@funnel/compliance", () => compliance);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("bias audit worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { biasAuditWorker } = await import("../../src/workers/bias-audit.js");
    return getHandlerForTests(biasAuditWorker as never);
  }

  it("reports findings", async () => {
    compliance.runBiasAudit.mockResolvedValue({
      report_id: "rep_1",
      samples_evaluated: 1000,
      findings: [
        { stratum: { industry: "solar", geo: "US-TX", demographic: "all" }, issue: "gender skew", severity: "high", examples: ["..."] },
      ],
      cost_usd_micros: 50_000_000,
      per_provider_cost: [{ provider: "anthropic", model: "claude-opus-4-7", cost_usd_micros: 50_000_000 }],
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob({ sample_size: 1000 }) as never, data: { sample_size: 1000 } });
    expect(out).toMatchObject({ report_id: "rep_1", findings_count: 1, high_severity_count: 1 });
  });

  it("idempotency is monthly", async () => {
    const handler = await load();
    const k = handler.idempotencyKey!({ sample_size: 500 });
    expect(k).toMatch(/^bias-audit:\d{4}-\d{2}:500$/);
  });
});
