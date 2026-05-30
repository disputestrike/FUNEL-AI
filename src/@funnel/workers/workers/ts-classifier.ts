/**
 * Trust & Safety classifier worker.
 *
 * For every pending generation we run the 10 risk classes per
 * @funnel/trust-safety. The classifier returns one of three actions:
 *   allow           → generation continues
 *   route_to_review → human review queue
 *   block           → generation aborts, user shown a policy explanation
 *
 * The 10 classes (per Doc 07a-trust-and-safety-policy.md):
 *   regulated_claims, financial_promises, medical_claims, election_speech,
 *   impersonation, deceptive_pricing, hate_or_harassment, csam_or_csae,
 *   weapons_drugs, prompt_injection
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { llmCostUsd, log } from "../monitoring.js";

const TsClassifierJobSchema = z.object({
  generation_id: z.string().min(1),
  workspace_id: z.string().min(1),
  /** Concatenated text we're classifying. */
  content_hash: z.string().min(1),
  content: z.string().min(1),
});

interface TrustSafetyClassifierModule {
  classify(args: {
    generation_id: string;
    workspace_id: string;
    content: string;
  }): Promise<{
    action: "allow" | "route_to_review" | "block";
    classes: Record<string, { score: number; verdict: "allow" | "review" | "block" }>;
    cost_usd_micros: number;
    provider: string;
    model: string;
  }>;
  recordClassification(args: {
    generation_id: string;
    workspace_id: string;
    action: string;
    classes: Record<string, unknown>;
  }): Promise<void>;
}

interface DbModule {
  prisma: {
    generation: {
      update(args: { where: { id: string }; data: { ts_action: string; ts_reviewed_at: Date } }): Promise<unknown>;
    };
    humanReviewQueue: {
      create(args: { data: { generation_id: string; reason: string; priority: string } }): Promise<unknown>;
    };
  };
}

export const tsClassifierWorker = buildWorker(
  { queue: "ts-classifier" },
  {
    name: "ts-classifier.run",
    schema: TsClassifierJobSchema,
    idempotencyKey: (d) => `ts-classifier:${d.generation_id}:${d.content_hash}`,
    async run({ data }) {
      const mod = (await import("@funnel/compliance")) as unknown as TrustSafetyClassifierModule;
      const db = (await import("@funnel/db")) as unknown as DbModule;

      emitInternal("ts_classifier_started", {
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
      });

      const result = await mod.classify({
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
        content: data.content,
      });

      llmCostUsd.inc(
        { queue: "ts-classifier", provider: result.provider, model: result.model },
        result.cost_usd_micros / 1_000_000,
      );

      await mod.recordClassification({
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
        action: result.action,
        classes: result.classes,
      });

      await db.prisma.generation.update({
        where: { id: data.generation_id },
        data: { ts_action: result.action, ts_reviewed_at: new Date() },
      });

      if (result.action === "route_to_review") {
        await db.prisma.humanReviewQueue.create({
          data: {
            generation_id: data.generation_id,
            reason: `ts_classifier: ${Object.entries(result.classes)
              .filter(([, v]) => v.verdict !== "allow")
              .map(([k]) => k)
              .join(",")}`,
            priority: "high",
          },
        });
      }

      if (result.action === "block") {
        log("warn", {
          msg: "ts classifier blocked generation",
          queue: "ts-classifier",
          generation_id: data.generation_id,
        });
      }

      emitInternal("ts_classifier_completed", {
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
        action: result.action,
        flagged_classes: Object.entries(result.classes)
          .filter(([, v]) => v.verdict !== "allow")
          .map(([k]) => k),
      });

      return { action: result.action };
    },
  },
);
