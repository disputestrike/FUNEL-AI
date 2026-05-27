import { describe, expect, it } from "vitest";

import { __resetConfigForTests, loadConfig } from "../../src/config.js";

describe("config", () => {
  it("loads with defaults", () => {
    process.env["NODE_ENV"] = "test";
    process.env["REDIS_URL"] = "redis://localhost:6379";
    process.env["DATABASE_URL"] = "postgresql://x:y@h/db";
    __resetConfigForTests();
    const cfg = loadConfig();
    expect(cfg.HEALTH_PORT).toBeGreaterThan(0);
    expect(cfg.SHUTDOWN_DRAIN_TIMEOUT_MS).toBe(30_000);
  });

  it("rejects missing required vars", () => {
    __resetConfigForTests();
    expect(() => loadConfig({} as never)).toThrow();
  });

  it("parses CONCURRENCY_OVERRIDE JSON", () => {
    __resetConfigForTests();
    const cfg = loadConfig({
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
      DATABASE_URL: "postgresql://x:y@h/db",
      CONCURRENCY_OVERRIDE: '{"email": 200}',
    } as never);
    expect(cfg.CONCURRENCY_OVERRIDE).toEqual({ email: 200 });
  });

  it("tolerates malformed CONCURRENCY_OVERRIDE", () => {
    __resetConfigForTests();
    const cfg = loadConfig({
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
      DATABASE_URL: "postgresql://x:y@h/db",
      CONCURRENCY_OVERRIDE: "not json",
    } as never);
    expect(cfg.CONCURRENCY_OVERRIDE).toEqual({});
  });
});
