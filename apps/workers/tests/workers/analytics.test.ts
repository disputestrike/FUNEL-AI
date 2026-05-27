import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const posthog = { capture: vi.fn() };
const mixpanel = { track: vi.fn() };
const iceberg = { appendToLake: vi.fn() };
const integrations = {
  getPosthogAdapter: vi.fn().mockResolvedValue(posthog),
  getMixpanelAdapter: vi.fn().mockResolvedValue(mixpanel),
  getIcebergAdapter: vi.fn().mockResolvedValue(iceberg),
};

vi.mock("@funnel/integrations", () => integrations);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("analytics worker", () => {
  const data = {
    event_id: "evt_01HX",
    event_name: "lead_captured",
    workspace_id: "wsp_01HX",
    user_id: null,
    occurred_at: "2026-05-25T17:42:01Z",
    properties: { foo: 1 },
    destinations: ["posthog", "mixpanel", "iceberg"] as const,
  };

  beforeEach(() => {
    posthog.capture.mockReset().mockResolvedValue(undefined);
    mixpanel.track.mockReset().mockResolvedValue(undefined);
    iceberg.appendToLake.mockReset().mockResolvedValue(undefined);
  });

  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { analyticsWorker } = await import("../../src/workers/analytics.js");
    return getHandlerForTests(analyticsWorker as never);
  }

  it("fans out to all 3 destinations", async () => {
    const handler = await load();
    const out = await handler.run({ job: makeJob({ ...data }) as never, data: { ...data } });
    expect(out).toMatchObject({ posthog: "ok", mixpanel: "ok", iceberg: "ok" });
  });

  it("succeeds if any one destination succeeds", async () => {
    posthog.capture.mockRejectedValue(new Error("ph down"));
    mixpanel.track.mockRejectedValue(new Error("mp down"));
    const handler = await load();
    const out = await handler.run({ job: makeJob({ ...data }) as never, data: { ...data } });
    expect((out as Record<string, string>)["iceberg"]).toBe("ok");
  });

  it("fails when every destination fails", async () => {
    posthog.capture.mockRejectedValue(new Error("ph"));
    mixpanel.track.mockRejectedValue(new Error("mp"));
    iceberg.appendToLake.mockRejectedValue(new Error("ice"));
    const handler = await load();
    await expect(
      handler.run({ job: makeJob({ ...data }) as never, data: { ...data } }),
    ).rejects.toThrow(/all analytics destinations failed/);
  });
});
