/**
 * Backups + restore drill (monthly cron).
 *
 * Validates the disaster-recovery story:
 *   - RPO target: 1 hour
 *   - RTO target: 4 hours
 *
 * Procedure:
 *   1. Trigger a backup snapshot.
 *   2. Spin up an ephemeral restore-test cluster.
 *   3. Restore the latest backup to it.
 *   4. Run a smoke suite (row counts, RLS checks, sample queries).
 *   5. Emit a governance event with the measured RPO + RTO.
 *   6. Tear down the test cluster.
 *
 * The heavy lifting is in @funnel/db.backups — this worker is the
 * orchestration shell.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const BackupDrillJobSchema = z.object({
  trigger: z.enum(["cron", "manual"]).default("cron"),
});

interface BackupModule {
  runRestoreDrill(): Promise<{
    drill_id: string;
    rpo_seconds: number;
    rto_seconds: number;
    backup_id: string;
    smoke_passed: boolean;
    issues: string[];
  }>;
}

const RPO_MAX_SECONDS = 60 * 60; // 1h
const RTO_MAX_SECONDS = 4 * 60 * 60; // 4h

export const backupsRestoreDrillWorker = buildWorker(
  { queue: "backups-restore-drill", concurrency: 1 },
  {
    name: "backups.restore-drill",
    schema: BackupDrillJobSchema,
    idempotencyKey: () => `backup-drill:${new Date().toISOString().slice(0, 7)}`,
    async run() {
      emitInternal("backup_drill_started", {});
      const mod = (await import("@funnel/db")) as unknown as BackupModule;
      const result = await mod.runRestoreDrill();

      const rpoMet = result.rpo_seconds <= RPO_MAX_SECONDS;
      const rtoMet = result.rto_seconds <= RTO_MAX_SECONDS;
      const sla_met = rpoMet && rtoMet && result.smoke_passed;

      if (!sla_met) {
        log("error", {
          msg: "backup restore drill FAILED SLA",
          queue: "backups-restore-drill",
          rpo_seconds: result.rpo_seconds,
          rto_seconds: result.rto_seconds,
          smoke_passed: result.smoke_passed,
          issues: result.issues,
        });
      }

      emitInternal("backup_drill_completed", {
        drill_id: result.drill_id,
        rpo_seconds: result.rpo_seconds,
        rto_seconds: result.rto_seconds,
        rpo_target_seconds: RPO_MAX_SECONDS,
        rto_target_seconds: RTO_MAX_SECONDS,
        smoke_passed: result.smoke_passed,
        sla_met,
        issues: result.issues,
      });

      // Page on-call on failure by failing the job (DLQ + alert).
      if (!sla_met) {
        throw new Error(
          `backup drill SLA breach — rpo=${result.rpo_seconds}s rto=${result.rto_seconds}s smoke=${result.smoke_passed}`,
        );
      }
      return { drill_id: result.drill_id, sla_met };
    },
  },
);
