/**
 * Observability — Sentry + Prometheus + structured logger.
 *
 * Sentry captures unhandled errors + Worker job failures. Prom-client exposes
 * jobs_processed / jobs_failed / queue_depth / latency histograms scraped by
 * Grafana Cloud on /metrics. The logger is plain JSON to stdout — Datadog Logs
 * picks it up via the agent on the host.
 */

import * as Sentry from "@sentry/node";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

import { loadConfig } from "./config.js";
import { QUEUE_NAMES, type QueueName } from "./queues.js";

// ---------- Prometheus -------------------------------------------------------

export const promRegistry = new Registry();
promRegistry.setDefaultLabels({ service: "workers" });
collectDefaultMetrics({ register: promRegistry });

export const jobsProcessed = new Counter({
  name: "funnel_workers_jobs_processed_total",
  help: "Total jobs processed by a worker, labeled by queue + outcome.",
  labelNames: ["queue", "outcome"],
  registers: [promRegistry],
});

export const jobsRetried = new Counter({
  name: "funnel_workers_jobs_retried_total",
  help: "Total jobs that triggered a retry (non-terminal failure).",
  labelNames: ["queue"],
  registers: [promRegistry],
});

export const jobsDeadLettered = new Counter({
  name: "funnel_workers_jobs_dead_lettered_total",
  help: "Total jobs routed to the DLQ after exhausting retries.",
  labelNames: ["queue", "reason"],
  registers: [promRegistry],
});

export const queueDepth = new Gauge({
  name: "funnel_workers_queue_depth",
  help: "Current depth (waiting + active + delayed) per queue.",
  labelNames: ["queue", "state"],
  registers: [promRegistry],
});

export const jobLatency = new Histogram({
  name: "funnel_workers_job_latency_ms",
  help: "Wall-clock latency per job, in milliseconds.",
  labelNames: ["queue", "outcome"],
  buckets: [10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000, 120_000, 300_000],
  registers: [promRegistry],
});

export const llmCostUsd = new Counter({
  name: "funnel_workers_llm_cost_usd_total",
  help: "Cumulative LLM spend in USD (micro-dollars summed → USD).",
  labelNames: ["queue", "provider", "model"],
  registers: [promRegistry],
});

export const cronLastRunUnix = new Gauge({
  name: "funnel_workers_cron_last_run_unix_seconds",
  help: "Unix timestamp of the last successful run per cron job. 0 = never.",
  labelNames: ["cron"],
  registers: [promRegistry],
});

// Pre-seed the queue label set so missing queues stand out as 0, not absent.
for (const q of QUEUE_NAMES) {
  for (const state of ["waiting", "active", "delayed", "failed"] as const) {
    queueDepth.set({ queue: q, state }, 0);
  }
}

// ---------- Sentry ----------------------------------------------------------

let sentryInited = false;

export function initSentry(): void {
  if (sentryInited) return;
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;
  Sentry.init({
    dsn: cfg.SENTRY_DSN,
    environment: cfg.NODE_ENV,
    release: cfg.RELEASE,
    tracesSampleRate: cfg.SENTRY_TRACES_SAMPLE_RATE,
    // PII protection — see 03-event-taxonomy §A.0. We strip user fields in the
    // beforeSend hook because BullMQ job payloads can contain identifiers we
    // don't want in error reports verbatim.
    sendDefaultPii: false,
    beforeSend(event) {
      delete (event as { user?: unknown }).user;
      return event;
    },
  });
  sentryInited = true;
}

export function captureWorkerError(err: unknown, ctx: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(ctx)) scope.setExtra(k, v);
    Sentry.captureException(err);
  });
}

// ---------- Structured logger -----------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogFields {
  msg: string;
  queue?: QueueName | "system";
  job_id?: string;
  trace_id?: string;
  tenant_id_hash?: string;
  [k: string]: unknown;
}

export function log(level: LogLevel, fields: LogFields): void {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    service: "workers",
    ...fields,
  };
  // eslint-disable-next-line no-console
  (level === "error" || level === "fatal" ? console.error : console.log)(JSON.stringify(line));
}

// ---------- Helpers ---------------------------------------------------------

/**
 * Wrap a worker `process` callback to record latency, counter, and Sentry
 * capture on exceptions. The callback receives the job and must return its
 * eventual result.
 */
export function instrumentJob<Job, Result>(
  queue: QueueName,
  fn: (job: Job) => Promise<Result>,
): (job: Job) => Promise<Result> {
  return async (job) => {
    const start = Date.now();
    try {
      const out = await fn(job);
      const ms = Date.now() - start;
      jobsProcessed.inc({ queue, outcome: "ok" });
      jobLatency.observe({ queue, outcome: "ok" }, ms);
      return out;
    } catch (err) {
      const ms = Date.now() - start;
      jobsProcessed.inc({ queue, outcome: "fail" });
      jobLatency.observe({ queue, outcome: "fail" }, ms);
      captureWorkerError(err, { queue });
      throw err;
    }
  };
}
