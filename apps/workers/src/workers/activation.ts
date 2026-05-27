/**
 * Activation worker.
 *
 * Runs all D0-D14 activation interventions per @funnel/activation.scheduler.
 * Honours per-user opt-outs (the scheduler returns only eligible interventions).
 *
 * Each intervention may dispatch one of:
 *   - email (lifecycle template)
 *   - in-app notification
 *   - push
 *   - in-product nudge (set a feature flag on the workspace that the UI reads)
 *
 * The scheduler is the source of truth for "which intervention is due for
 * which user right now" â€” we just execute the list it returns.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";
import { getQueue } from "../queues.js";

const ActivationJobSchema = z.object({
  trigger: z.enum(["cron", "manual"]).default("cron"),
});

type Intervention = {
  intervention_id: string;
  workspace_id: string;
  user_id: string;
  channel: "email" | "in_app" | "push" | "in_product_nudge";
  template?: string;
  subject?: string;
  body?: string;
  payload?: Record<string, unknown>;
  /** D0-D14 cohort day so we can attribute conversions later. */
  cohort_day: number;
};

interface ActivationSchedulerModule {
  scheduler: {
    listDueInterventions(): Promise<Intervention[]>;
    markDispatched(args: { intervention_id: string; outcome: "dispatched" | "skipped" }): Promise<void>;
  };
}

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
  setWorkspaceNudge(args: { workspace_id: string; nudge_id: string; expires_at: string }): Promise<void>;
}

export const activationWorker = buildWorker(
  { queue: "activation" },
  {
    name: "activation.run-interventions",
    schema: ActivationJobSchema,
    idempotencyKey: () => `activation:cron:${Math.floor(Date.now() / 3600_000)}`,
    async run() {
      const mod = (await import("@funnel/activation")) as unknown as ActivationSchedulerModule;
      const notifications = (await import("@funnel/notifications")) as unknown as NotificationsModule;

      const due = await mod.scheduler.listDueInterventions();
      emitInternal("activation_run_started", { due_count: due.length });

      let dispatched = 0;
      let skipped = 0;

      for (const intv of due) {
        try {
          switch (intv.channel) {
            case "email": {
              await getQueue("email").add("email.send", {
                workspace_id: intv.workspace_id,
                to: ((intv.payload?.["to"] as string | undefined) ?? "").toString(),
                template: intv.template ?? "lifecycle_default",
                subject: intv.subject ?? "GoFunnelAI",
                data: intv.payload ?? {},
                category: "lifecycle",
                idempotency_key: `activation:${intv.intervention_id}`,
              });
              break;
            }
            case "in_app":
              await notifications.sendInAppNotification({
                user_id: intv.user_id,
                type: "activation",
                title: intv.subject ?? "A nudge from GoFunnelAI",
                body: intv.body ?? "",
                data: intv.payload ?? {},
              });
              break;
            case "push":
              await notifications.sendPushNotification({
                user_id: intv.user_id,
                title: intv.subject ?? "A nudge from GoFunnelAI",
                body: intv.body ?? "",
                data: intv.payload ?? {},
              });
              break;
            case "in_product_nudge":
              await notifications.setWorkspaceNudge({
                workspace_id: intv.workspace_id,
                nudge_id: intv.intervention_id,
                expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
              });
              break;
          }
          await mod.scheduler.markDispatched({
            intervention_id: intv.intervention_id,
            outcome: "dispatched",
          });
          emitInternal("activation_intervention_dispatched", {
            intervention_id: intv.intervention_id,
            workspace_id: intv.workspace_id,
            user_id: intv.user_id,
            channel: intv.channel,
            cohort_day: intv.cohort_day,
          });
          dispatched += 1;
        } catch (err) {
          log("error", {
            msg: "activation intervention dispatch failed",
            queue: "activation",
            intervention_id: intv.intervention_id,
            error: (err as Error).message,
          });
          await mod.scheduler
            .markDispatched({ intervention_id: intv.intervention_id, outcome: "skipped" })
            .catch(() => undefined);
          skipped += 1;
        }
      }

      emitInternal("activation_run_completed", { dispatched, skipped });
      return { dispatched, skipped };
    },
  },
);
