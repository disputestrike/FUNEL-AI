/**
 * Zod schemas for the Generation domain.
 */

import { z } from "zod";

export const GenerationAgentNameSchema = z.enum([
  "planner_agent",
  "research_agent",
  "copy_agent",
  "designer_agent",
  "compliance_agent",
  "fact_check_agent",
  "image_agent",
  "video_agent",
  "quality_agent",
  "scoring_agent",
  "outreach_agent",
  "revtry_agent",
]);

export const GenerationStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "canceled",
  "human_review",
]);

export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cache_read: z.number().int().nonnegative().optional(),
  cache_write: z.number().int().nonnegative().optional(),
});

export const VoicePersonaSchema = z.enum([
  "funnel",
  "maven",
  "coach",
  "rebel",
  "maestro",
]);

export const GenerationInputSchema = z.object({
  workspace_id: z.string().min(1),
  requested_by_user_id: z.string().optional(),
  brief: z.object({
    industry: z.string(),
    vertical: z.string().optional(),
    language: z.string(),
    geography: z
      .object({
        country: z.string().length(2).optional(),
        region: z.string().optional(),
        timezone: z.string().optional(),
      })
      .optional(),
    persona: VoicePersonaSchema,
    user_prompt: z.string(),
    seed_copy: z.array(z.string()).optional(),
    brand_assets_urls: z.array(z.string().url()).optional(),
    primary_goal: z.enum([
      "lead_capture",
      "booking",
      "checkout",
      "newsletter",
      "application",
    ]),
  }),
  kb_pack_ids: z.array(z.string()),
  parent_funnel_id: z.string().optional(),
  parent_generation_id: z.string().optional(),
  seed: z.number().int().optional(),
  regenerate_reason: z.string().optional(),
});

export const GenerationEventSchema = z.object({
  generation_id: z.string().min(1),
  agent_id: GenerationAgentNameSchema,
  agent_version: z.string(),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
  output_hash: z.string().regex(/^[a-f0-9]{64}$/),
  duration_ms: z.number().int().nonnegative(),
  token_usage: TokenUsageSchema,
  cost_usd_micros: z.number().int().nonnegative(),
  outcome: z.enum(["ok", "retry", "fail", "blocked"]),
  model_id: z.string().optional(),
  temperature: z.number().optional(),
  tools_called: z.array(z.string()).optional(),
  retries: z.number().int().nonnegative().optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  invoked_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
});

export const QualityScoreSchema = z.object({
  generation_id: z.string().min(1),
  score: z.number().min(0).max(100),
  rubric_version: z.string(),
  dimensions: z.record(z.number()),
  rater: z.enum(["auto", "human"]),
  reference_set_id: z.string().optional(),
  computed_at: z.string().datetime(),
});

export const GenerationSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  funnel_id: z.string().optional(),
  status: GenerationStatusSchema,
  input: GenerationInputSchema,
  events: z.array(GenerationEventSchema),
  quality_score: QualityScoreSchema.optional(),
  final_quality_score: z.number().min(0).max(100).optional(),
  output_asset_ids: z.array(z.string()).optional(),
  cache_hit_ratio: z.number().min(0).max(1).optional(),
  cost_usd_micros: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative().optional(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  failed_at: z.string().datetime().optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
});
