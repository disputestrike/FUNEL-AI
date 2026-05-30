/**
 * KB ingestion worker.
 *
 * Daily at 02:00 UTC, pulls fresh items from every configured source:
 *   - NewsAPI, RSS, YouTube, Reddit, Meta Ad Library, Google Ad Transparency
 *
 * Filters with LLM-as-judge (relevance + quality), embeds via OpenAI, stores
 * as KB candidates for human review. The orchestration is owned by
 * @funnel/kb.runIngestionCycle() — we just wrap it in the BullMQ lifecycle.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { cronLastRunUnix, llmCostUsd, log } from "../monitoring.js";

const IngestionJobSchema = z.object({
  /** Optional source filter — if set, only run for these sources. */
  sources: z.array(z.string()).optional(),
  /** Optional override of the per-cycle item budget (cost guardrail). */
  budget_usd_micros: z.number().int().positive().optional(),
});

interface KbModule {
  runIngestionCycle(opts?: {
    sources?: string[];
    budget_usd_micros?: number;
  }): Promise<{
    sources_pulled: string[];
    items_fetched: number;
    items_kept: number;
    items_discarded: number;
    candidates_created: number;
    cost_usd_micros: number;
    per_provider_cost: Array<{ provider: string; model: string; cost_usd_micros: number }>;
  }>;
}

export const ingestionWorker = buildWorker(
  { queue: "ingestion", concurrency: 1 /* run one cycle at a time; the cycle parallelises internally */ },
  {
    name: "ingestion.daily-cycle",
    schema: IngestionJobSchema,
    idempotencyKey: (d) => `ingestion:${new Date().toISOString().slice(0, 10)}:${(d.sources ?? []).sort().join(",")}`,
    async run({ data }) {
      const kb = (await import("@funnel/kb")) as unknown as KbModule;
      emitInternal("ingestion_run_started", { sources: data.sources ?? "all" });

      const result = await kb.runIngestionCycle({
        sources: data.sources,
        budget_usd_micros: data.budget_usd_micros,
      });

      for (const p of result.per_provider_cost) {
        llmCostUsd.inc(
          { queue: "ingestion", provider: p.provider, model: p.model },
          p.cost_usd_micros / 1_000_000,
        );
      }

      cronLastRunUnix.set({ cron: "ingestion-daily" }, Math.floor(Date.now() / 1000));
      emitInternal("ingestion_run_completed", {
        sources_pulled: result.sources_pulled,
        items_fetched: result.items_fetched,
        items_kept: result.items_kept,
        candidates_created: result.candidates_created,
        cost_usd_micros: result.cost_usd_micros,
      });

      log("info", {
        msg: "ingestion cycle completed",
        queue: "ingestion",
        kept: result.items_kept,
        candidates: result.candidates_created,
      });

      return result;
    },
  },
);
