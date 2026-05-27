/**
 * Orchestrator core types — see `docs/19-orchestrator-code-spec.md` Part A + B.
 *
 * This module is the single source of truth for the shapes the orchestrator
 * exposes to the outside world (HTTP/SSE adapter, tests, cg-svc, HRQ).
 * Agent-specific output types (HookOutput, PageOutput, …) live with their
 * agent implementations; the orchestrator treats them as opaque `unknown`
 * payloads inside the assembled draft.
 */

import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Model identifiers + fallback chains (Doc 19 §B.1, §G.3)
 * ------------------------------------------------------------------------ */

export type ModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "flux-1.1-pro"
  | "ideogram-v2"
  | "unsplash-stock"
  | "runway-gen-3"
  | "veo-3"
  | "stock-broll"
  | "eleven-multilingual-v3"
  | "cartesia-sonic";

/** Doc 19 §G.3 — fallback chain per primary model. */
export const FALLBACK_CHAINS: Record<ModelId, ModelId[]> = {
  "claude-opus-4-7": ["claude-sonnet-4-6", "gpt-4o"],
  "claude-sonnet-4-6": ["claude-haiku-4-5", "gpt-4o-mini"],
  "claude-haiku-4-5": ["gpt-4o-mini"],
  "gpt-4o": ["claude-sonnet-4-6"],
  "gpt-4o-mini": ["claude-haiku-4-5"],
  "flux-1.1-pro": ["ideogram-v2", "unsplash-stock"],
  "ideogram-v2": ["unsplash-stock"],
  "unsplash-stock": [],
  "runway-gen-3": ["veo-3", "stock-broll"],
  "veo-3": ["stock-broll"],
  "stock-broll": [],
  "eleven-multilingual-v3": ["cartesia-sonic"],
  "cartesia-sonic": [],
};

/* ---------------------------------------------------------------------------
 * Agents + archetypes
 * ------------------------------------------------------------------------ */

export type AgentName =
  | "planner"
  | "hook"
  | "page"
  | "lead_magnet"
  | "image"
  | "video"
  | "ad_copy"
  | "audience"
  | "email"
  | "sms"
  | "voice_script"
  | "upsell"
  | "fact_check"
  | "compliance"
  | "qa"
  | "brand_guardian";

export const ALL_AGENTS: AgentName[] = [
  "planner",
  "hook",
  "page",
  "lead_magnet",
  "image",
  "video",
  "ad_copy",
  "audience",
  "email",
  "sms",
  "voice_script",
  "upsell",
  "fact_check",
  "compliance",
  "qa",
  "brand_guardian",
];

export type ArchetypeId =
  | "lead_magnet_optin"
  | "free_consult_booking"
  | "tripwire"
  | "webinar_evergreen"
  | "application_funnel"
  | "product_launch";

export type Tier = "starter" | "growth" | "scale" | "agency";

/* ---------------------------------------------------------------------------
 * BusinessProfile (minimum surface — orchestrator hands this to the agents
 * untouched; we don't try to model the entire Doc 12 §4.2 shape here)
 * ------------------------------------------------------------------------ */

export const BusinessProfileSchema = z
  .object({
    workspace_id: z.string(),
    industry: z.string(),
    geography: z.string().length(2),
    offer: z.string(),
    target_customer: z.string(),
    price_point_cents: z.number().int().nonnegative().optional(),
    sales_cycle_days: z.number().int().nonnegative().optional(),
    awareness: z.enum(["cold", "warm", "hot"]).optional(),
    brand: z
      .object({
        logo_url: z.string().url().optional(),
        primary_color: z.string().optional(),
        voice_samples: z.array(z.string()).optional(),
      })
      .optional(),
    proof: z
      .object({
        testimonials: z.array(z.string()).optional(),
        case_studies: z.array(z.string()).optional(),
        sourced_stats: z.array(z.object({ stat: z.string(), source: z.string() })).optional(),
      })
      .optional(),
  })
  .passthrough();

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/* ---------------------------------------------------------------------------
 * GenerationInput (Doc 19 §A.3)
 * ------------------------------------------------------------------------ */

