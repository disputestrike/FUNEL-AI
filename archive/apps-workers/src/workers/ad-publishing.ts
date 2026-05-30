/**
 * Ad publishing worker.
 *
 * Publishes a campaign to one of: Meta, Google, TikTok, LinkedIn.
 *
 * Pre-flight checks:
 *   - Run the Compliance agent (@funnel/compliance) on every creative. Block
 *     if any returns "block".
 *   - Validate platform-specific creative constraints via the integration
 *     adapter's `validateCreative` hook.
 *
 * Retries: 5 with exponential backoff. Platform rate-limit errors (429,
 * 'RATE_LIMITED') re-queue with an explicit delay derived from the response's
 * Retry-After header where present.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";
import { getQueue } from "../queues.js";

const AdPublishingJobSchema = z.object({
  workspace_id: z.string().min(1),
  campaign_id: z.string().min(1),
  platform: z.enum(["meta", "google", "tiktok", "linkedin"]),
  ad_account_id: z.string().min(1),
  creatives: z
    .array(
      z.object({
        creative_id: z.string(),
        headline: z.string(),
        body: z.string(),
        cta: z.string(),
        media_url: z.string().url().nullable(),
      }),
    )
    .min(1),
  budget_cents: z.number().int().positive(),
  daily_cap_cents: z.number().int().positive(),
  targeting: z.record(z.unknown()),
  flight_start: z.string(),
  flight_end: z.string(),
});

interface ComplianceModule {
  reviewCreative(input: {
    workspaceId: string;
    platform: string;
    creative: { headline: string; body: string; cta: string };
  }): Promise<{ verdict: "allow" | "block" | "rewrite"; violations: string[] }>;
}

interface AdAdapter {
  validateCreative(creative: { headline: string; body: string; media_url: string | null }): Promise<{
    ok: boolean;
    issues: string[];
  }>;
  publishCampaign(input: {
    ad_account_id: string;
    campaign_id: string;
    creatives: unknown[];
    budget_cents: number;
    daily_cap_cents: number;
    targeting: Record<string, unknown>;
    flight_start: string;
    flight_end: string;
  }): Promise<{ platform_campaign_id: string }>;
}

interface IntegrationsModule {
  getAdAdapter(platform: "meta" | "google" | "tiktok" | "linkedin"): Promise<AdAdapter>;
}

class RateLimitedError extends Error {
  constructor(public retryAfterMs: number, message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export const adPublishingWorker = buildWorker(
  { queue: "ad-publishing" },
  {
    name: "ad-publishing.publish",
    schema: AdPublishingJobSchema,
    idempotencyKey: (d) => `ad:${d.platform}:${d.campaign_id}`,
    async run({ data, job }) {
      emitInternal("ad_publish_started", {
        workspace_id: data.workspace_id,
        campaign_id: data.campaign_id,
        platform: data.platform,
      });

      const compliance = (await import("@funnel/compliance")) as unknown as ComplianceModule;
      for (const creative of data.creatives) {
        const review = await compliance.reviewCreative({
          workspaceId: data.workspace_id,
          platform: data.platform,
          creative,
        });
        if (review.verdict === "block") {
          emitInternal("ad_publish_blocked", {
            workspace_id: data.workspace_id,
            campaign_id: data.campaign_id,
            creative_id: creative.creative_id,
            violations: review.violations,
          });
          // Block is terminal — don't retry, route to DLQ.
          job.opts.attempts = job.attemptsMade + 1;
          throw new Error(`compliance_block: ${review.violations.join(",")}`);
        }
      }

      const integrations = (await import("@funnel/integrations")) as unknown as IntegrationsModule;
      const adapter = await integrations.getAdAdapter(data.platform);

      // Platform-side creative validation.
      for (const creative of data.creatives) {
        const v = await adapter.validateCreative({
          headline: creative.headline,
          body: creative.body,
          media_url: creative.media_url,
        });
        if (!v.ok) {
          throw new Error(`platform_validation_failed: ${v.issues.join(",")}`);
        }
      }

      try {
        const result = await adapter.publishCampaign({
          ad_account_id: data.ad_account_id,
          campaign_id: data.campaign_id,
          creatives: data.creatives,
          budget_cents: data.budget_cents,
          daily_cap_cents: data.daily_cap_cents,
          targeting: data.targeting,
          flight_start: data.flight_start,
          flight_end: data.flight_end,
        });
        emitInternal("ad_publish_completed", {
          workspace_id: data.workspace_id,
          campaign_id: data.campaign_id,
          platform: data.platform,
          platform_campaign_id: result.platform_campaign_id,
        });
        return result;
      } catch (err) {
        if (err instanceof RateLimitedError) {
          log("warn", {
            msg: "ad publishing rate-limited; re-queueing with explicit delay",
            queue: "ad-publishing",
            campaign_id: data.campaign_id,
            retry_after_ms: err.retryAfterMs,
          });
          await getQueue("ad-publishing").add("ad-publishing.publish", data, {
            delay: err.retryAfterMs,
            priority: 5,
          });
          return { rate_limited: true } as never;
        }
        throw err;
      }
    },
  },
);

export { RateLimitedError };
