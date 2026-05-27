import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const billing = { advanceDueDunningStates: vi.fn() };
vi.mock("@funnel/billing", () => billing);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("dunning worker", () => {
  beforeEach(() => {
    billing.advanceDueDunningStates.mockReset();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { dunningWorker } = await import("../../src/workers/dunning.js");
    return getHandlerForTests(dunningWorker as never);
  }

  it("advances all due subscriptions", async () => {
    billing.advanceDueDunningStates.mockResolvedValue({
      advanced: [
        { subscription_id: "sub_1", from_step: "d0", to_step: "d3", next_step_at: "2026-06-01T00:00:00Z", status: "past_due" },
        { subscription_id: "sub_2", from_step: "d7", to_step: "d14", next_step_at: "2026-06-08T00:00:00Z", status: "past_due" },
      ],
      skipped: [{ subscription_id: "sub_3", reason: "card_updated" }],
    });
    const handler = await load();
    const data = { trigger: "cron" as const };
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out).toEqual({ advanced: 2, skipped: 1 });
  });

  it("propagates failure (BullMQ retries)", async () => {
    billing.advanceDueDunningStates.mockRejectedValue(new Error("db unreachable"));
    const handler = await load();
    await expect(
      handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } }),
    ).rejects.toThrow(/db unreachable/);
  });

  it("idempotency is hourly per scope", async () => {
    const handler = await load();
    const a = handler.idempotencyKey!({ trigger: "cron" });
    const b = handler.idempotencyKey!({ trigger: "cron" });
    expect(a).toBe(b);
    const c = handler.idempotencyKey!({ trigger: "manual", subscription_id: "sub_X" });
    expect(c).not.toBe(a);
  });
});
