import { describe, expect, it, vi } from "vitest";

import { startHealthServer } from "../../src/health.js";

interface RedisLike {
  ping(): Promise<string>;
}

async function fetchPath(port: number, path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.text();
  return { status: res.status, body };
}

describe("health server", () => {
  it("serves /healthz, /readyz, /metrics", async () => {
    process.env["HEALTH_PORT"] = "0"; // ephemeral
    const { __resetConfigForTests } = await import("../../src/config.js");
    __resetConfigForTests();
    process.env["HEALTH_PORT"] = String(38080 + Math.floor(Math.random() * 1000));
    __resetConfigForTests();
    const redis: RedisLike = { ping: vi.fn().mockResolvedValue("PONG") };
    const server = startHealthServer({ redis: redis as never });
    // Wait for the server to be listening.
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as { port: number }).port;
    try {
      const live = await fetchPath(port, "/healthz");
      expect(live.status).toBe(200);
      const ready = await fetchPath(port, "/readyz");
      expect(ready.status).toBe(200);
      const metrics = await fetchPath(port, "/metrics");
      expect(metrics.status).toBe(200);
      expect(metrics.body).toContain("funnel_workers_queue_depth");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("readyz fails when redis is down", async () => {
    process.env["HEALTH_PORT"] = String(39080 + Math.floor(Math.random() * 1000));
    const { __resetConfigForTests } = await import("../../src/config.js");
    __resetConfigForTests();
    const redis = { ping: vi.fn().mockRejectedValue(new Error("connection refused")) };
    const server = startHealthServer({ redis: redis as never });
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as { port: number }).port;
    try {
      const ready = await fetchPath(port, "/readyz");
      expect(ready.status).toBe(503);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
