/**
 * Dead-letter queue handling.
 *
 * Two pieces:
 *   1. `routeToDlq()` — used by every other worker's `failed` handler to push
 *      terminally-failed jobs to the DLQ with full context (original queue,
 *      attempt count, last error, original data).
 *   2. `buildDlqWorker()` — the worker that pops DLQ entries, writes them to
 *      the `dead_letter_jobs` table in Postgres for the admin console replay
 *      tool, and fires a PagerDuty alert if depth exceeds a threshold.
 */

import { Worker, type Job, type Queue } from "bullmq";

import { instrumentJob, jobsDeadLettered, log } from "./monitoring.js";
import { QUEUE_REGISTRY, getQueue, type QueueName } from "./queues.js";
import { createRedisConnection } from "./redis.js";

export interface DlqEntry {
  /** ULID of the DLQ record. Drives the admin console row. */
  dlq_id: string;
  origin_queue: QueueName;
  origin_job_id: string;
  origin_job_name: string;
  original_data: unknown;
  attempts_made: number;
  failed_reason: string;
  stack: string | null;
  failed_at: string;
  /** Optional tenant tag — admins filter by workspace. */
  workspace_id?: string | null;
}

/** Page on-call if DLQ grows fast. Configured per the alerting matrix. */
const DLQ_PAGE_THRESHOLD = 100;

/**
 * Sink a failed job into the DLQ. Idempotent: BullMQ may invoke `failed`
 * multiple times during retries, so we only route when attemptsMade >=
 * attempts (i.e. terminal failure).
 */
export async function routeToDlq(originQueue: QueueName, job: Job, err: Error): Promise<void> {
  const def = QUEUE_REGISTRY[originQueue];
  const maxAttempts = (job.opts.attempts ?? def.defaultJobOptions.attempts ?? 1) as number;
  if (job.attemptsMade < maxAttempts) {
    // Not terminal — let BullMQ retry.
    return;
  }
  const entry: DlqEntry = {
    dlq_id: `dlq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    origin_queue: originQueue,
    origin_job_id: String(job.id ?? "unknown"),
    origin_job_name: job.name,
    original_data: job.data,
    attempts_made: job.attemptsMade,
    failed_reason: err.message,
    stack: err.stack ?? null,
    failed_at: new Date().toISOString(),
    workspace_id: (job.data as { workspace_id?: string })?.workspace_id ?? null,
  };
  await getQueue("dlq").add("dead-letter", entry, {
    jobId: entry.dlq_id,
    removeOnComplete: { count: 50_000 },
  });
  jobsDeadLettered.inc({ queue: originQueue, reason: classifyFailure(err) });
  log("warn", {
    msg: "job routed to DLQ",
    queue: originQueue,
    job_id: String(job.id),
    attempts: job.attemptsMade,
    reason: err.message.slice(0, 200),
  });
}

function classifyFailure(err: Error): string {
  const m = err.message.toLowerCase();
  if (m.includes("timeout")) return "timeout";
  if (m.includes("rate limit") || m.includes("429")) return "rate_limit";
  if (m.includes("validation") || m.includes("zod")) return "validation";
  if (m.includes("unauth") || m.includes("401") || m.includes("403")) return "auth";
  if (m.includes("not found") || m.includes("404")) return "not_found";
  return "unknown";
}

/**
 * Hook into the DB via the provided sink (decoupled so tests can swap it).
 */
export interface DlqSink {
  recordDeadLetter(entry: DlqEntry): Promise<void>;
  pageOnCallHighDepth(depth: number): Promise<void>;
}

export function buildDlqWorker(sink: DlqSink): Worker<DlqEntry> {
  const concurrency = QUEUE_REGISTRY.dlq.concurrency;
  return new Worker<DlqEntry>(
    "dlq",
    instrumentJob<Job<DlqEntry>, void>("dlq", async (job) => {
      await sink.recordDeadLetter(job.data);
    }) as never,
    {
      connection: createRedisConnection("worker:dlq"),
      concurrency,
    },
  )
    .on("ready", () => log("info", { msg: "worker ready", queue: "dlq" }))
    .on("error", (err) => log("error", { msg: "dlq worker error", error: err.message }))
    .on("completed", async (_job: Job<DlqEntry>, _result, _prev) => {
      // After every DLQ record we evaluate depth. Cheap check (LLEN).
      try {
        const queue: Queue = getQueue("dlq");
        const counts = await queue.getJobCounts("waiting", "delayed", "active");
        const depth = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
        if (depth > DLQ_PAGE_THRESHOLD) {
          await sink.pageOnCallHighDepth(depth);
        }
      } catch (err) {
        log("error", { msg: "dlq depth check failed", error: (err as Error).message });
      }
    });
}

/** Default sink implementation — writes to Postgres + logs the page intent. */
export function defaultDlqSink(): DlqSink {
  return {
    async recordDeadLetter(entry) {
      // We dynamically import @funnel/db inside the sink so unit tests can
      // swap this whole sink without paying for Prisma client init.
      const db = await import("@funnel/db").catch(() => null);
      const prisma = (db as { prisma?: unknown })?.prisma;
      if (prisma && typeof (prisma as { deadLetterJob?: unknown }).deadLetterJob === "object") {
        await (
          prisma as {
            deadLetterJob: { create(args: { data: unknown }): Promise<unknown> };
          }
        ).deadLetterJob.create({ data: entry });
      } else {
        log("info", { msg: "dlq sink (no DB) recording entry", entry: entry.dlq_id });
      }
    },
    async pageOnCallHighDepth(depth) {
      // Real impl posts to PagerDuty via @funnel/notifications. The logged
      // event is also picked up by Datadog log-based alerting as a backup.
      log("error", {
        msg: "DLQ_PAGE_ALERT",
        alert: "dlq_depth_threshold",
        depth,
        threshold: DLQ_PAGE_THRESHOLD,
      });
    },
  };
}