export const GenerationOptionsSchema = z.object({
  tier: z.enum(["starter", "growth", "scale", "agency"]).optional(),
  archetypeHint: z
    .enum([
      "lead_magnet_optin",
      "free_consult_booking",
      "tripwire",
      "webinar_evergreen",
      "application_funnel",
      "product_launch",
    ])
    .optional(),
  skipAgents: z.array(z.string()).optional(),
  forceHumanReview: z.boolean().optional(),
  seed: z.number().int().optional(),
  budgetCapCents: z.number().int().positive().optional(),
  locale: z
    .object({
      tone: z.enum(["formal", "casual"]).optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
});

export const GenerationInputSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  businessProfile: BusinessProfileSchema,
  language: z.string().min(2),
  geography: z.string().length(2),
  options: GenerationOptionsSchema.optional(),
  idempotencyKey: z.string().min(1),
});

export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;
export type GenerationInput = z.infer<typeof GenerationInputSchema>;

/* ---------------------------------------------------------------------------
 * GenerationEvent (Doc 19 §A.3, §D.2) — the SSE wire envelope
 * ------------------------------------------------------------------------ */

export type GenerationStartedData = {
  generationId: string;
  workspaceId: string;
  estimatedDurationMs: number;
  estimatedCostCents: number;
  budgetCapCents: number;
  archetypeHint?: ArchetypeId;
  ts: string;
};

export type PlannerCompletedData = {
  generationId: string;
  archetype: ArchetypeId;
  rationale: string;
  agentsDispatched: AgentName[];
  ts: string;
};

export type AgentStartedData = {
  generationId: string;
  agent: AgentName;
  modelUsed: ModelId;
  estimatedDurationMs: number;
  ts: string;
};

export type AgentChunkData = {
  generationId: string;
  agent: AgentName;
  slot: string;
  delta: string;
  cumulative?: string;
  ts: string;
};

export type AgentCompletedData = {
  generationId: string;
  agent: AgentName;
  output: unknown;
  costCents: number;
  durationMs: number;
  cacheHitRatio: number;
  ts: string;
};

export type QualityScoredData = {
  generationId: string;
  overall: number;
  dimensions: Record<string, number>;
  failingDimensions: { name: string; reason: string }[];
  ts: string;
};

export type ComplianceFlagData = {
  generationId: string;
  severity: "block" | "fix" | "note";
  ruleId: string;
  excerpt: string;
  agent: AgentName;
  ts: string;
};

export type HumanReviewData = {
  generationId: string;
  queueId: string;
  reason: "compliance_block" | "factcheck_block" | "quality_low" | "force_flag";
  estimatedWaitMs: number;
  ts: string;
};

export type RegenerationData = {
  generationId: string;
  failing: string[];
  agentsToRerun: AgentName[];
  ts: string;
};

export type BudgetWarningData = {
  generationId: string;
  spentCents: number;
  capCents: number;
  pctUsed: number;
  ts: string;
};

export type DegradationAction =
  | "downgrade_model"
  | "skip_optional"
  | "use_cache"
  | "truncate";

export type DegradationData = {
  generationId: string;
  trigger: "budget_100" | "budget_150" | "rate_limit" | "provider_outage";
  actions: DegradationAction[];
  ts: string;
};

export type GenerationCompletedData = {
  generationId: string;
  funnelId: string;
  url: string;
  totalCostCents: number;
  durationMs: number;
  ts: string;
};

export type GenerationFailedData = {
  generationId: string;
  reason: string;
  code:
    | "budget_overrun"
    | "compliance_block"
    | "provider_outage"
    | "user_cancelled"
    | "internal";
  partialFunnelId?: string;
  ts: string;
};

