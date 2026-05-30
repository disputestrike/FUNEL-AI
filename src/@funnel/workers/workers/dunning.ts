/**
 * Dunning worker.
 *
 * Hourly cron walks every `past_due` subscription through the D0/D3/D7/D14/D21/
 * D28/D60/D90 sequence per @funnel/billing.dunning.
 *
 * Each tick:
 *   1. Fetch subscriptions whose `next_step_at <= now`.
 *   2. Advance one step (state transition + email + optional charge retry).
 *   3. Emit `dunning_step_advanced` for observability + the recursive
 *      learning pipeline.
 *
 * Failure modes:
 *   - Charge retry transient → standard BullMQ retry.
 *   - Email send transient → enqueued to the email queue, never blocks the
 *     step advance.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const DunningJobSchema = z.object({
  trigger: z.enum(["cron", "manual"]).default("cron"),
  /** When set, advance only this subscription (admin replay tooling). */
  subscription_id: z.string().optional(),
});

interface BillingDunningModule {
  advanceDueDunningStates(opts?: { onlySubscriptionId?: string }): Promise<{
    advanced: Array<{
      subscription_id: string;
      from_step: string;
      to_step: string;
      next_step_at: string | null;
      status: string;
    }>;
    skipped: Array<{ subscription_id: string; reason: string }>;
  }>;
}

export const dunningWorker = buildWorker(
  { queue: "dunning" },
  {
    name: "dunning.advance",
    schema: DunningJobSchema,
    idempotencyKey: (d) => {
      // Cron ticks idempotent per hour bucket; manual replays idempotent per
      // subscription per hour.
      const bucket = Math.floor(Date.now() / 3600_000);
      return d.subscription_id ? `dunning:${d.subscription_id}:${bucket}` : `dunning:cron:${bucket}`;
    },
    async run({ data }) {
      emitInternal("dunning_run_started", { trigger: data.trigger });
      const billing = (await import("@funnel/billing")) as unknown as BillingDunningModule;
      const result = await billing.advanceDueDunningStates(
        data.subscription_id ? { onlySubscriptionId: data.subscription_id } : undefined,
      );

      for (const adv of result.advanced) {
        emitInternal("dunning_step_advanced", {
          subscription_id: adv.subscription_id,
          from_step: adv.from_step,
          to_step: adv.to_step,
          status: adv.status,
          next_step_at: adv.next_step_at,
        });
      }
      for (const skip of result.skipped) {
        log("info", {
          msg: "dunning skipped",
          queue: "dunning",
          subscription_id: skip.subscription_id,
          reason: skip.reason,
        });
      }
      emitInternal("dunning_run_completed", {
        advanced_count: result.advanced.length,
        skipped_count: result.skipped.length,
      });
      return { advanced: result.advanced.length, skipped: result.skipped.length };
    },
  },
);
