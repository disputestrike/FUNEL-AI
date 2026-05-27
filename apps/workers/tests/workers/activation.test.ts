import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const activation = {
  scheduler: {
    listDueInterventions: vi.fn(),
    markDispatched: vi.fn().mockResolvedValue(undefined),
  },
};
const notifications = {
  sendInAppNotification: vi.fn().mockResolvedValue(undefined),
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  setWorkspaceNudge: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@funnel/activation", () => activation);
vi.mock("@funnel/notifications", () => notifications);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("activation worker", () => {
  beforeEach(() => {
    activation.scheduler.listDueInterventions.mockReset();
    activation.scheduler.markDispatched.mockClear();
    notifications.sendInAppNotification.mockClear();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { activationWorker } = await import("../../src/workers/activation.js");
    return getHandlerForTests(activationWorker as never);
  }

  it("dispatches interventions across channels", async () => {
    activation.scheduler.listDueInterventions.mockResolvedValue([
      { intervention_id: "act_1", workspace_id: "wsp_1", user_id: "usr_1", channel: "in_app", subject: "Welcome", body: "hi", cohort_day: 0 },
      { intervention_id: "act_2", workspace_id: "wsp_1", user_id: "usr_1", channel: "push", subject: "Hey", body: "back", cohort_day: 3 },
      { intervention_id: "act_3", workspace_id: "wsp_1", user_id: "usr_1", channel: "in_product_nudge", cohort_day: 7 },
    ]);
    const handler = await load();
    const out = await handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } });
    expect(out).toEqual({ dispatched: 3, skipped: 0 });
    expect(notifications.sendInAppNotification).toHaveBeenCalledOnce();
    expect(notifications.sendPushNotification).toHaveBeenCalledOnce();
    expect(notifications.setWorkspaceNudge).toHaveBeenCalledOnce();
    expect(activation.scheduler.markDispatched).toHaveBeenCalledTimes(3);
  });

  it("counts dispatch failures as skipped", async () => {
    activation.scheduler.listDueInterventions.mockResolvedValue([
      { intervention_id: "act_x", workspace_id: "wsp_1", user_id: "usr_1", channel: "in_app", subject: "x", body: "y", cohort_day: 0 },
    ]);
    notifications.sendInAppNotification.mockRejectedValue(new Error("broken"));
    const handler = await load();
    const out = await handler.run({ job: makeJob({ trigger: "cron" }) as never, data: { trigger: "cron" } });
    expect(out).toEqual({ dispatched: 0, skipped: 1 });
  });
});
