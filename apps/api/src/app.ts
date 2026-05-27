/**
 * Hono app factory.
 *
 * Builds the API app with every route + middleware mounted. Used by:
 *   - src/index.ts        (Cloudflare Workers fetch handler â€” legacy)
 *   - src/server.ts       (Node runtime entrypoint â€” Railway/Render)
 *
 * Mounting /healthz + /readyz here (not just in src/server.ts) means the
 * Workers build also exposes the same probes; ops can curl them on either
 * runtime.
 */
import { Hono } from "hono";
import { publicApi } from "./public-api/index.js";

export interface AppDeps {
  /** Optional DB ping wrapper â€” defaults to importing @funnel/db. */
  pingDb?: () => Promise<boolean>;
  /** Optional Redis ping wrapper â€” defaults to ioredis on REDIS_URL. */
  pingRedis?: () => Promise<boolean>;
}

export function createApp(deps: AppDeps = {}): Hono {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "api",
      release: (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.RELEASE ?? "dev",
      ts: new Date().toISOString(),
    }),
  );

  app.get("/readyz", async (c) => {
    const [db, redis] = await Promise.all([
      (deps.pingDb ?? defaultPingDb)(),
      (deps.pingRedis ?? defaultPingRedis)(),
    ]);
    const ok = db && redis;
    return c.json({ ok, service: "api", checks: { db, redis }, ts: new Date().toISOString() }, ok ? 200 : 503);
  });

  // Public REST API â€” Bearer-key authenticated, available at api.gofunnelai.com/v1.
  // tRPC + webhooks + OAuth are mounted by their own integrations.
  app.route("/v1", publicApi);

  return app;
}

async function defaultPingDb(): Promise<boolean> {
  try {
    const mod = (await import("@funnel/db")) as unknown as {
      prisma?: { $queryRaw: (s: TemplateStringsArray) => Promise<unknown> };
    };
    if (!mod.prisma) return false;
    await mod.prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function defaultPingRedis(): Promise<boolean> {
  const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  if (!env?.REDIS_URL) return false;
  try {
    const { Redis } = await import("ioredis");
    const r = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await r.connect();
      return (await r.ping()) === "PONG";
    } finally {
      r.disconnect();
    }
  } catch {
    return false;
  }
}
