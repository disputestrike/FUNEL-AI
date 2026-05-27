/**
 * Smoke tests for the /v1 public API.
 *
 * Hits the mounted Hono app via app.request() and asserts on the wire shape.
 * Auth and rate-limit middleware are stubbed via the Cloudflare env mock.
 */

import { describe, it, expect } from "vitest";
import { publicApi } from "../src/public-api/index.js";

const ENV = {
  RL_PUBLIC_API: { limit: async () => ({ success: true, consumed: 1 }) },
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
  },
};

const goodKey = "Bearer fnl_test_AAAAAAAAAAAAAAAAAAAAAAAA";

describe("public api auth", () => {
  it("rejects missing Authorization header", async () => {
    const res = await publicApi.request("/funnels", { method: "GET" }, ENV);
    expect(res.status).toBe(401);
  });

  it("rejects malformed Bearer token", async () => {
    const res = await publicApi.request(
      "/funnels",
      { method: "GET", headers: { authorization: "Bearer not-a-key" } },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe("public api spec", () => {
  it("serves a valid OpenAPI 3.1 document", async () => {
    const res = await publicApi.request("/openapi.json", { method: "GET" }, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toMatch(/^3\.1/);
    expect(Object.keys(body.paths).length).toBeGreaterThan(20);
  });

  it("serves the Swagger UI playground", async () => {
    const res = await publicApi.request("/docs", { method: "GET" }, ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/html/);
  });
});

describe("public api headers", () => {
  it("echoes Funnel-Version on every response", async () => {
    const res = await publicApi.request("/openapi.json", { method: "GET" }, ENV);
    expect(res.headers.get("funnel-version")).toBe("v1");
  });
});

// Note: stateful resource tests live in the integration suite (which boots
// a Miniflare instance with seeded api_keys + workspace rows). Keeping this
// file as a pure unit harness so it runs on every PR in <1s.
void goodKey;
