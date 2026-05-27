/**
 * Speed-to-Lead worker.
 *
 * SLA target: within 100ms of `lead_captured`:
 *   1. Trigger SMS auto-reply via @funnel/notifications (SignalWire).
 *   2. Enqueue a RevTry voice dial (must dial within 60 seconds).
 *   3. Notify the funnel owner via in-app + push (@funnel/notifications).
 *   4. Apply the lead-scoring rules and persist the score on the lead row.
 *
 * The four sub-tasks run in parallel — none of them block each other. SMS +
 * dial are the most time-sensitive; we await them, but in-app notification +
 * scoring are fire-and-forget on the optimistic path with structured logging
 * of any error.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";
import { getQueue } from "../queues.js";

const SpeedToLeadSchema = z.object({
  workspace_id: z.string().min(1),
  funnel_id: z.string().min(1),
  funnel_owner_user_id: z.string().min(1),
  lead_id: z.string().min(1),
  captured_at: z.string(),
  lead: z.object({
    name: z.string().nullable(),
    email: z.string().email().nullable(),
    phone_e164: z.string().nullable(),
    answers: z.record(z.unknown()).default({}),
    utm: z.record(z.string()).default({}),
  }),
});

interface NotificationsModule {
  sendInAppNotification(args: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  sendPushNotification(args: {
    user_id: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

interface RevTryModule {
  queueOutboundDial(args: {
    workspace_id: string;
    lead_id: string;
    funnel_id: string;
    phone_e164: string;
    /** SLA — dial must initiate by this absolute time. */
    deadline_at: string;
  }): Promise<{ call_id: string }>;
}

interface ScoringModule {
  scoreLead(args: {
    workspace_id: string;
    funnel_id: string;
    answers: Record<string, unknown>;
    utm: Record<string, string>;
  }): Promise<{ score: number; band: "hot" | "warm" | "cold"; rules_applied: string[] }>;
  persistScore(args: { lead_id: string; score: number; band: string }): Promise<void>;
}

export const speedToLeadWorker = buildWorker(
  { queue: "speed-to-lead" },
  {
    name: "speed-to-lead.process",
    schema: SpeedToLeadSchema,
    idempotencyKey: (d) => `s2l:${d.lead_id}`,
    async run({ data }) {
      const start = Date.now();
      emitInternal("speed_to_lead_started", {
        workspace_id: data.workspace_id,
        lead_id: data.lead_id,
        funnel_id: data.funnel_id,
      });

      const notifications = (await import("@funnel/notifications")) as unknown as NotificationsModule;
      const revtry = (await import("@funnel/revtry")) as unknown as RevTryModule;
      const scoringModule = (await import("@funnel/activation")) as unknown as ScoringModule;

      // Parallel execution — none of these block each other.
      const tasks: Array<Promise<unknown>> = [];

      // 1. SMS auto-reply (if we captured a phone).
      if (data.lead.phone_e164) {
        tasks.push(
          getQueue("sms").add("sms.send", {
            workspace_id: data.workspace_id,
            to_e164: data.lead.phone_e164,
            from_e164: process.env["FUNNEL_DEFAULT_FROM_NUMBER"] ?? "+10000000000",
            body: "Thanks for reaching out — we got your details and someone will call you shortly.",
            category: "lead_reply",
            lead_id: data.lead_id,
            idempotency_key: `s2l-sms:${data.lead_id}`,
          }, { priority: 1 }),
        );
      }

      // 2. RevTry dial — 60s SLA.
      if (data.lead.phone_e164) {
        const deadline = new Date(Date.now() + 60_000).toISOString();
        tasks.push(
          revtry
            .queueOutboundDial({
              workspace_id: data.workspace_id,
              lead_id: data.lead_id,
              funnel_id: data.funnel_id,
              phone_e164: data.lead.phone_e164,
              deadline_at: deadline,
            })
            .catch((err) => {
              log("error", {
                msg: "RevTry dial enqueue failed",
                queue: "speed-to-lead",
                lead_id: data.lead_id,
                error: (err as Error).message,
              });
            }),
        );
      }

      // 3. Notify the funnel owner.
      const title = "New lead captured";
      const body = data.lead.name
        ? `${data.lead.name} just submitted your funnel`
        : "A new lead just submitted your funnel";
      tasks.push(
        notifications
          .sendInAppNotification({
            user_id: data.funnel_owner_user_id,
            type: "lead_captured",
            title,
            body,
            data: { lead_id: data.lead_id, funnel_id: data.funnel_id },
          })
          .catch((err) =>
            log("error", { msg: "in-app notification failed", error: (err as Error).message }),
          ),
        notifications
          .sendPushNotification({
            user_id: data.funnel_owner_user_id,
            title,
            body,
            data: { lead_id: data.lead_id, funnel_id: data.funnel_id },
          })
          .catch((err) =>
            log("error", { msg: "push notification failed", error: (err as Error).message }),
          ),
      );

      // 4. Lead scoring.
      tasks.push(
        (async () => {
          const result = await scoringModule.scoreLead({
            workspace_id: data.workspace_id,
            funnel_id: data.funnel_id,
            answers: data.lead.answers,
            utm: data.lead.utm,
          });
          await scoringModule.persistScore({
            lead_id: data.lead_id,
            score: result.score,
            band: result.band,
          });
          emitInternal("lead_scored", {
            workspace_id: data.workspace_id,
            lead_id: data.lead_id,
            score: result.score,
            band: result.band,
            rules_applied: result.rules_applied,
          });
        })().catch((err) =>
          log("error", { msg: "lead scoring failed", error: (err as Error).message }),
        ),
      );

      await Promise.allSettled(tasks);

      const elapsed = Date.now() - start;
      emitInternal("speed_to_lead_completed", {
        workspace_id: data.workspace_id,
        lead_id: data.lead_id,
        elapsed_ms: elapsed,
        sla_met: elapsed < 100,
      });
      if (elapsed > 100) {
        log("warn", {
          msg: "speed-to-lead SLA breach (>100ms)",
          queue: "speed-to-lead",
          lead_id: data.lead_id,
          elapsed_ms: elapsed,
        });
      }

      return { lead_id: data.lead_id, elapsed_ms: elapsed };
    },
  },
);
