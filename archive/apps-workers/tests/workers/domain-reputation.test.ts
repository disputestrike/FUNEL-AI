import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const compliance = {
  scanAllDomains: vi.fn(),
  markDomainFlagged: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@funnel/compliance", () => compliance);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("domain-reputation worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { domainReputationWorker } = await import("../../src/workers/domain-reputation.js");
    return getHandlerForTests(domainReputationWorker as never);
  }

  it("flags high-severity findings", async () => {
    compliance.scanAllDomains.mockResolvedValue({
      scanned: 100,
      findings: [
        { domain: "evil.example", list: "google_safe_browsing", severity: "high", reason: "malware" },
        { domain: "ok.example", list: "smartscreen", severity: "info", reason: "ok" },
      ],
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob({}) as never, data: {} });
    expect(out).toEqual({ scanned: 100, flagged: 2 });
    expect(compliance.markDomainFlagged).toHaveBeenCalledOnce();
  });
});
