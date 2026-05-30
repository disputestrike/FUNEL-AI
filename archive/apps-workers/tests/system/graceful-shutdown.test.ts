import { describe, expect, it, vi } from "vitest";

import { performShutdown } from "../../src/graceful-shutdown.js";

describe("graceful shutdown", () => {
  it("pauses workers, then closes them within the drain timeout", async () => {
    const fastWorker = { name: "fast", pause: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const slowWorker = {
      name: "slow",
      pause: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50))),
    };
    const disconnectDb = vi.fn().mockResolvedValue(undefined);

    await performShutdown(
      { workers: [fastWorker, slowWorker] as never, disconnectDb },
      "SIGTERM",
    );

    expect(fastWorker.pause).toHaveBeenCalled();
    expect(slowWorker.pause).toHaveBeenCalled();
    expect(fastWorker.close).toHaveBeenCalled();
    expect(slowWorker.close).toHaveBeenCalled();
    expect(disconnectDb).toHaveBeenCalled();
  });

  it("does not crash if a worker fails to close", async () => {
    const w = {
      name: "bad",
      pause: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockRejectedValue(new Error("close failed")),
    };
    await expect(
      performShutdown({ workers: [w] as never }, "SIGTERM"),
    ).resolves.not.toThrow();
  });

  it("respects the drain timeout when a worker hangs", async () => {
    process.env["SHUTDOWN_DRAIN_TIMEOUT_MS"] = "100";
    const { __resetConfigForTests } = await import("../../src/config.js");
    __resetConfigForTests();

    const hangWorker = {
      name: "hang",
      pause: vi.fn().mockResolvedValue(undefined),
      // Never resolves — but the drain timeout must let shutdown proceed.
      close: vi.fn().mockImplementation(() => new Promise(() => undefined)),
    };
    const start = Date.now();
    await performShutdown({ workers: [hangWorker] as never }, "SIGTERM");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1_000);
  });
});
