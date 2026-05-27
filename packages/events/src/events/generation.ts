import { z } from "zod";

const genId = z.string().min(1);

export const Schemas = {
  generation_started: z.object({ generation_id: genId, workspace_id: z.string(), estimated_cost_cents: z.number(), estimated_duration_ms: z.number().int().nonnegative() }),
  generation_completed: z.object({ generation_id: genId, funnel_id: z.string(), total_cost_cents: z.number(), duration_ms: z.number().int().nonnegative() }),
  generation_failed: z.object({ generation_id: genId, reason: z.string(), code: z.string() }),
  agent_completed: z.object({ generation_id: genId, agent: z.string(), cost_cents: z.number(), duration_ms: z.number().int().nonnegative(), cache_hit_ratio: z.number().min(0).max(1) }),
  quality_scored: z.object({ generation_id: genId, overall: z.number().min(0).max(100), failing_dimensions: z.array(z.string()) }),
  compliance_flagged: z.object({ generation_id: genId, severity: z.string(), rule_id: z.string() }),
  human_review_required: z.object({ generation_id: genId, queue_id: z.string(), reason: z.string() }),
  regeneration_started: z.object({ generation_id: genId, agents_to_rerun: z.array(z.string()) }),
  degradation_applied: z.object({ generation_id: genId, trigger: z.string(), actions: z.array(z.string()) }),
  budget_warning: z.object({ generation_id: genId, spent_cents: z.number().nonnegative(), cap_cents: z.number().nonnegative(), pct_used: z.number().min(0).max(2) }),
} as const;
