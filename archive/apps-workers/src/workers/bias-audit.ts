/**
 * Bias audit worker (quarterly cron).
 *
 * Samples ~1000 generations stratified across industry × geo × demographic.
 * Runs an LLM-as-judge bias detector over each. Aggregates findings into a
 * report that lands in the admin console + emits a `governance_event` for
 * the compliance team's quarterly review.
 *
 * Single-concurrency, single-attempt — bias audits are expensive and should
 * never retry silently. Failure escalates to on-call.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { llmCostUsd, log } from "../monitoring.js";

const BiasAuditJobSchema = z.object({
  sample_size: z.number().int().positive().default(1000),
  /** Override the stratification matrix (mostly for ad-hoc reruns). */
  strata: z
    .array(
      z.object({
        industry: z.string(),
        geo: z.string(),
        demographic: z.string(),
      }),
    )
    .optional(),
});

interface BiasAuditModule {
  runBiasAudit(opts: {
    sample_size: number;
    strata?: { industry: string; geo: string; demographic: string }[];
  }): Promise<{
    report_id: string;
    samples_evaluated: number;
    findings: Array<{
      stratum: { industry: string; geo: string; demographic: string };
      issue: string;
      severity: "info" | "low" | "medium" | "high";
      examples: string[];
    }>;
    cost_usd_micros: number;
    per_provider_cost: Array<{ provider: string; model: string; cost_usd_micros: number }>;
  }>;
  saveBiasAuditReport(report: unknown): Promise<void>;
}

export const biasAuditWorker = buildWorker(
  { queue: "bias-audit", concurrency: 1 },
  {
    name: "bias-audit.run",
    schema: BiasAuditJobSchema,
    idempotencyKey: (d) => `bias-audit:${new Date().toISOString().slice(0, 7)}:${d.sample_size}`,
    async run({ data }) {
      const mod = (await import("@funnel/compliance")) as unknown as BiasAuditModule;
      emitInternal("bias_audit_started", { sample_size: data.sample_size });

      const result = await mod.runBiasAudit({
        sample_size: data.sample_size,
        strata: data.strata,
      });

      for (const p of result.per_provider_cost) {
        llmCostUsd.inc(
          { queue: "bias-audit", provider: p.provider, model: p.model },
          p.cost_usd_micros / 1_000_000,
        );
      }

      await mod.saveBiasAuditReport(result).catch((err) => {
        log("error", { msg: "saving bias audit report failed", error: (err as Error).message });
      });

      const highSeverityCount = result.findings.filter((f) => f.severity === "high").length;
      emitInternal("governance_event", {
        kind: "bias_audit_completed",
        report_id: result.report_id,
        samples_evaluated: result.samples_evaluated,
        findings_count: result.findings.length,
        high_severity_count: highSeverityCount,
        cost_usd_micros: result.cost_usd_micros,
      });

      return {
        report_id: result.report_id,
        samples_evaluated: result.samples_evaluated,
        findings_count: result.findings.length,
        high_severity_count: highSeverityCount,
      };
    },
  },
);
