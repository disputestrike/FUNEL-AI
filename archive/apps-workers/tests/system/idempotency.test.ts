import { describe, expect, it, vi } from "vitest";

import { claimIdempotencyKey, deriveIdempotencyKey } from "../../src/idempotency.js";

describe("idempotency", () => {
  it("derives a stable key irrespective of object key order", () => {
    const a = deriveIdempotencyKey("email.send", { to: "a@b.com", template: "x" });
    const b = deriveIdempotencyKey("email.send", { template: "x", to: "a@b.com" });
    expect(a).toBe(b);
  });

  it("differs across job names", () => {
    const a = deriveIdempotencyKey("email.send", { x: 1 });
    const b = deriveIdempotencyKey("email.cancel", { x: 1 });
    expect(a).not.toBe(b);
  });

  it("differs across nested values", () => {
    const a = deriveIdempotencyKey("x", { a: { b: 1 } });
    const b = deriveIdempotencyKey("x", { a: { b: 2 } });
    expect(a).not.toBe(b);
  });

  it("claim returns true once, then false", async () => {
    const seen = new Map<string, string>();
    const redis = {
      set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number, mode: string) => {
        if (mode === "NX") {
          if (seen.has(key)) return null;
          seen.set(key, value);
          return "OK";
        }
        seen.set(key, value);
        return "OK";
      }),
    };
    const first = await claimIdempotencyKey(redis as never, "abc123");
    const second = await claimIdempotencyKey(redis as never, "abc123");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
