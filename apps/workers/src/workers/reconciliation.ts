/**
 * Reconciliation worker.
 *
 * Runs every hour. Performs four discrete reconciliations sequentially because
 * any one of them may surface drift that the next one needs to see.
 *
 * 1. Subscription state vs PayPal/Stripe state. Alert on any drift.
 * 2. Missed webhook scan — 24h lookback against provider event APIs.
 * 3. Platform balance vs processor balance.
 * 4. Cost ledger sanity check: provider invoices vs our tally.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { cronLastRunUnix, log } from "../monitoring.js";

const ReconciliationJobSchema = z.object({
  trigger: z.enum(["cron", "manual"]).default("cron"),
});

interface BillingReconciliationModule {
  reconcileSubscriptions(): Promise<{
    checked: number;
    drift: Array<{ subscription_id: string; field: string; ours: string; theirs: string; provider: string }>;
  }>;
  scanMissedWebhooks(opts: { lookback_hours: number }): Promise<{
    providers: Array<{ provider: string; missed: number; replayed: number }>;
  }>;
  reconcilePlatformBalance(): Promise<{
    provider: string;
    platform_cents: number;
    processor_cents: number;
    delta_cents: number;
  }[]>;
}

interface CostGovernorModule {
  reconcileCostLedger(): Promise<{
    provider: string;
    ledger_usd_micros: number;
    invoice_usd_micros: number | null;
    delta_usd_micros: number;
  }[]>;
}

export const reconciliationWorker = buildWorker(
  { queue: "reconciliation", concurrency: 1 },
  {
    name: "reconciliation.run",
    schema: ReconciliationJobSchema,
    idempotencyKey: () => `reconciliation:${Math.floor(Date.now() / 3600_000)}`,
    async run() {
      const billing = (await import("@funnel/billing")) as unknown as BillingReconciliationModule;
      const costGovernor = (await import("@funnel/billing")) as unknown as CostGovernorModule;

      emitInternal("reconciliation_run_started", {});

      // 1. Subscription drift.
      const subs = await billing.reconcileSubscriptions();
      if (subs.drift.length > 0) {
        emitInternal("reconciliation_drift_detected", {
          kind: "subscription",
          count: subs.drift.length,
          examples: subs.drift.slice(0, 5),
        });
        log("error", {
          msg: "subscription drift detected",
          queue: "reconciliation",
          drift_count: subs.drift.length,
        });
      }

      // 2. Missed webhooks.
      const missed = await billing.scanMissedWebhooks({ lookback_hours: 24 });
      const totalMissed = missed.providers.reduce((acc, p) => acc + p.missed, 0);
      if (totalMissed > 0) {
        emitInternal("reconciliation_missed_webhooks", { providers: missed.providers });
      }

      // 3. Platform balance.
      const balance = await billing.reconcilePlatformBalance();
      for (const b of balance) {
        if (Math.abs(b.delta_cents) > 100) {
          emitInternal("reconciliation_drift_detected", {
            kind: "platform_balance",
            provider: b.provider,
            delta_cents: b.delta_cents,
          });
        }
      }

      // 4. Cost ledger sanity.
      const costLedger = await costGovernor.reconcileCostLedger().catch((err) => {
        log("warn", { msg: "cost ledger reconciliation failed", error: (err as Error).message });
        return [] as Awaited<ReturnType<CostGovernorModule["reconcileCostLedger"]>>;
      });
      const ledgerIssues = costLedger.filter((l) => Math.abs(l.delta_usd_micros) > 1_000_000);
      if (ledgerIssues.length > 0) {
        emitInternal("reconciliation_drift_detected", {
          kind: "cost_ledger",
          issues: ledgerIssues,
        });
      }

      cronLastRunUnix.set({ cron: "reconciliation-hourly" }, Math.floor(Date.now() / 1000));
      emitInternal("reconciliation_run_completed", {
        subscription_drift: subs.drift.length,
        webhooks_missed: totalMissed,
        balance_providers_with_drift: balance.filter((b) => Math.abs(b.delta_cents) > 100).length,
        cost_ledger_issues: ledgerIssues.length,
      });

      return {
        subscription_drift: subs.drift.length,
        missed_webhooks: totalMissed,
        balance_drift: balance.filter((b) => Math.abs(b.delta_cents) > 100).length,
        cost_ledger_issues: ledgerIssues.length,
      };
    },
  },
);
