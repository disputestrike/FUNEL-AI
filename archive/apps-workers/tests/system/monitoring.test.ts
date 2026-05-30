import { describe, expect, it, vi } from "vitest";

import { instrumentJob, promRegistry } from "../../src/monitoring.js";

describe("monitoring helpers", () => {
  it("instrumentJob records ok outcome", async () => {
    const wrapped = instrumentJob<{ x: number }, number>("email", async (j) => j.x * 2);
    const result = await wrapped({ x: 21 });
    expect(result).toBe(42);
    const metrics = await promRegistry.metrics();
    expect(metrics).toMatch(/funnel_workers_jobs_processed_total\{[^}]*queue="email"[^}]*outcome="ok"[^}]*\} [1-9]/);
  });

  it("instrumentJob records fail outcome on throw", async () => {
    const wrapped = instrumentJob("email", async () => {
      throw new Error("nope");
    });
    await expect(wrapped({} as never)).rejects.toThrow("nope");
    const metrics = await promRegistry.metrics();
    expect(metrics).toMatch(/funnel_workers_jobs_processed_total\{[^}]*queue="email"[^}]*outcome="fail"/);
  });

  it("Sentry is mocked + does not throw on capture", async () => {
    const { captureWorkerError } = await import("../../src/monitoring.js");
    expect(() => captureWorkerError(new Error("x"), { queue: "email" })).not.toThrow();
  });

  it("prom registry contains pre-seeded queue depth gauges", async () => {
    const metrics = await promRegistry.metrics();
    expect(metrics).toMatch(/funnel_workers_queue_depth\{[^}]*queue="generation"[^}]*state="waiting"/);
  });

  it("log produces JSON to stdout", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { log } = await import("../../src/monitoring.js");
    log("info", { msg: "hi", queue: "email" });
    expect(spy).toHaveBeenCalled();
    const arg = spy.mock.calls[0]?.[0];
    if (typeof arg === "string") {
      const parsed = JSON.parse(arg);
      expect(parsed.level).toBe("info");
      expect(parsed.msg).toBe("hi");
    }
  });
});
