/**
 * Card-expiring alerts (daily cron, 09:00 UTC).
 *
 * Finds subscriptions whose default payment method expires in 30 or 7 days
 * and enqueues a reminder email via @funnel/email. The reminder template
 * includes a deep link to the billing settings card-update flow.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { cronLastRunUnix } from "../monitoring.js";
import { getQueue } from "../queues.js";

const CardExpiringJobSchema = z.object({
  /** Days-until-expiry buckets; defaults match the policy. */
  buckets: z.array(z.number().int().positive()).default([30, 7]),
});

interface BillingModule {
  listSubscriptionsWithExpiringCards(opts: { days_until: number }): Promise<
    Array<{
      subscription_id: string;
      workspace_id: string;
      owner_user_id: string;
      owner_email: string;
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
      days_until_expiry: number;
    }>
  >;
}

export const cardExpiringAlertsWorker = buildWorker(
  { queue: "card-expiring-alerts" },
  {
    name: "card-expiring.alerts",
    schema: CardExpiringJobSchema,
    idempotencyKey: (d) => `card-expiring:${new Date().toISOString().slice(0, 10)}:${d.buckets.join(",")}`,
    async run({ data }) {
      const billing = (await import("@funnel/billing")) as unknown as BillingModule;
      emitInternal("card_expiring_scan_started", { buckets: data.buckets });

      let enqueued = 0;
      for (const days of data.buckets) {
        const subs = await billing.listSubscriptionsWithExpiringCards({ days_until: days });
        for (const sub of subs) {
          await getQueue("email").add("email.send", {
            workspace_id: sub.workspace_id,
            to: sub.owner_email,
            template: "card_expiring_reminder",
            subject: `Your card on file expires in ${days} days`,
            data: {
              brand: sub.brand,
              last4: sub.last4,
              exp_month: sub.exp_month,
              exp_year: sub.exp_year,
              days_until_expiry: sub.days_until_expiry,
            },
            category: "transactional",
            idempotency_key: `card-expiring:${sub.subscription_id}:${days}`,
          });
          enqueued += 1;
        }
      }

      cronLastRunUnix.set({ cron: "card-expiring-alerts-daily" }, Math.floor(Date.now() / 1000));
      emitInternal("card_expiring_scan_completed", { enqueued });
      return { enqueued };
    },
  },
);
