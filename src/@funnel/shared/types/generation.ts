/**
 * Generation domain types.
 *
 * One end-to-end run of the agent pipeline is a `Generation`. Each agent
 * invocation inside it emits an `agent_invoked` event. The final
 * `QualityScore` gates promotion to publish.
 */

import type { FunnelId, GenerationId } from "./funnel.js";
import type { UserId, WorkspaceId } from "./workspace.js";
import type { VoicePersona } from "./persona.js";

export type { GenerationId } from "./funnel.js";

/**
 * Generation agent identity.
 *
 * Named `GenerationAgentName` to avoid colliding with the Funnel Grader's
 * `AgentName` string-union (defined in `./grader.ts`). The generation
 * pipeline is a strict superset of agents — grader names are a subset.
 */
export enum GenerationAgentName {
  Planner = "planner_agent",
  Research = "research_agent",
  Copy = "copy_agent",
  Designer = "designer_agent",
  Compliance = "compliance_agent",
  FactCheck = "fact_check_agent",
  Image = "image_agent",
  Video = "video_agent",
  Quality = "quality_agent",
  Scoring = "scoring_agent",
  Outreach = "outreach_agent",
  RevTry = "revtry_agent",
}

export enum GenerationStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Canceled = "canceled",
  HumanReview = "human_review",
}

export interface TokenUsage {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
}

/**
 * The seed for a generation run. Coming from the onboarding wizard, an
 * importer, or a "regenerate" click. Hashable for deterministic replays.
 */
export interface GenerationInput {
  workspace_id: WorkspaceId;
  requested_by_user_id?: UserId;
  /** Onboarding / regeneration intent payload. */
  brief: {
    industry: string;
    vertical?: string;
    language: string;
    geography?: { country?: string; region?: string; timezone?: string };
    persona: VoicePersona;
    /** Short freeform problem statement from the user. */
    user_prompt: string;
    /** Pre-existing copy fragments the user wants preserved. */
    seed_copy?: string[];
    /** Known brand assets and references. */
    brand_assets_urls?: string[];
    /** Goal: capture, book, sell, etc. */
    primary_goal: "lead_capture" | "booking" | "checkout" | "newsletter" | "application";
  };
  /** KB packs to load (e.g. "solar-1.4.0", "ftc-truth-in-ads"). */
  kb_pack_ids: string[];
  parent_funnel_id?: FunnelId;
  parent_generation_id?: GenerationId;
  /** Deterministic seed for reproducibility. */
  seed?: number;
  /** Optional regenerate intent ("regen_with_more_proof", "shorter_form"). */
  regenerate_reason?: string;
}

/**
 * One agent invocation within a generation. Persisted to `agent_invocations`
 * and emitted as the `agent_invoked` event.
 */
export interface GenerationEvent {
  generation_id: GenerationId;
  agent_id: GenerationAgentName;
  agent_version: string;
  /** SHA-256 over the canonicalized input to this agent. */
  input_hash: string;
  output_hash: string;
  duration_ms: number;
  token_usage: TokenUsage;
  cost_usd_micros: number;
  outcome: "ok" | "retry" | "fail" | "blocked";
  model_id?: string;
  temperature?: number;
  tools_called?: string[];
  retries?: number;
  /** Set when `outcome` is `fail` or `blocked`. */
  error_code?: string;
  error_message?: string;
  invoked_at: string;
  completed_at?: string;
}

/** Quality rubric output — see `quality_score_computed` event. */
export interface QualityScore {
  generation_id: GenerationId;
  score: number; // 0..100
  rubric_version: string;
  /** Per-dimension breakdown. Common dimensions: clarity, persuasion, brand_fit, compliance, structure, originality. */
  dimensions: Record<string, number>;
  rater: "auto" | "human";
  reference_set_id?: string;
  computed_at: string;
}

export interface Generation {
  id: GenerationId;
  workspace_id: WorkspaceId;
  funnel_id?: FunnelId;
  status: GenerationStatus;
  input: GenerationInput;
  events: GenerationEvent[];
  quality_score?: QualityScore;
  final_quality_score?: number;
  output_asset_ids?: string[];
  cache_hit_ratio?: number;
  cost_usd_micros: number;
  duration_ms?: number;
  started_at: string;
  completed_at?: string;
  failed_at?: string;
  error_code?: string;
  error_message?: string;
}
