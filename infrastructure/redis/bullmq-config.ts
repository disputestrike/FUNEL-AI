/**
 * BullMQ connection + queue config — consumed by @funnel/workers.
 *
 * Why we keep this in infrastructure/ instead of inside @funnel/workers:
 *   the same connection config is needed by tests, by ad-hoc scripts, and by
 *   the api-side producers. Keeping it here gives us one source of truth.
 */

import type { ConnectionOptions, QueueOptions, WorkerOptions } from "bullmq";

export type QueueName =
  | "generation-runner"
  | "ads-publisher"
  | "email-sender"
  | "sms-sender"
  | "webhook-processing"
  | "activation-interventions"
  | "billing-dunning"
  | "revtry-speed-to-lead"
  | "lead-capture"
  | "analytics-conversions";

export interface RedisEnv {
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_PORT?: string;
  UPSTASH_REDIS_PASSWORD: string;
  REDIS_TLS?: string;
  NODE_ENV?: string;
}

/**
 * Build a BullMQ connection options object from environment.
 *
 * Upstash native (RESP) endpoints are what BullMQ requires; the REST endpoint
 * is used elsewhere for Worker-friendly access but BullMQ needs a TCP socket.
 */
export function buildConnection(env: RedisEnv): ConnectionOptions {
  const port = env.UPSTASH_REDIS_PORT ? Number(env.UPSTASH_REDIS_PORT) : 6379;
  return {
    host: env.UPSTASH_REDIS_URL,
    port,
    password: env.UPSTASH_REDIS_PASSWORD,
    tls: env.REDIS_TLS === "false" ? undefined : {},
    // Upstash recommends keepAlive on long-running consumers.
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    // Connection-pool tuning. We want a small per-process pool because
    // BullMQ already pipelines aggressively and Upstash bills by command.
    connectTimeout: 10_000,
    keepAlive: 10_000,
  };
}

/**
 * Per-queue defaults. These mirror the cloudflare/queues.toml manifest so
 * BullMQ workers and Cloudflare Queues consumers behave consistently when we
 * run the same job logic in both environments.
 */
const COMMON: Partial<QueueOptions> = {
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  },
};

export const QUEUE_DEFAULTS: Record<QueueName, Partial<QueueOptions>> = {
  "generation-runner": {
    ...COMMON,
    defaultJobOptions: { ...COMMON.defaultJobOptions, attempts: 3 },
  },
  "ads-publisher": COMMON,
  "email-sender": COMMON,
  "sms-sender": {
    ...COMMON,
    defaultJobOptions: { ...COMMON.defaultJobOptions, attempts: 4 },
  },
  "webhook-processing": COMMON,
  "activation-interventions": {
    ...COMMON,
    defaultJobOptions: { ...COMMON.defaultJobOptions, attempts: 4 },
  },
  "billing-dunning": {
    ...COMMON,
    defaultJobOptions: { ...COMMON.defaultJobOptions, attempts: 4 },
  },
  "revtry-speed-to-lead": {
    ...COMMON,
    defaultJobOptions: { ...COMMON.defaultJobOptions, attempts: 6 },
  },
  "lead-capture": COMMON,
  "analytics-conversions": COMMON,
};

/**
 * Concurrency tuned per queue. Generation is single-flight per worker pod
 * (each job pulls real LLM tokens; pipelining doesn't help and risks throttle).
 */
export const WORKER_CONCURRENCY: Record<QueueName, number> = {
  "generation-runner": 1,
  "ads-publisher": 4,
  "email-sender": 16,
  "sms-sender": 12,
  "webhook-processing": 32,
  "activation-interventions": 8,
  "billing-dunning": 4,
  "revtry-speed-to-lead": 8,
  "lead-capture": 32,
  "analytics-conversions": 32,
};

export function buildWorkerOptions(
  queue: QueueName,
  env: RedisEnv,
  overrides: Partial<WorkerOptions> = {},
): WorkerOptions {
  return {
    connection: buildConnection(env),
    concurrency: WORKER_CONCURRENCY[queue],
    // Stalled-job detection — important for long generation runs.
    stalledInterval: 30_000,
    maxStalledCount: 2,
    // Prevent a single worker from grabbing more than it can chew when the
    // queue is hot. BullMQ default lock duration is 30s; we extend for the
    // long-running generation pipeline.
    lockDuration: queue === "generation-runner" ? 180_000 : 30_000,
    ...overrides,
  };
}

export function buildQueueOptions(
  queue: QueueName,
  env: RedisEnv,
): QueueOptions {
  return {
    connection: buildConnection(env),
    prefix: env.NODE_ENV === "production" ? "funnel:prod" : "funnel:staging",
    ...QUEUE_DEFAULTS[queue],
  };
}
