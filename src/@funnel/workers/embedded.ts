/**
 * Embedded workers entrypoint
 *
 * Lets the web service spawn BullMQ workers inside its own Node process,
 * so Railway only needs ONE service. Called by apps/web/src/instrumentation.ts.
 *
 * Same boot sequence as src/index.ts but skips the OS-signal graceful shutdown
 * handlers (the web server owns the process lifecycle) and the health server
 * (the web server has its own /api/healthz).
 *
 * Idempotent: safe to call multiple times; subsequent calls are no-ops.
 */

import { loadConfig } from "./config.js";
import { installCronJobs } from "./cron.js";
import { buildDlqWorker, defaultDlqSink } from "./dlq-handler.js";
import { initSentry, log } from "./monitoring.js";
import { createRedisConnection } from "./redis.js";
import { asWorkerList } from "./workers/index.js";

let started = false;

export async function startEmbeddedWorkers(): Promise<void> {
  if (started) {
    log.info("[embedded-workers] already started, skipping");
    return;
  }

  try {
    const config = loadConfig();
    initSentry(config);

    const conn = createRedisConnection(config);
    const workers = asWorkerList(conn, config);
    await installCronJobs(conn, config);

    const dlqWorker = buildDlqWorker(conn, config, defaultDlqSink);

    log.info({
      msg: "[embedded-workers] started",
      workerCount: workers.length,
      embedded: true,
    });

    started = true;
  } catch (err) {
    log.error({
      msg: "[embedded-workers] failed to start",
      err: err instanceof Error ? err.message : String(err),
    });
    // Don't throw — embedded workers are best-effort. Web should keep serving.
  }
}
