/**
 * GET /api/readyz — readiness.
 *
 * 200 iff Postgres + Redis are both reachable. Used by Railway to gate
 * traffic during rollout; if /readyz returns 503 the container is kept
 * out of the load-balancer rotation.
 *
 * Both pings are dynamic-imported so an unreachable lib (e.g. Prisma
 * client not generated yet) cannot crash the liveness server.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function pingDb(): Promise<boolean> {
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

async function pingRedis(): Promise<boolean> {
  if (!process.env.REDIS_URL) return true; // web doesn't strictly require Redis
  try {
    const { Redis } = await import("ioredis");
    const r = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await r.connect();
      const pong = await r.ping();
      return pong === "PONG";
    } finally {
      r.disconnect();
    }
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const ok = db && redis;
  return new Response(
    JSON.stringify({ ok, service: "web", checks: { db, redis }, ts: new Date().toISOString() }),
    { status: ok ? 200 : 503, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
