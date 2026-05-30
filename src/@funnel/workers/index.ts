/**
 * Workers service entrypoint.
 *
 * This is the long-running Node process deployed on Railway / Fly.io / Render.
 * It is *not* a Cloudflare Worker — it needs persistent TCP connections to
 * Redis + Postgres, BullMQ background scheduler threads, and OS signals. The
 * Cloudflare Workers runtime supports none of those.
 *
 * Boot sequence:
 *   1. Load + validate config (zod). Crash if env is bad.
 *   2. Init Sentry + Prom metrics.
 *   3. Open a shared Redis connection for liveness + idempotency.
 *   4. Lazy-connect Prisma (optional — depends on @funnel/db availability).
 *   5. Construct every worker (uses its own Redis connection internally).
 *   6. Install repeatable cron schedulers on Redis.
 *   7. Start the DLQ worker.
 *   8. Start the health server.
 *   9. Install graceful shutdown handlers.
 */

import { loadConfig } from "./config.js";
import { installCronJobs } from "./cron.js";
import { buildDlqWorker, defaultDlqSink } from "./dlq-handler.js";
import { installShutdownHandlers } from "./graceful-shutdown.js";
import { startHealthServer } from "./health.js";
import { initSentry, log } from "./monitoring.js";
import { createRedisConnection } from "./redis.js";
import { asWorkerList } from "./workers/index.js";

async function main(): Promise<void> {
  // 1. Config.
  const cfg = loadConfig();
  log("info", {
    msg: "workers service boot",
    env: cfg.NODE_ENV,
    region: cfg.REGION,
    release: cfg.RELEASE,
    host: cfg.HOSTNAME,
  });

  // 2. Sentry + Prom.
  initSentry();

  // 3. Shared Redis (for the health server's readiness probe).
  const probeRedis = createRedisConnection("probe");

  // 4. Optional Prisma.
  let disconnectDb: (() => Promise<void>) | undefined;
  let pingDb: (() => Promise<boolean>) | undefined;
  try {
    const db = (await import("@funnel/db")) as unknown as {
      prisma?: { $queryRaw: (s: TemplateStringsArray) => Promise<unknown>; $disconnect(): Promise<void> };
    };
    if (db.prisma) {
      pingDb = async () => {
        try {
          await db.prisma!.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      };
      disconnectDb = () => db.prisma!.$disconnect();
    }
  } catch (err) {
    log("warn", { msg: "@funnel/db not loaded — DB readiness skipped", error: (err as Error).message });
  }

  // 5. Workers.
  const workers = asWorkerList();
  log("info", { msg: "workers started", count: workers.length });

  // 6. Cron schedulers.
  await installCronJobs();

  // 7. DLQ worker.
  const dlq = buildDlqWorker(defaultDlqSink());
  workers.push(dlq);

  // 8. Health server.
  const healthServer = startHealthServer({ redis: probeRedis, pingDb });

  // 9. Graceful shutdown.
  installShutdownHandlers({ workers, healthServer, disconnectDb });

  log("info", { msg: "workers service ready", workers: workers.length });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "fatal", service: "workers", msg: "boot failed", error: (err as Error).message, stack: (err as Error).stack }));
  process.exit(1);
});
