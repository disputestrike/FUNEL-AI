/**
 * Generation worker.
 *
 * Picks a `generate` job, drives @funnel/orchestrator.generate(), streams the
 * resulting events through @funnel/events, writes the canonical funnel JSON
 * to the DB, and re-queues itself if the quality score falls below the gate.
 *
 * Cost-governor integration: every LLM call inside the orchestrator runs
 * through the @funnel/cost-governor module which enforces per-tenant ceilings
 * (see funnel-ai-docs/07c-cost-governor.md). The worker hard-aborts if the
 * governor refuses.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { llmCostUsd, log } from "../monitoring.js";
import { getQueue } from "../queues.js";

const GenerationJobSchema = z.object({
  generation_id: z.string().min(1),
  workspace_id: z.string().min(1),
  requested_by_user_id: z.string().min(1).nullable(),
  vertical: z.string().min(1),
  prompt: z.string().min(1),
  kb_pack_ids: z.array(z.string()).default([]),
  parent_generation_id: z.string().nullable().default(null),
  /** If this is a regeneration triggered by quality gate, track depth. */
  regeneration_depth: z.number().int().nonnegative().default(0),
  /** Persisted by API at enqueue; the worker echoes it back on completion. */
  trace_id: z.string().optional(),
});

export type GenerationJobData = z.infer<typeof GenerationJobSchema>;

const QUALITY_GATE = 80;
const MAX_REGEN_DEPTH = 2; // 3 total attempts incl. original

interface OrchestratorModule {
  generate(input: {
    generationId: string;
    workspaceId: string;
    vertical: string;
    prompt: string;
    kbPackIds: string[];
    parentGenerationId: string | null;
  }): Promise<{
    funnel: unknown;
    quality_score: number;
    cost_usd_micros: number;
    duration_ms: number;
    token_usage: { input: number; output: number; cache_read?: number };
    requires_human_review: boolean;
    agent_breakdown: Array<{
      agent_id: string;
      model_id: string;
      provider: string;
      cost_usd_micros: number;
      tokens_in: number;
      tokens_out: number;
    }>;
  }>;
}

interface DbModule {
  prisma: {
    funnel: {
      upsert(args: {
        where: { id: string };
        update: { schema_json: unknown; updated_at: Date };
        create: { id: string; workspace_id: string; schema_json: unknown; status: string };
      }): Promise<unknown>;
    };
    humanReviewQueue: {
      create(args: { data: { generation_id: string; reason: string; priority: string } }): Promise<unknown>;
    };
  };
}

async function loadOrchestrator(): Promise<OrchestratorModule> {
  return (await import("@funnel/orchestrator")) as unknown as OrchestratorModule;
}

async function loadDb(): Promise<DbModule> {
  return (await import("@funnel/db")) as unknown as DbModule;
}

export const generationWorker = buildWorker(
  { queue: "generation" },
  {
    name: "generation.run",
    schema: GenerationJobSchema,
    idempotencyKey: (d) => `gen:${d.generation_id}:${d.regeneration_depth}`,
    async run({ data }) {
      // Start event. Taxonomy will adopt `generation_started`; until then we
      // emit it via the internal channel so the lake ingestor still sees it.
      emitInternal("generation_started", {
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
        vertical: data.vertical,
        kb_pack_ids: data.kb_pack_ids,
        parent_generation_id: data.parent_generation_id,
        regeneration_depth: data.regeneration_depth,
      });

      const orchestrator = await loadOrchestrator();
      const result = await orchestrator.generate({
        generationId: data.generation_id,
        workspaceId: data.workspace_id,
        vertical: data.vertical,
        prompt: data.prompt,
        kbPackIds: data.kb_pack_ids,
        parentGenerationId: data.parent_generation_id,
      });

      // Record per-agent cost. @funnel/cost-governor inside the orchestrator
      // already enforced the per-tenant ceiling — this is observability only.
      for (const agent of result.agent_breakdown ?? []) {
        llmCostUsd.inc(
          { queue: "generation", provider: agent.provider, model: agent.model_id },
          agent.cost_usd_micros / 1_000_000,
        );
      }

      // Persist the funnel JSON.
      const db = await loadDb();
      await db.prisma.funnel.upsert({
        where: { id: data.generation_id },
        update: { schema_json: result.funnel, updated_at: new Date() },
        create: {
          id: data.generation_id,
          workspace_id: data.workspace_id,
          schema_json: result.funnel,
          status: "draft",
        },
      });

      // Quality gate: regenerate once if below threshold, route to human
      // review if we've already burned the regen budget.
      if (result.quality_score < QUALITY_GATE) {
        if (data.regeneration_depth < MAX_REGEN_DEPTH) {
          log("warn", {
            msg: "quality gate triggered regeneration",
            queue: "generation",
            generation_id: data.generation_id,
            quality_score: result.quality_score,
          });
          await getQueue("generation").add(
            "generation.run",
            {
              ...data,
              regeneration_depth: data.regeneration_depth + 1,
              parent_generation_id: data.generation_id,
            },
            { priority: 1 },
          );
          emitInternal("generation_regenerated", {
            generation_id: data.generation_id,
            previous_generation_id: data.parent_generation_id,
            regenerate_reason: "quality_below_gate",
            quality_score: result.quality_score,
          });
        } else {
          await db.prisma.humanReviewQueue.create({
            data: {
              generation_id: data.generation_id,
              reason: `quality_score=${result.quality_score} below ${QUALITY_GATE} after ${data.regeneration_depth} retries`,
              priority: "high",
            },
          });
          emitInternal("human_review_required", {
            generation_id: data.generation_id,
            reason: "quality_below_gate_after_retries",
            queue: "quality",
          });
        }
      }

      // Human review required when an agent explicitly flagged it.
      if (result.requires_human_review) {
        await db.prisma.humanReviewQueue.create({
          data: {
            generation_id: data.generation_id,
            reason: "agent_requested_review",
            priority: "high",
          },
        });
        emitInternal("human_review_required", {
          generation_id: data.generation_id,
          reason: "agent_requested_review",
          queue: "compliance",
        });
      }

      // Completion event — taxonomy adds `funnel_generated` once the funnel
      // is published; for the generation lifecycle we emit the internal one.
      emitInternal("generation_completed", {
        generation_id: data.generation_id,
        workspace_id: data.workspace_id,
        duration_ms: result.duration_ms,
        cost_usd_micros: result.cost_usd_micros,
        token_usage: result.token_usage,
        final_quality_score: result.quality_score,
        agent_breakdown: result.agent_breakdown,
      });

      return {
        generation_id: data.generation_id,
        quality_score: result.quality_score,
        cost_usd_micros: result.cost_usd_micros,
      };
    },
  },
);