export type GenerationEvent =
  | { type: "generation_started"; data: GenerationStartedData }
  | { type: "planner_started"; data: { generationId: string; ts: string } }
  | { type: "planner_completed"; data: PlannerCompletedData }
  | { type: "agent_started"; data: AgentStartedData }
  | { type: "agent_chunk"; data: AgentChunkData }
  | { type: "agent_completed"; data: AgentCompletedData }
  | { type: "assembly_started"; data: { generationId: string; ts: string } }
  | { type: "quality_scored"; data: QualityScoredData }
  | { type: "compliance_flagged"; data: ComplianceFlagData }
  | { type: "human_review_required"; data: HumanReviewData }
  | { type: "regeneration_started"; data: RegenerationData }
  | { type: "budget_warning"; data: BudgetWarningData }
  | { type: "degradation_applied"; data: DegradationData }
  | { type: "funnel_published"; data: { generationId: string; funnelId: string; url: string; ts: string } }
  | { type: "generation_completed"; data: GenerationCompletedData }
  | { type: "generation_failed"; data: GenerationFailedData };

export type GenerationEventType = GenerationEvent["type"];

/* ---------------------------------------------------------------------------
 * Cost meter records (Doc 19 §E.1)
 * ------------------------------------------------------------------------ */

export type CostCategory =
  | "llm"
  | "image"
  | "video"
  | "voice_tts"
  | "voice_asr"
  | "voice_telephony"
  | "sms"
  | "email"
  | "storage"
  | "scraping"
  | "search";

export type ModelCallRecord = {
  model: ModelId;
  category: CostCategory;
  unitCount: number;
  unitRateCents: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  metadata?: Record<string, string | number>;
};

export type CostRecord = {
  totalCents: number;
  calls: ModelCallRecord[];
};

export type CostRecommendation = {
  status: "ok" | "near_limit_80" | "exhausted" | "overrun";
  recommendation:
    | "continue"
    | "downgrade_next"
    | "cache_if_possible"
    | "skip_optional"
    | "halt";
  remainingCents: number;
};

export type CacheHitRecord = {
  cachedInputTokens: number;
  freshInputTokens: number;
  ratio: number;
};

/* ---------------------------------------------------------------------------
 * Agent context + agent interface (Doc 19 §B.1)
 * ------------------------------------------------------------------------ */

export type AgentError =
  | { kind: "transient"; httpStatus: 429 | 500 | 502 | 503 | 504; provider: string }
  | { kind: "rate_limit"; provider: string; retryAfterMs?: number }
  | { kind: "content_policy"; provider: string; reason: string }
  | { kind: "auth"; provider: string }
  | { kind: "schema_invalid"; errors: { path: (string | number)[]; message: string }[] }
  | { kind: "safety_block"; classifier: string; reason: string }
  | { kind: "timeout"; phase: "connect" | "first_byte" | "overall" }
  | { kind: "budget"; remainingCents: number }
  | { kind: "cancelled" }
  | { kind: "unknown"; raw: unknown };

export type AgentEvent<T> =
  | { type: "started"; ts: string }
  | { type: "chunk"; delta: Partial<T>; raw?: string; slot?: string }
  | { type: "progress"; pct: number; note?: string }
  | { type: "final"; output: T; cost: CostRecord; cacheHits: CacheHitRecord }
  | { type: "error"; error: AgentError; willRetry: boolean };

