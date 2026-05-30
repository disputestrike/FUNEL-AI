/**
 * Health + readiness routes for the renderer.
 *
 * Mount onto the Hono app:
 *   import { registerHealthRoutes } from "./health.js";
 *   registerHealthRoutes(app);
 *
 * Works in both the Cloudflare Workers runtime and the Node runtime
 * (Railway/Render). DB ping uses the @neondatabase/serverless driver
 * already wired in apps/renderer/src/lib/db.ts.
 */
import type { Hono } from "hono";

export function registerHealthRoutes(app: Hono): void {
  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "renderer",
      release: (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.RELEASE ?? "dev",
      ts: new Date().toISOString(),
    }),
  );

  app.get("/readyz", async (c) => {
    const checks = { db: false, redis: true };

    // DB ping — Neon serverless driver. Catches both connection + auth failures.
    try {
      const { sql } = (await import("./lib/db.js")) as unknown as {
        sql: (s: TemplateStringsArray) => Promise<unknown>;
      };
      await sql`SELECT 1`;
      checks.db = true;
    } catch {
      checks.db = false;
    }

    // Redis ping — only when running on Node (Railway/Render). Cloudflare
    // Workers has no Redis client and renderer relies on KV/D1 there.
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    if (env?.REDIS_URL) {
      try {
        const { Redis } = await import("ioredis");
        const r = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
        try {
          await r.connect();
          checks.redis = (await r.ping()) === "PONG";
        } finally {
          r.disconnect();
        }
      } catch {
        checks.redis = false;
      }
    }

    const ok = checks.db && checks.redis;
    return c.json({ ok, service: "renderer", checks, ts: new Date().toISOString() }, ok ? 200 : 503);
  });
}
