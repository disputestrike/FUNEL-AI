import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const complianceMock = {
  isOnDncList: vi.fn(),
  isOptedOut: vi.fn(),
};
const integrationsMock = {
  getSignalwireAdapter: vi.fn(),
};
const signalwireAdapter = {
  sendSms: vi.fn(),
};

vi.mock("@funnel/compliance", () => complianceMock);
vi.mock("@funnel/integrations", () => integrationsMock);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("sms worker", () => {
  beforeEach(() => {
    complianceMock.isOnDncList.mockReset().mockResolvedValue({ on_list: false });
    complianceMock.isOptedOut.mockReset().mockResolvedValue(false);
    integrationsMock.getSignalwireAdapter.mockReset().mockResolvedValue(signalwireAdapter);
    signalwireAdapter.sendSms.mockReset();
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { smsWorker } = await import("../../src/workers/sms.js");
    return getHandlerForTests(smsWorker as never);
  }

  const baseData = {
    workspace_id: "wsp_01HX",
    to_e164: "+15551234567",
    from_e164: "+18889990000",
    body: "thanks!",
    category: "lead_reply" as const,
    lead_id: "lds_01HX",
  };

  it("happy path", async () => {
    signalwireAdapter.sendSms.mockResolvedValue({ message_id: "sms_1", accepted: true });
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseData) as never, data: baseData });
    expect(out).toMatchObject({ message_id: "sms_1" });
  });

  it("HARD GATE: refuses send to DNC-listed number (terminal)", async () => {
    complianceMock.isOnDncList.mockResolvedValue({ on_list: true, list_name: "federal" });
    const job = makeJob(baseData);
    const handler = await load();
    await expect(handler.run({ job: job as never, data: baseData })).rejects.toMatchObject({
      name: "TerminalRefusalError",
      reason: "dnc",
    });
    expect(signalwireAdapter.sendSms).not.toHaveBeenCalled();
    // The worker bumps attempts so BullMQ won't retry.
    expect(job.opts.attempts).toBe(1);
  });

  it("HARD GATE: refuses send when DNC check itself fails (fail-closed)", async () => {
    complianceMock.isOnDncList.mockRejectedValue(new Error("DNC API timeout"));
    const handler = await load();
    await expect(
      handler.run({ job: makeJob(baseData) as never, data: baseData }),
    ).rejects.toMatchObject({ name: "TerminalRefusalError" });
    expect(signalwireAdapter.sendSms).not.toHaveBeenCalled();
  });

  it("HARD GATE: refuses send on TCPA opt-out", async () => {
    complianceMock.isOptedOut.mockResolvedValue(true);
    const handler = await load();
    await expect(
      handler.run({ job: makeJob(baseData) as never, data: baseData }),
    ).rejects.toMatchObject({ reason: "opt_out" });
  });

  it("retryable failure when provider returns accepted=false", async () => {
    signalwireAdapter.sendSms.mockResolvedValue({ message_id: "sms_x", accepted: false });
    const handler = await load();
    await expect(
      handler.run({ job: makeJob(baseData) as never, data: baseData }),
    ).rejects.toThrow(/signalwire rejected sms/);
  });

  it("rejects invalid E164 in schema", async () => {
    const handler = await load();
    const parsed = handler.schema.safeParse({ ...baseData, to_e164: "555-1234" });
    expect(parsed.success).toBe(false);
  });
});