export interface Agent<TInput, TOutput> {
  readonly name: AgentName;
  readonly primaryModel: ModelId;
  readonly fallbackChain: ModelId[];
  run(input: TInput, ctx: AgentContext): AsyncIterable<AgentEvent<TOutput>>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface Clock {
  now(): number;
  iso(): string;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  iso: () => new Date().toISOString(),
};

/** Planner output — concretely typed (Doc 19 §B.2.1) so the orchestrator can
 *  schedule Phase 2 without parsing JSON twice. */
export type PlannerDispatch = Partial<
  Record<
    Exclude<AgentName, "planner">,
    {
      brief: string;
      priority: "must" | "should" | "optional";
      cacheKeys?: string[];
    }
  >
>;

export type PlannerOutput = {
  archetype: ArchetypeId;
  rationale: string;
  audienceHypothesis: string;
  primaryPromise: string;
  angles: string[];
  dispatch: PlannerDispatch;
  estimatedCostCents: number;
  estimatedDurationMs: number;
};

export type BrandTokensOutput = {
  palette: { primary: string; secondary: string; accent: string; bg: string; fg: string };
  typography: { headingFont: string; bodyFont: string; scale: number[] };
  voice: {
    register: "formal" | "casual" | "authoritative" | "playful";
    bannedWords: string[];
    signaturePhrases: string[];
  };
  imagery: { mood: string; lighting: string; subjectGuidance: string };
  logoUsage?: { url: string; clearspace: string; minWidthPx: number };
};

export interface AgentContext {
  generationId: string;
  workspaceId: string;
  userId: string;
  language: string;
  geography: string;
  businessProfile: BusinessProfile;
  plan: PlannerOutput | null;
  brandTokens?: BrandTokensOutput | null;
  kb: KbClient;
  cache: PromptCacheClient;
  recordCost: (
    agentName: AgentName,
    modelCalls: ModelCallRecord[],
  ) => Promise<CostRecommendation>;
  logger: Logger;
  abortSignal: AbortSignal;
  clock: Clock;
  seed?: number;
  /** Set by the retry middleware on each attempt. */
  _modelOverride?: ModelId;
  /** Set by the retry middleware after a schema-invalid attempt. */
  _priorErrors?: { path: (string | number)[]; message: string }[];
  /** Used by Image agent when Brand Guardian has finished. */
  _brandTokensPromise?: Promise<BrandTokensOutput>;
}

/* ---------------------------------------------------------------------------
 * External client surfaces (orchestrator depends on, doesn't implement)
 * ------------------------------------------------------------------------ */

export interface AnthropicClient {
  invoke(args: {
    model: ModelId;
    system: { text: string; cache?: { key: string } }[];
    user: { text: string; cache?: { key: string } }[];
    maxTokens: number;
    temperature?: number;
    stream?: boolean;
    abortSignal?: AbortSignal;
  }): AsyncIterable<{ delta?: string; final?: string; usage?: { input: number; output: number; cachedInput?: number } }>;
}

export interface OpenAIClient {
  invoke(args: {
    model: ModelId;
    system: string;
    user: string;
    maxTokens: number;
    temperature?: number;
    abortSignal?: AbortSignal;
  }): AsyncIterable<{ delta?: string; final?: string; usage?: { input: number; output: number } }>;
}

export interface ImageGenClient {
  generate(args: {
    model: ModelId;
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; thumbUrl: string; modelUsed: ModelId; safety: { ok: boolean; reason?: string } }>;
}

export interface VideoGenClient {
  generate(args: {
    model: ModelId;
    prompt: string;
    durationS: number;
    heroImageUrl?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; thumbUrl: string; durationS: number; modelUsed: ModelId; safety: { ok: boolean; reason?: string } }>;
}

export interface VoiceGenClient {
  synthesize(args: {
    model: ModelId;
    text: string;
    voiceId: string;
  }): Promise<{ url: string; durationS: number }>;
}

export interface KbClient {
  retrieve(args: { pack: string; query: string; topK?: number }): Promise<KbExcerpt[]>;
}

export type KbExcerpt = {
  id: string;
  source: string;
  text: string;
  score: number;
};

export interface CostGovernorClient {
  reserve(args: { workspaceId: string; generationId: string; tier?: Tier; budgetCapCents?: number }): Promise<{ capCents: number }>;
  charge(args: {
    workspaceId: string;
    generationId: string;
    agent: AgentName;
    calls: ModelCallRecord[];
  }): Promise<CostRecommendation>;
  peek(generationId: string): Promise<CostRecommendation>;
  close(args: { generationId: string; terminalState: string }): Promise<void>;
}

export interface HumanReviewQueueClient {
  shouldQueue(args: { findings: ComplianceFlagData[]; qa?: QualityScoredData; force?: boolean }): boolean;
  enqueue(args: {
    generationId: string;
    workspaceId: string;
    reason: HumanReviewData["reason"];
    draftHash: string;
  }): Promise<{ queueId: string; estimatedWaitMs: number }>;
  awaitDecision(queueId: string, abortSignal: AbortSignal): Promise<{ decision: "approved" | "rejected"; notes?: string }>;
}

export interface PromptCacheClient {
  get(key: string): Promise<{ text: string; tokens: number } | null>;
  set(key: string, value: { text: string; tokens: number }, ttlSec?: number): Promise<void>;
  /** Best-effort token-saving stat over the last hour. */
  hitRate(): Promise<number>;
}

export interface DbClient {
  insertAuditRow(row: AuditRow): Promise<void>;
  insertCostLedgerRow(row: CostLedgerRow): Promise<void>;
  insertFunnelRow(row: FunnelRow): Promise<string>;
  /** Lookup an in-flight or completed generation by idempotency key. */
  findGenerationByIdempotency(args: { workspaceId: string; idempotencyKey: string }): Promise<{ generationId: string; terminal: boolean } | null>;
  /** Mark a generation as started (idempotently). */
  upsertGeneration(args: { generationId: string; workspaceId: string; userId: string; inputHash: string; idempotencyKey: string; status: string }): Promise<void>;
  /** Stream of past audit rows for resume(). */
  loadAuditTrail(generationId: string): Promise<AuditRow[]>;
  updateGenerationStatus(generationId: string, status: string): Promise<void>;
}

export type AuditRow = {
  generation_id: string;
  workspace_id: string;
  agent: AgentName | "system";
  step: string;
  model_used?: ModelId;
  prompt_hash?: string;
  output_hash?: string;
  kb_sources?: string[];
  cost_cents?: number;
  cache_hit_ratio?: number;
  ts: string;
  meta?: Record<string, unknown>;
};

export type CostLedgerRow = {
  generation_id: string;
  workspace_id: string;
  terminal_state: string;
  total_cents: number;
  budget_cents: number;
  llm_cents: number;
  image_cents: number;
  video_cents: number;
  voice_cents: number;
  other_cents: number;
  calls_json: ModelCallRecord[];
  started_at: string;
  ended_at: string;
};

export type FunnelRow = {
  id?: string;
  workspace_id: string;
  generation_id: string;
  archetype: ArchetypeId;
  draft: Record<string, unknown>;
  status: "draft" | "published" | "partial";
  url: string;
  created_at: string;
};

export interface EventBusClient {
  publish(eventName: string, payload: Record<string, unknown>): Promise<void>;
}

export interface TrustSafetyClient {
  classify(args: {
    text: string;
    workspaceId: string;
    geography: string;
  }): Promise<{ pass: boolean; reasons: string[] }>;
}

/* ---------------------------------------------------------------------------
 * Orchestrator deps + class signature (Doc 19 §A.3)
 * ------------------------------------------------------------------------ */

export interface OrchestratorDeps {
  anthropic: AnthropicClient;
  openai: OpenAIClient;
  imageGen: ImageGenClient;
  videoGen: VideoGenClient;
  voiceGen: VoiceGenClient;
  kb: KbClient;
  cg: CostGovernorClient;
  hrq: HumanReviewQueueClient;
  db: DbClient;
  events: EventBusClient;
  cache: PromptCacheClient;
  trustSafety: TrustSafetyClient;
  clock: Clock;
  logger: Logger;
  /** Optional override for testing — defaults to the bundled agent registry. */
  agentRegistry?: Map<AgentName, Agent<unknown, unknown>>;
}

/* ---------------------------------------------------------------------------
 * Assembled draft shape — opaque per-agent outputs keyed by agent name
 * ------------------------------------------------------------------------ */

export type AssembledDraft = {
  generationId: string;
  archetype: ArchetypeId;
  outputs: Partial<Record<AgentName, unknown>>;
  /** Set after Phase 3 — used by QA + HRQ. */
  findings: ComplianceFlagData[];
  /** Hash of the assembled draft body — used as the audit pointer. */
  draftHash: string;
};
