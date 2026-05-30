import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const billing = {
  listSubscriptionsWithExpiringCards: vi.fn(),
};
vi.mock("@funnel/billing", () => billing);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("card-expiring-alerts worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { cardExpiringAlertsWorker } = await import("../../src/workers/card-expiring-alerts.js");
    return getHandlerForTests(cardExpiringAlertsWorker as never);
  }

  it("enqueues email per (sub × bucket)", async () => {
    billing.listSubscriptionsWithExpiringCards
      .mockResolvedValueOnce([
        { subscription_id: "sub_1", workspace_id: "wsp_1", owner_user_id: "u", owner_email: "a@b.com", brand: "visa", last4: "1234", exp_month: 6, exp_year: 2026, days_until_expiry: 30 },
      ])
      .mockResolvedValueOnce([
        { subscription_id: "sub_2", workspace_id: "wsp_1", owner_user_id: "u", owner_email: "b@b.com", brand: "mc", last4: "0001", exp_month: 6, exp_year: 2026, days_until_expiry: 7 },
      ]);
    const handler = await load();
    const data = { buckets: [30, 7] };
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out).toEqual({ enqueued: 2 });
  });
});
