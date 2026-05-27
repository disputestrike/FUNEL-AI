/**
 * Graceful shutdown coordination.
 *
 * SIGTERM (Railway / Fly / Render send this on deploy + scale events):
 *   1. Stop pulling new jobs from every Worker.
 *   2. Wait up to SHUTDOWN_DRAIN_TIMEOUT_MS for in-flight jobs to finish.
 *   3. Close every Queue + QueueEvents handle.
 *   4. Close the health server.
 *   5. Close Redis connections.
 *   6. Flush Sentry.
 *   7. exit(0)
 *
 * If a worker job exceeds the drain timeout, BullMQ will mark it stalled and
 * the new instance will retry it — that's a designed property of the queue.
 */

import { close as sentryClose } from "@sentry/node";
import type { Server } from "node:http";
import type { Worker } from "bullmq";

import { loadConfig } from "./config.js";
import { log } from "./monitoring.js";
import { closeAllQueues } from "./queues.js";
import { closeAllRedis } from "./redis.js";

export interface ShutdownTargets {
  workers: Worker[];
  healthServer?: Server;
  /** Optional DB disconnect — wired by entrypoint when Prisma is created. */
  disconnectDb?: () => Promise<void>;
}

let installed = false;
let shuttingDown = false;

/**
 * Drain a single worker. We do NOT call `.close(force=true)` — we want
 * already-running jobs to finish. BullMQ resolves `.close()` once they do or
 * once the connection is severed.
 */
async function drainWorker(worker: Worker, timeoutMs: number): Promise<void> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(() => {
      log("warn", { msg: "worker drain timeout — forcing close", queue: worker.name as never });
      resolve();
    }, timeoutMs);
  });
  try {
    await Promise.race([worker.close(), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function performShutdown(targets: ShutdownTargets, signal: string): Promise<void> {
  if (shuttingDown) {
    log("warn", { msg: "shutdown already in progress, ignoring signal", signal });
    return;
  }
  shuttingDown = true;
  const cfg = loadConfig();
  log("info", { msg: "shutdown initiated", signal, workers: targets.workers.length });

  // 1. Stop pulling new jobs (BullMQ exposes pause for this).
  await Promise.allSettled(targets.workers.map((w) => w.pause(true).catch(() => undefined)));

  // 2. Drain — wait up to SHUTDOWN_DRAIN_TIMEOUT_MS total.
  const drainDeadline = Date.now() + cfg.SHUTDOWN_DRAIN_TIMEOUT_MS;
  await Promise.allSettled(
    targets.workers.map((w) => drainWorker(w, Math.max(1_000, drainDeadline - Date.now()))),
  );

  // 3. Close queue handles.
  await closeAllQueues();

  // 4. Health server.
  if (targets.healthServer) {
    await new Promise<void>((resolve) => targets.healthServer!.close(() => resolve()));
  }

  // 5. Redis.
  await closeAllRedis();

  // 6. DB.
  if (targets.disconnectDb) {
    await targets.disconnectDb().catch(() => undefined);
  }

  // 7. Sentry.
  await sentryClose(2_000).catch(() => undefined);

  log("info", { msg: "shutdown complete" });
}

/**
 * Install POSIX signal handlers + `unhandledRejection`/`uncaughtException`
 * fallbacks. Call once at boot.
 */
export function installShutdownHandlers(targets: ShutdownTargets): void {
  if (installed) return;
  installed = true;

  const onSignal = (sig: NodeJS.Signals) => {
    void (async () => {
      try {
        await performShutdown(targets, sig);
        process.exit(0);
      } catch (err) {
        log("fatal", { msg: "shutdown error", error: (err as Error).message });
        process.exit(1);
      }
    })();
  };

  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);

  process.on("unhandledRejection", (reason) => {
    log("error", { msg: "unhandledRejection", reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    log("fatal", { msg: "uncaughtException", error: err.message, stack: err.stack });
    // Crash — orchestrator restart > undefined process state.
    void performShutdown(targets, "uncaughtException").finally(() => process.exit(1));
  });
}
