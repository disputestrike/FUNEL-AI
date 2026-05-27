/**
 * Worker construction helper.
 *
 * Every worker in this service follows the same lifecycle:
 *   1. Validate job data (zod).
 *   2. Claim idempotency key — bail if already processed.
 *   3. Emit `*_started` event (best-effort, never blocks the job).
 *   4. Run the handler.
 *   5. Emit `*_completed` event with duration + outcome.
 *   6. On terminal failure → route to DLQ.
 *
 * This module factors the shared scaffolding out so each individual worker
 * file stays focused on its business logic.
 */

import { Worker, type Job, type WorkerOptions } from "bullmq";
import type { z } from "zod";

import { loadConfig } from "./config.js";
import { routeToDlq } from "./dlq-handler.js";
import { claimIdempotencyKey, deriveIdempotencyKey } from "./idempotency.js";
import { instrumentJob, log } from "./monitoring.js";
import { QUEUE_REGISTRY, resolveConcurrency, type QueueName } from "./queues.js";
import { createRedisConnection } from "./redis.js";

export interface WorkerHandler<Schema extends z.ZodTypeAny, R> {
  /** Stable name (used for idempotency derivation + logging). */
  name: string;
  /** Zod schema for the job payload. */
  schema: Schema;
  /** Custom idempotency key extractor, otherwise we hash the payload. */
  idempotencyKey?: (data: z.infer<Schema>) => string;
  /** Business logic. */
  run(args: { job: Job<z.infer<Schema>>; data: z.infer<Schema> }): Promise<R>;
}

export interface BuildWorkerOpts {
  queue: QueueName;
  /** Override the registry concurrency for this worker instance only. */
  concurrency?: number;
  /** Extra BullMQ options (rateLimit, lockDuration, etc). */
  bullmq?: Partial<WorkerOptions>;
}

/**
 * Build a BullMQ Worker bound to `opts.queue` running `handler.run` for each
 * job. Wires idempotency, validation, instrumentation, structured logging,
 * and DLQ routing.
 */
export function buildWorker<Schema extends z.ZodTypeAny, R>(
  opts: BuildWorkerOpts,
  handler: WorkerHandler<Schema, R>,
): Worker<z.infer<Schema>, R | "skipped"> {
  const cfg = loadConfig();
  const concurrency =
    opts.concurrency ?? resolveConcurrency(opts.queue, cfg.CONCURRENCY_OVERRIDE);
  const redis = createRedisConnection(`worker:${opts.queue}`);

  const processor = instrumentJob<Job<z.infer<Schema>>, R | "skipped">(opts.queue, async (job) => {
    // 1. Validate.
    const parsed = handler.schema.safeParse(job.data);
    if (!parsed.success) {
      const err = new Error(`Invalid job payload: ${parsed.error.message}`);
      log("error", {
        msg: "job validation failed",
        queue: opts.queue,
        job_id: String(job.id),
        issues: parsed.error.flatten().fieldErrors,
      });
      throw err;
    }
    const data = parsed.data as z.infer<Schema>;

    // 2. Idempotency.
    const key = handler.idempotencyKey ? handler.idempotencyKey(data) : deriveIdempotencyKey(handler.name, data);
    const claimed = await claimIdempotencyKey(redis, `${opts.queue}:${key}`, 24 * 3600);
    if (!claimed) {
      log("info", {
        msg: "job is a duplicate (idempotent skip)",
        queue: opts.queue,
        job_id: String(job.id),
        idempotency_key: key,
      });
      return "skipped";
    }

    log("info", {
      msg: "job started",
      queue: opts.queue,
      job_id: String(job.id),
      job_name: handler.name,
      attempt: job.attemptsMade + 1,
    });

    const out = await handler.run({ job, data });

    log("info", {
      msg: "job completed",
      queue: opts.queue,
      job_id: String(job.id),
      job_name: handler.name,
    });
    return out;
  });

  const worker = new Worker<z.infer<Schema>, R | "skipped">(opts.queue, processor as never, {
    connection: redis,
    concurrency,
    ...(opts.bullmq ?? {}),
  });

  // Hang the handler onto the worker instance so tests can invoke it without
  // a live BullMQ + Redis. Marked as a typed brand to discourage prod use.
  (worker as unknown as { __handler: WorkerHandler<Schema, R> }).__handler = handler;

  worker.on("ready", () => log("info", { msg: "worker ready", queue: opts.queue, concurrency }));
  worker.on("error", (err) =>
    log("error", { msg: "worker error", queue: opts.queue, error: err.message }),
  );
  worker.on("failed", (job, err) => {
    if (!job) return;
    void routeToDlq(opts.queue, job, err).catch((routingErr) => {
      log("error", {
        msg: "failed to route job to DLQ",
        queue: opts.queue,
        job_id: String(job.id),
        error: (routingErr as Error).message,
      });
    });
  });

  return worker;
}

/** Test helper: extract the handler object from a worker built by buildWorker. */
export function getHandlerForTests<Schema extends z.ZodTypeAny, R>(
  worker: Worker<z.infer<Schema>, R | "skipped">,
): WorkerHandler<Schema, R> {
  return (worker as unknown as { __handler: WorkerHandler<Schema, R> }).__handler;
}
