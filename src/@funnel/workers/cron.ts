/**
 * Cron scheduling.
 *
 * We use BullMQ's "repeatable jobs" feature to drive every cron in this
 * service. That means cron state lives in Redis (not in this process), so a
 * rolling deploy that bounces every worker pod does not skip a tick — the new
 * pod picks up the next scheduled run.
 *
 * Defining a job as a JobScheduler (BullMQ v5+) means BullMQ guarantees
 * exactly-one-emission semantics across replicas. We name each scheduler
 * deterministically so we can also `removeJobScheduler` on graceful redeploys
 * if the cron expression changes.
 */

import type { Queue } from "bullmq";

import { log } from "./monitoring.js";
import { getQueue, type QueueName } from "./queues.js";

export interface CronDef {
  /** Logical cron id; doubles as the BullMQ job-scheduler key. */
  id: string;
  /** Target queue. */
  queue: QueueName;
  /** Cron expression in standard 5-field syntax, UTC. */
  cron: string;
  /** Job name used inside the target queue. */
  jobName: string;
  /** Static payload (workers ignore data on most crons but we pass an id). */
  data?: Record<string, unknown>;
}

export const CRON_JOBS: CronDef[] = [
  // Dunning — hourly
  {
    id: "dunning-hourly",
    queue: "dunning",
    cron: "0 * * * *",
    jobName: "dunning.advance",
    data: { trigger: "cron" },
  },
  // Activation interventions — hourly
  {
    id: "activation-hourly",
    queue: "activation",
    cron: "5 * * * *",
    jobName: "activation.run-interventions",
  },
  // KB ingestion — daily 02:00 UTC
  {
    id: "ingestion-daily",
    queue: "ingestion",
    cron: "0 2 * * *",
    jobName: "ingestion.daily-cycle",
  },
  // Reconciliation — hourly (offset to keep clocks unsynchronised)
  {
    id: "reconciliation-hourly",
    queue: "reconciliation",
    cron: "15 * * * *",
    jobName: "reconciliation.run",
  },
  // Bias audit — quarterly (1st of Jan/Apr/Jul/Oct, 04:00 UTC).
  {
    id: "bias-audit-quarterly",
    queue: "bias-audit",
    cron: "0 4 1 1,4,7,10 *",
    jobName: "bias-audit.run",
  },
  // Backups restore drill — monthly, 1st of month, 05:00 UTC.
  {
    id: "backups-restore-drill-monthly",
    queue: "backups-restore-drill",
    cron: "0 5 1 * *",
    jobName: "backups.restore-drill",
  },
  // Domain reputation — monthly, 5th of month, 06:00 UTC.
  {
    id: "domain-reputation-monthly",
    queue: "domain-reputation",
    cron: "0 6 5 * *",
    jobName: "domain-reputation.scan",
  },
  // Model-version promote — monthly, 10th of month, 07:00 UTC.
  {
    id: "model-version-promote-monthly",
    queue: "model-version-promote",
    cron: "0 7 10 * *",
    jobName: "model-version.promote",
  },
  // Card-expiring alerts — daily, 09:00 UTC.
  {
    id: "card-expiring-alerts-daily",
    queue: "card-expiring-alerts",
    cron: "0 9 * * *",
    jobName: "card-expiring.alerts",
  },
  // Recursive learning — nightly 03:00 UTC.
  {
    id: "recursive-learning-nightly",
    queue: "recursive-learning",
    cron: "0 3 * * *",
    jobName: "recursive-learning.aggregate",
  },
];

export async function installCronJobs(): Promise<void> {
  for (const cron of CRON_JOBS) {
    const queue: Queue = getQueue(cron.queue);
    await queue.upsertJobScheduler(
      cron.id,
      { pattern: cron.cron, tz: "UTC" },
      {
        name: cron.jobName,
        data: cron.data ?? {},
        opts: {
          removeOnComplete: { age: 7 * 24 * 3600 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      },
    );
    log("info", {
      msg: "cron job installed",
      id: cron.id,
      cron: cron.cron,
      queue: cron.queue,
    });
  }
}

/** Used by tests + deploy hooks that want a clean slate. */
export async function clearCronJobs(): Promise<void> {
  for (const cron of CRON_JOBS) {
    await getQueue(cron.queue)
      .removeJobScheduler(cron.id)
      .catch(() => undefined);
  }
}
