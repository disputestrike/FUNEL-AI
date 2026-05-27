import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const emailModule = {
  send: vi.fn(),
  isSuppressed: vi.fn(),
  recordSend: vi.fn(),
};

vi.mock("@funnel/email", () => emailModule);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("email worker", () => {
  beforeEach(() => {
    emailModule.send.mockReset();
    emailModule.isSuppressed.mockReset().mockResolvedValue(false);
    emailModule.recordSend.mockReset().mockResolvedValue(undefined);
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { emailWorker } = await import("../../src/workers/email.js");
    return getHandlerForTests(emailWorker as never);
  }

  const baseData = {
    workspace_id: "wsp_01HX",
    to: "alice@example.com",
    template: "verify_email",
    subject: "Verify your email",
    data: {},
    category: "transactional" as const,
  };

  it("happy path: sends and records", async () => {
    emailModule.send.mockResolvedValue({ message_id: "msg_1", accepted: true });
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseData) as never, data: baseData });
    expect(out).toMatchObject({ message_id: "msg_1" });
    expect(emailModule.recordSend).toHaveBeenCalled();
  });

  it("skips when suppressed", async () => {
    emailModule.isSuppressed.mockResolvedValue(true);
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseData) as never, data: baseData });
    expect(out).toMatchObject({ skipped: true, reason: "suppressed" });
    expect(emailModule.send).not.toHaveBeenCalled();
  });

  it("retries on provider rejection", async () => {
    emailModule.send.mockResolvedValue({ message_id: "msg_x", accepted: false });
    const handler = await load();
    await expect(handler.run({ job: makeJob(baseData) as never, data: baseData })).rejects.toThrow(
      /rejected by provider/,
    );
  });

  it("idempotency uses explicit key when supplied", async () => {
    const handler = await load();
    const k = handler.idempotencyKey!({ ...baseData, idempotency_key: "custom-1" });
    expect(k).toBe("custom-1");
  });

  it("idempotency derives from to+template when no key", async () => {
    const handler = await load();
    const k1 = handler.idempotencyKey!(baseData);
    const k2 = handler.idempotencyKey!(baseData);
    expect(k1).toBe(k2);
  });
});
