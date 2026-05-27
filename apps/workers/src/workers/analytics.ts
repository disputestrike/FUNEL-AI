/**
 * Analytics fan-out worker.
 *
 * Consumes analytics events from the `analytics` queue and forwards them to
 * PostHog + Mixpanel + Iceberg lake (via the events bus). Failure on any
 * downstream is non-fatal: we mark the destination "degraded" and continue
 * with the others. Anything that fails all destinations is DLQ'd for replay.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const AnalyticsJobSchema = z.object({
  event_id: z.string().min(1),
  event_name: z.string().min(1),
  workspace_id: z.string().nullable(),
  user_id: z.string().nullable(),
  occurred_at: z.string(),
  properties: z.record(z.unknown()).default({}),
  /** Destinations to dispatch to; defaults to all. */
  destinations: z.array(z.enum(["posthog", "mixpanel", "iceberg"])).default(["posthog", "mixpanel", "iceberg"]),
});

interface PosthogAdapter {
  capture(event: { id: string; name: string; user_id: string | null; properties: Record<string, unknown>; occurred_at: string }): Promise<void>;
}
interface MixpanelAdapter {
  track(event: { id: string; name: string; user_id: string | null; properties: Record<string, unknown>; occurred_at: string }): Promise<void>;
}
interface IcebergAdapter {
  appendToLake(event: { id: string; name: string; workspace_id: string | null; properties: Record<string, unknown>; occurred_at: string }): Promise<void>;
}

interface IntegrationsModule {
  getPosthogAdapter(): Promise<PosthogAdapter>;
  getMixpanelAdapter(): Promise<MixpanelAdapter>;
  getIcebergAdapter(): Promise<IcebergAdapter>;
}

export const analyticsWorker = buildWorker(
  { queue: "analytics" },
  {
    name: "analytics.dispatch",
    schema: AnalyticsJobSchema,
    idempotencyKey: (d) => `analytics:${d.event_id}`,
    async run({ data }) {
      const integrations = (await import("@funnel/integrations")) as unknown as IntegrationsModule;

      const outcomes: Record<string, "ok" | "fail"> = {};
      const tasks: Array<Promise<void>> = [];
      const base = {
        id: data.event_id,
        name: data.event_name,
        occurred_at: data.occurred_at,
        properties: data.properties,
      };
      if (data.destinations.includes("posthog")) {
        tasks.push(
          (async () => {
            try {
              const ph = await integrations.getPosthogAdapter();
              await ph.capture({ ...base, user_id: data.user_id });
              outcomes["posthog"] = "ok";
            } catch (err) {
              outcomes["posthog"] = "fail";
              log("warn", { msg: "posthog dispatch failed", error: (err as Error).message });
            }
          })(),
        );
      }
      if (data.destinations.includes("mixpanel")) {
        tasks.push(
          (async () => {
            try {
              const mp = await integrations.getMixpanelAdapter();
              await mp.track({ ...base, user_id: data.user_id });
              outcomes["mixpanel"] = "ok";
            } catch (err) {
              outcomes["mixpanel"] = "fail";
              log("warn", { msg: "mixpanel dispatch failed", error: (err as Error).message });
            }
          })(),
        );
      }
      if (data.destinations.includes("iceberg")) {
        tasks.push(
          (async () => {
            try {
              const ice = await integrations.getIcebergAdapter();
              await ice.appendToLake({ ...base, workspace_id: data.workspace_id });
              outcomes["iceberg"] = "ok";
            } catch (err) {
              outcomes["iceberg"] = "fail";
              log("warn", { msg: "iceberg dispatch failed", error: (err as Error).message });
            }
          })(),
        );
      }

      await Promise.allSettled(tasks);

      const anyOk = Object.values(outcomes).some((v) => v === "ok");
      if (!anyOk) {
        throw new Error(`all analytics destinations failed: ${JSON.stringify(outcomes)}`);
      }

      emitInternal("analytics_dispatched", {
        event_id: data.event_id,
        event_name: data.event_name,
        outcomes,
      });
      return outcomes;
    },
  },
);
