import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("webhooks-outbound worker", () => {
  const baseData = {
    workspace_id: "wsp_01HX",
    endpoint_id: "wh_01HX",
    endpoint_url: "https://acme.example/hook",
    signing_secret: "topsecret-key-1234567890",
    event_id: "evt_01HX",
    event_name: "lead.created",
    payload: { lead_id: "lds_01HX" },
    attempt: 0,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { webhooksOutboundWorker } = await import("../../src/workers/webhooks-outbound.js");
    return getHandlerForTests(webhooksOutboundWorker as never);
  }

  it("happy path: signs body with HMAC-SHA256 and posts to endpoint", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    const handler = await load();
    const out = await handler.run({ job: makeJob(baseData) as never, data: baseData });
    expect(out).toMatchObject({ delivered: true, status: 200 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(baseData.endpoint_url);
    const headers = (init as RequestInit).headers as Record<string, string>;
    const ts = Number(headers["x-funnel-timestamp"]);
    const body = (init as RequestInit).body as string;
    const expectedSig = `sha256=${createHmac("sha256", baseData.signing_secret).update(`${ts}.${body}`).digest("hex")}`;
    expect(headers["x-funnel-signature"]).toBe(expectedSig);
    expect(headers["x-funnel-idempotency"]).toBe(baseData.event_id);
    expect(headers["x-funnel-event"]).toBe("lead.created");
  });

  it("re-queues with 1m delay on 1st failure", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    const job = makeJob(baseData);
    const handler = await load();
    const out = await handler.run({ job: job as never, data: baseData });
    expect(out).toMatchObject({ rescheduled: true, attempt: 1 });
    expect(job.queue.add).toHaveBeenCalled();
    const callArgs = (job.queue.add.mock.calls[0] ?? []) as unknown[];
    expect((callArgs[2] as { delay: number }).delay).toBe(60_000);
  });

  it("uses 5m delay on 2nd failure (attempt 1 -> 2)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }));
    const job = makeJob({ ...baseData, attempt: 1 });
    const handler = await load();
    await handler.run({ job: job as never, data: { ...baseData, attempt: 1 } });
    const callArgs = (job.queue.add.mock.calls[0] ?? []) as unknown[];
    expect((callArgs[2] as { delay: number }).delay).toBe(5 * 60_000);
  });

  it("uses 12h delay on 5th attempt", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    const job = makeJob({ ...baseData, attempt: 3 });
    const handler = await load();
    await handler.run({ job: job as never, data: { ...baseData, attempt: 3 } });
    const callArgs = (job.queue.add.mock.calls[0] ?? []) as unknown[];
    expect((callArgs[2] as { delay: number }).delay).toBe(12 * 3600_000);
  });

  it("DLQ after 5 failures", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    const job = makeJob({ ...baseData, attempt: 4 });
    const handler = await load();
    await expect(
      handler.run({ job: job as never, data: { ...baseData, attempt: 4 } }),
    ).rejects.toThrow(/webhook delivery failed after 5 attempts/);
    // attempts bumped so BullMQ marks failed.
    expect(job.opts.attempts).toBe(job.attemptsMade + 1);
  });

  it("treats network errors the same as 5xx", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    const job = makeJob(baseData);
    const handler = await load();
    const out = await handler.run({ job: job as never, data: baseData });
    expect(out).toMatchObject({ rescheduled: true });
  });

  it("idempotency key is per (endpoint, event)", async () => {
    const handler = await load();
    const k1 = handler.idempotencyKey!(baseData);
    const k2 = handler.idempotencyKey!({ ...baseData, attempt: 4 });
    expect(k1).toBe(k2);
  });
});
