import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const billing = {
  reconcileSubscriptions: vi.fn().mockResolvedValue({ checked: 50, drift: [] }),
  scanMissedWebhooks: vi.fn().mockResolvedValue({ providers: [] }),
  reconcilePlatformBalance: vi.fn().mockResolvedValue([]),
  reconcileCostLedger: vi.fn().mockResolvedValue([]),
};

vi.mock("@funnel/billing", () => billing);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("reconciliation worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { reconciliationWorker } = await import("../../src/workers/reconciliation.js");
    return getHandlerForTests(reconciliationWorker as never);
  }

  it("happy path: no drift", async () => {
    const handler = await load();
    const out = await handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } });
    expect(out).toEqual({
      subscription_drift: 0,
      missed_webhooks: 0,
      balance_drift: 0,
      cost_ledger_issues: 0,
    });
  });

  it("reports subscription drift count", async () => {
    billing.reconcileSubscriptions.mockResolvedValueOnce({
      checked: 50,
      drift: [
        { subscription_id: "sub_1", field: "status", ours: "active", theirs: "canceled", provider: "stripe" },
      ],
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } });
    expect(out.subscription_drift).toBe(1);
  });

  it("reports balance drift only when > $1", async () => {
    billing.reconcilePlatformBalance.mockResolvedValueOnce([
      { provider: "stripe", platform_cents: 10_000, processor_cents: 9_999, delta_cents: 1 },
      { provider: "paypal", platform_cents: 10_000, processor_cents: 9_500, delta_cents: 500 },
    ]);
    const handler = await load();
    const out = await handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } });
    expect(out.balance_drift).toBe(1);
  });
});
