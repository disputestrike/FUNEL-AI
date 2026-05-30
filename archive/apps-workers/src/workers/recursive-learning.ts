/**
 * Recursive learning aggregator (nightly cron, 03:00 UTC).
 *
 * Reads anonymized conversion events from the Iceberg lake, groups by
 *   industry × geo × language × variant
 * and computes weighted few-shot examples that get written back to the KB
 * for use in the next day's generation prompts.
 *
 * Monthly we also retrain a small ranking model on top of these aggregates
 * (decided by date check inside the run — first nightly of the month).
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { cronLastRunUnix } from "../monitoring.js";

const LearningJobSchema = z.object({
  /** Force ranking model retraining regardless of date. */
  retrain: z.boolean().default(false),
});

interface KbLearningModule {
  aggregateConversionsFromLake(opts: { window_days: number }): Promise<{
    cohorts: number;
    examples_written: number;
    pack_ids_updated: string[];
  }>;
  retrainRankingModel(): Promise<{
    model_version: string;
    train_examples: number;
    eval_auc: number;
    promoted: boolean;
  }>;
}

export const recursiveLearningWorker = buildWorker(
  { queue: "recursive-learning", concurrency: 1 },
  {
    name: "recursive-learning.aggregate",
    schema: LearningJobSchema,
    idempotencyKey: () => `recursive-learning:${new Date().toISOString().slice(0, 10)}`,
    async run({ data }) {
      const mod = (await import("@funnel/kb")) as unknown as KbLearningModule;
      emitInternal("recursive_learning_started", {});

      const agg = await mod.aggregateConversionsFromLake({ window_days: 30 });

      let retrained: Awaited<ReturnType<KbLearningModule["retrainRankingModel"]>> | null = null;
      const isFirstOfMonth = new Date().getUTCDate() === 1;
      if (data.retrain || isFirstOfMonth) {
        retrained = await mod.retrainRankingModel();
      }

      cronLastRunUnix.set({ cron: "recursive-learning-nightly" }, Math.floor(Date.now() / 1000));
      emitInternal("recursive_learning_completed", {
        cohorts: agg.cohorts,
        examples_written: agg.examples_written,
        pack_ids_updated: agg.pack_ids_updated,
        retrained: retrained !== null,
        ranking_model_version: retrained?.model_version,
        ranking_auc: retrained?.eval_auc,
      });
      return {
        cohorts: agg.cohorts,
        examples_written: agg.examples_written,
        retrained: retrained !== null,
      };
    },
  },
);
