import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("DLQ routing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("routes to DLQ once attempts == max", async () => {
    const { routeToDlq } = await import("../../src/dlq-handler.js");
    const { getQueue } = await import("../../src/queues.js");
    const dlq = getQueue("dlq");
    const addSpy = vi.spyOn(dlq, "add").mockResolvedValue({ id: "dlq_mock" } as never);
    const job = {
      id: "j_1",
      name: "email.send",
      data: { to: "a@b.com" },
      attemptsMade: 3,
      opts: { attempts: 3 },
    } as never;
    await routeToDlq("email", job, new Error("provider 500"));
    expect(addSpy).toHaveBeenCalled();
  });

  it("does NOT route while retries remain", async () => {
    const { routeToDlq } = await import("../../src/dlq-handler.js");
    const { getQueue } = await import("../../src/queues.js");
    const dlq = getQueue("dlq");
    const addSpy = vi.spyOn(dlq, "add").mockResolvedValue({ id: "dlq_mock" } as never);
    const job = {
      id: "j_2",
      name: "email.send",
      data: { to: "a@b.com" },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as never;
    await routeToDlq("email", job, new Error("timeout"));
    expect(addSpy).not.toHaveBeenCalled();
  });
});
