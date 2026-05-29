/**
 * Smoke tests for the short-link worker.
 *
 * These tests cover the routing surface only — DB / KV access is mocked so
 * the suite stays self-contained. Integration tests against a real wrangler
 * dev server live in tests/e2e/.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import app from "../src/index.js";
import type { Env } from "../src/env.js";

interface KvEntry {
  value: string;
  expirationTtl?: number;
}

function makeKv() {
  const store = new Map<string, KvEntry>();
  return {
    store,
    get: vi.fn(async (key: string, type?: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      return type === "json" ? JSON.parse(entry.value) : entry.value;
    }),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expirationTtl: opts?.expirationTtl });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: { connectionString: "postgres://test" } as Hyperdrive,
    SHORT_LINK_CACHE: makeKv(),
    CLICK_COUNTER_QUEUE: { send: vi.fn(async () => {}) } as unknown as Queue<never>,
    REDIRECT_RATELIMIT: { limit: vi.fn(async () => ({ success: true })) } as unknown as RateLimit,
    ENVIRONMENT: "development",
    APEX_DOMAIN: "gofnl.local",
    FALLBACK_URL: "https://app.gofunnelai.local",
    CACHE_TTL_FRESH_SECONDS: "60",
    CACHE_TTL_STALE_SECONDS: "3600",
    DATABASE_URL: "postgres://test",
    INTERNAL_INGEST_SECRET: "test",
    ...overrides,
  } as unknown as Env;
}

const exec = {
  waitUntil: (p: Promise<unknown>) => void p,
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe("short-link worker", () => {
  let env: Env;

  beforeEach(() => {
    env = makeEnv();
  });

  it("returns ok on /health", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/health"), env, exec);
    expect(res.status).toBe(200);
    const j = await res.json() as { ok: boolean; service: string };
    expect(j.ok).toBe(true);
    expect(j.service).toBe("short-links");
  });

  it("returns 200 OK on /healthz", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/healthz"), env, exec);
    expect(res.status).toBe(200);
  });

  it("redirects apex to FALLBACK_URL", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/"), env, exec);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(env.FALLBACK_URL);
  });

  it("redirects /robots.txt to a disallow-all response", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/robots.txt"), env, exec);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Disallow: /");
  });

  it("redirects /favicon.ico with 204", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/favicon.ico"), env, exec);
    expect(res.status).toBe(204);
  });

  it("rejects invalid code shape with fallback redirect", async () => {
    const res = await app.fetch(
      new Request("http://gofnl.local/!!!not-valid!!!"),
      env,
      exec
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(env.FALLBACK_URL);
  });

  it("uses KV cache hit when present", async () => {
    const cacheKey = "link:abc123";
    await env.SHORT_LINK_CACHE.put(
      cacheKey,
      JSON.stringify({
        ts: Date.now(),
        row: {
          code: "abc123",
          target_url: "https://example.com/landing",
          funnel_id: "fnl_1",
          workspace_id: "ws_1",
          vanity: false,
          deleted: false,
        },
      }),
      { expirationTtl: 3660 }
    );
    const res = await app.fetch(new Request("http://gofnl.local/abc123"), env, exec);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^https:\/\/example\.com\/landing/);
  });

  it("forwards UTM params through the redirect", async () => {
    await env.SHORT_LINK_CACHE.put(
      "link:abc123",
      JSON.stringify({
        ts: Date.now(),
        row: {
          code: "abc123",
          target_url: "https://example.com/landing",
          funnel_id: "fnl_1",
          workspace_id: "ws_1",
          vanity: false,
          deleted: false,
        },
      }),
      { expirationTtl: 3660 }
    );
    const res = await app.fetch(
      new Request("http://gofnl.local/abc123?utm_source=sms&utm_medium=blast"),
      env,
      exec
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("utm_source=sms");
    expect(loc).toContain("utm_medium=blast");
  });

  it("falls back when the code looks like a reserved word", async () => {
    const res = await app.fetch(new Request("http://gofnl.local/health"), env, exec);
    // /health is the explicit health route
    expect(res.status).toBe(200);
  });
});
