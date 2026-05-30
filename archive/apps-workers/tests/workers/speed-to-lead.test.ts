import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const notifications = {
  sendInAppNotification: vi.fn().mockResolvedValue(undefined),
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  setWorkspaceNudge: vi.fn(),
};
const revtry = { queueOutboundDial: vi.fn().mockResolvedValue({ call_id: "call_1" }) };
const activation = {
  scoreLead: vi.fn().mockResolvedValue({ score: 88, band: "hot", rules_applied: ["utm_paid"] }),
  persistScore: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@funnel/notifications", () => notifications);
vi.mock("@funnel/revtry", () => revtry);
vi.mock("@funnel/activation", () => activation);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("speed-to-lead worker", () => {
  beforeEach(() => {
    notifications.sendInAppNotification.mockClear();
    notifications.sendPushNotification.mockClear();
    revtry.queueOutboundDial.mockClear();
    activation.scoreLead.mockClear();
    activation.persistScore.mockClear();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { speedToLeadWorker } = await import("../../src/workers/speed-to-lead.js");
    return getHandlerForTests(speedToLeadWorker as never);
  }

  const data = {
    workspace_id: "wsp_01HX",
    funnel_id: "fnl_01HX",
    funnel_owner_user_id: "usr_01HX",
    lead_id: "lds_01HX",
    captured_at: new Date().toISOString(),
    lead: {
      name: "Alex",
      email: "alex@example.com",
      phone_e164: "+15551234567",
      answers: { intent: "buy" },
      utm: { source: "ph" },
    },
  };

  it("fires all four sub-tasks in parallel", async () => {
    const handler = await load();
    const out = await handler.run({ job: makeJob(data) as never, data });
    expect(out.lead_id).toBe("lds_01HX");
    expect(revtry.queueOutboundDial).toHaveBeenCalledOnce();
    expect(notifications.sendInAppNotification).toHaveBeenCalledOnce();
    expect(notifications.sendPushNotification).toHaveBeenCalledOnce();
    expect(activation.scoreLead).toHaveBeenCalledOnce();
    expect(activation.persistScore).toHaveBeenCalledOnce();
  });

  it("skips voice + SMS path when no phone present", async () => {
    const noPhone = { ...data, lead: { ...data.lead, phone_e164: null } };
    const handler = await load();
    await handler.run({ job: makeJob(noPhone) as never, data: noPhone });
    expect(revtry.queueOutboundDial).not.toHaveBeenCalled();
  });

  it("does not throw if any sub-task fails", async () => {
    revtry.queueOutboundDial.mockRejectedValueOnce(new Error("revtry down"));
    activation.scoreLead.mockRejectedValueOnce(new Error("scoring down"));
    const handler = await load();
    await expect(handler.run({ job: makeJob(data) as never, data })).resolves.toBeDefined();
  });

  it("idempotency is per lead", async () => {
    const handler = await load();
    expect(handler.idempotencyKey!(data)).toBe("s2l:lds_01HX");
  });
});
