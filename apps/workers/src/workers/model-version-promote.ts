/**
 * Model-version promotion (monthly cron).
 *
 * Re-evaluates KB "active" items, retires stale ones, promotes new winners.
 * Emits a `model_version_promoted` governance event listing what was kept,
 * retired, and added so the data team can audit the flywheel decisions.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";

const PromotionJobSchema = z.object({
  trigger: z.enum(["cron", "manual"]).default("cron"),
});

interface KbModule {
  retireAndPromote(): Promise<{
    promoted: Array<{ item_id: string; pack_id: string; metric: string; value: number }>;
    retired: Array<{ item_id: string; pack_id: string; reason: string }>;
    kept: number;
    new_version: string;
  }>;
}

export const modelVersionPromoteWorker = buildWorker(
  { queue: "model-version-promote", concurrency: 1 },
  {
    name: "model-version.promote",
    schema: PromotionJobSchema,
    idempotencyKey: () => `model-promote:${new Date().toISOString().slice(0, 7)}`,
    async run() {
      const kb = (await import("@funnel/kb")) as unknown as KbModule;
      emitInternal("model_version_promotion_started", {});

      const result = await kb.retireAndPromote();

      emitInternal("model_version_promoted", {
        new_version: result.new_version,
        promoted_count: result.promoted.length,
        retired_count: result.retired.length,
        kept_count: result.kept,
      });
      return {
        new_version: result.new_version,
        promoted: result.promoted.length,
        retired: result.retired.length,
        kept: result.kept,
      };
    },
  },
);
