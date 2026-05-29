/**
 * DncAdapter — federal + state + internal hard-gate.
 */
import { describe, expect, it, vi } from "vitest";

import { DncAdapter, type KVStore } from "../src/adapters/dnc.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class FakeKV implements KVStore {
  store = new Map<string, { v: string; exp: number }>();
  async get(k: string): Promise<string | null> {
    const r = this.store.get(k);
    if (!r) return null;
    if (Date.now() > r.exp) {
      this.store.delete(k);
      return null;
    }
    return r.v;
  }
  async set(k: string, v: string, ttlSec: number): Promise<void> {
    this.store.set(k, { v, exp: Date.now() + ttlSec * 1000 });
  }
}

describe("DncAdapter", () => {
  it("flags federal DNC when the registry returns listed:true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ listed: true }));
    const dnc = new DncAdapter({
      federalSan: "san_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await dnc.check("+15555550100", null);
    expect(r.on_federal).toBe(true);
    expect(r.reasons).toContain("federal_dnc");
    expect(r.e164_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not flag federal when registry returns 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const dnc = new DncAdapter({
      federalSan: "san_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await dnc.check("+15555550100", null);
    expect(r.on_federal).toBe(false);
  });

  it("fails closed on federal HTTP error (5xx)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const dnc = new DncAdapter({
      federalSan: "san_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await dnc.check("+15555550100", null);
    expect(r.on_federal).toBe(true);
    expect(r.reasons.some((s) => s.startsWith("federal_error"))).toBe(true);
  });

  it("respects internal suppression store", async () => {
    const dnc = new DncAdapter({
      offlineMode: true,
      internal: { isSuppressed: async () => true },
    });
    const r = await dnc.check("+15555550100", null);
    expect(r.on_internal).toBe(true);
    expect(r.on_federal).toBe(false);
  });

  it("caches results and skips repeat HTTP calls", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ listed: false }));
    const cache = new FakeKV();
    const dnc = new DncAdapter({
      federalSan: "san_test",
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await dnc.check("+15555550100", null);
    await dnc.check("+15555550100", null);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.store.size).toBe(1);
  });

  it("calls state endpoint when configured", async () => {
    let calls = 0;
    const customFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      calls++;
      const url = typeof args[0] === "string" ? args[0] : (args[0] as URL).toString();
      if (url.includes("donotcall.gov")) return jsonResponse({ listed: false });
      return jsonResponse({ listed: true });
    };
    const dnc = new DncAdapter({
      stateEndpoints: { CA: "https://ca.dnc.example/lookup" },
      federalSan: "san_test",
      fetchImpl: customFetch as unknown as typeof fetch,
    });
    const r = await dnc.check("+15555550100", "CA");
    expect(r.on_state).toBe(true);
    expect(r.reasons.some((s) => s.startsWith("state_dnc:CA"))).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2); // one federal + one state
  });

  it("offline mode skips network and returns all-false", async () => {
    const fetchImpl = vi.fn();
    const dnc = new DncAdapter({
      offlineMode: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await dnc.check("+15555550100", "CA");
    expect(r.on_federal).toBe(false);
    expect(r.on_state).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
