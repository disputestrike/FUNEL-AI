/**
 * Queue catalog.
 *
 * Defines every BullMQ queue this service operates, plus the per-queue defaults
 * (priority, retry, backoff, removeOnComplete/Fail) that we want enforced
 * regardless of which producer drops a job. Producers can override per-job, but
 * the defaults below are the contract.
 *
 * Priority numeric scale: BullMQ treats lower numbers as higher priority.
 * - 1 = highest (generation, speed-to-lead)
 * - 5 = high (ad-publishing, email, sms, webhooks, dunning, activation,
 *             ts-classifier)
 * - 10 = normal (ingestion, reconciliation, analytics)
 * - 20 = low/background (bias-audit, backups-restore-drill,
 *                       domain-reputation, model-version-promote,
 *                       recursive-learning, card-expiring-alerts)
 */

import { Queue, QueueEvents, type DefaultJobOptions, type JobsOptions } from "bullmq";

import { createRedisConnection } from "./redis.js";

export const QUEUE_NAMES = [
  "generation",
  "ad-publishing",
  "email",
  "sms",
  "webhooks-outbound",
  "speed-to-lead",
  "dunning",
  "activation",
  "ingestion",
  "reconciliation",
  "bias-audit",
  "analytics",
  "ts-classifier",
  "backups-restore-drill",
  "domain-reputation",
  "model-version-promote",
  "recursive-learning",
  "card-expiring-alerts",
  "dlq",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export interface QueueDef {
  name: QueueName;
  /** Default per-worker concurrency. */
  concurrency: number;
  /** Default jobs options applied to every push, unless overridden. */
  defaultJobOptions: DefaultJobOptions;
}

const exp = (delayMs: number): JobsOptions["backoff"] => ({ type: "exponential", delay: delayMs });
const fixed = (delayMs: number): JobsOptions["backoff"] => ({ type: "fixed", delay: delayMs });

export const QUEUE_REGISTRY: Record<QueueName, QueueDef> = {
  generation: {
    name: "generation",
    concurrency: 20,
    defaultJobOptions: {
      attempts: 3,
      priority: 1, // highest
      backoff: exp(15_000),
      removeOnComplete: { age: 24 * 3600, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
  "ad-publishing": {
    name: "ad-publishing",
    concurrency: 10,
    defaultJobOptions: {
      attempts: 5,
      priority: 5,
      backoff: exp(60_000),
      removeOnComplete: { age: 7 * 24 * 3600, count: 5_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  email: {
    name: "email",
    concurrency: 50,
    defaultJobOptions: {
      attempts: 3,
      priority: 5,
      backoff: exp(30_000),
      removeOnComplete: { age: 24 * 3600, count: 10_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
  sms: {
    name: "sms",
    concurrency: 30,
    defaultJobOptions: {
      attempts: 3,
      priority: 5,
      backoff: exp(30_000),
      removeOnComplete: { age: 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  "webhooks-outbound": {
    name: "webhooks-outbound",
    concurrency: 50,
    defaultJobOptions: {
      attempts: 5,
      priority: 5,
      // Custom schedule 1m / 5m / 30m / 2h / 12h is computed at enqueue time
      // by the worker (see workers/webhooks-outbound.ts). We seed with the
      // first delay; subsequent attempts override via job.opts.delay.
      backoff: fixed(60_000),
      removeOnComplete: { age: 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  "speed-to-lead": {
    name: "speed-to-lead",
    concurrency: 100,
    defaultJobOptions: {
      attempts: 3,
      priority: 1, // tied for highest — leads decay in seconds
      backoff: exp(5_000),
      removeOnComplete: { age: 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  dunning: {
    name: "dunning",
    concurrency: 10,
    defaultJobOptions: {
      attempts: 5,
      priority: 5,
      backoff: exp(5 * 60_000),
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 90 * 24 * 3600 },
    },
  },
  activation: {
    name: "activation",
    concurrency: 20,
    defaultJobOptions: {
      attempts: 3,
      priority: 5,
      backoff: exp(60_000),
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  ingestion: {
    name: "ingestion",
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      priority: 10,
      backoff: exp(5 * 60_000),
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  reconciliation: {
    name: "reconciliation",
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      priority: 10,
      backoff: exp(2 * 60_000),
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  "bias-audit": {
    name: "bias-audit",
    concurrency: 2,
    defaultJobOptions: {
      attempts: 1,
      priority: 20,
      removeOnComplete: { age: 90 * 24 * 3600 },
      removeOnFail: { age: 365 * 24 * 3600 },
    },
  },
  analytics: {
    name: "analytics",
    concurrency: 20,
    defaultJobOptions: {
      attempts: 3,
      priority: 10,
      backoff: exp(15_000),
      removeOnComplete: { age: 6 * 3600, count: 20_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
  "ts-classifier": {
    name: "ts-classifier",
    concurrency: 10,
    defaultJobOptions: {
      attempts: 3,
      priority: 5,
      backoff: exp(15_000),
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
  "backups-restore-drill": {
    name: "backups-restore-drill",
    concurrency: 1,
    defaultJobOptions: {
      attempts: 1,
      priority: 20,
      removeOnComplete: { age: 365 * 24 * 3600 },
      removeOnFail: { age: 365 * 24 * 3600 },
    },
  },
  "domain-reputation": {
    name: "domain-reputation",
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      priority: 20,
      backoff: exp(60_000),
      removeOnComplete: { age: 30 * 24 * 3600 },
      removeOnFail: { age: 90 * 24 * 3600 },
    },
  },
  "model-version-promote": {
    name: "model-version-promote",
    concurrency: 1,
    defaultJobOptions: {
      attempts: 1,
      priority: 20,
      removeOnComplete: { age: 365 * 24 * 3600 },
      removeOnFail: { age: 365 * 24 * 3600 },
    },
  },
  "recursive-learning": {
    name: "recursive-learning",
    concurrency: 1,
    defaultJobOptions: {
      attempts: 1,
      priority: 20,
      removeOnComplete: { age: 90 * 24 * 3600 },
      removeOnFail: { age: 365 * 24 * 3600 },
    },
  },
  "card-expiring-alerts": {
    name: "card-expiring-alerts",
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      priority: 20,
      backoff: exp(60_000),
      removeOnComplete: { age: 30 * 24 * 3600 },
      removeOnFail: { age: 90 * 24 * 3600 },
    },
  },
  dlq: {
    name: "dlq",
    concurrency: 5,
    defaultJobOptions: {
      attempts: 1,
      priority: 20,
      // DLQ jobs are kept indefinitely for forensic + manual replay. We retain
      // by count rather than age so a quiet incident week doesn't expire the
      // last evidence of a regression.
      removeOnComplete: { count: 50_000 },
      removeOnFail: { count: 50_000 },
    },
  },
};

const queueCache = new Map<QueueName, Queue>();
const eventsCache = new Map<QueueName, QueueEvents>();

/**
 * Returns the singleton Queue instance for `name`, lazy-creating it on first
 * call. Producer code (workers + cron schedulers + the API) goes through this
 * to ensure every enqueue inherits the registry defaults.
 */
export function getQueue(name: QueueName): Queue {
  const existing = queueCache.get(name);
  if (existing) return existing;
  const def = QUEUE_REGISTRY[name];
  const queue = new Queue(name, {
    connection: createRedisConnection(`queue:${name}`),
    defaultJobOptions: def.defaultJobOptions,
  });
  queueCache.set(name, queue);
  return queue;
}

/** QueueEvents instance, used by the API / admin console to await results. */
export function getQueueEvents(name: QueueName): QueueEvents {
  const existing = eventsCache.get(name);
  if (existing) return existing;
  const qe = new QueueEvents(name, { connection: createRedisConnection(`events:${name}`) });
  eventsCache.set(name, qe);
  return qe;
}

/** Resolved concurrency for `name`, honouring CONCURRENCY_OVERRIDE env. */
export function resolveConcurrency(name: QueueName, override: Record<string, number>): number {
  const fromEnv = override[name];
  if (typeof fromEnv === "number" && fromEnv > 0) return fromEnv;
  return QUEUE_REGISTRY[name].concurrency;
}

/** Close all queue + queue-events handles. Used by graceful-shutdown. */
export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled([
    ...Array.from(queueCache.values()).map((q) => q.close().catch(() => undefined)),
    ...Array.from(eventsCache.values()).map((e) => e.close().catch(() => undefined)),
  ]);
  queueCache.clear();
  eventsCache.clear();
}
