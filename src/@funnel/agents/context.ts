/**
 * AgentContext factory + helpers.
 *
 * The orchestrator constructs an AgentContext once per generation and passes
 * the same instance through every agent. Agents must not mutate the context;
 * the only mutable boundary is the `recordCost` callback.
 */
import {
  type AgentContext,
  type AgentEvent,
  type AgentName,
  type BusinessProfile,
  type Clock,
  type CostRecommendation,
  type KbClient,
  type Logger,
  type ModelCallRecord,
  type PromptCacheClient,
  type Tier,
  type VoicePersona,
  defaultPersonaForIndustry,
} from "./types.js";

export interface BuildContextParams {
  generationId: string;
  workspaceId: string;
  userId: string;
  businessProfile: BusinessProfile;
  tier: Tier;
  voicePersona?: VoicePersona;
  kb: KbClient;
  cache: PromptCacheClient;
  logger: Logger;
  clock?: Clock;
  abortSignal?: AbortSignal;
  seed?: number;
  kbPackVersion?: string;
  recordCost: (
    agentName: AgentName,
    modelCalls: ModelCallRecord[],
  ) => Promise<CostRecommendation>;
  emit?: (event: AgentEvent<unknown>) => void;
}

export const defaultClock: Clock = { now: () => new Date() };

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function buildContext(params: BuildContextParams): AgentContext {
  const persona =
    params.voicePersona ??
    defaultPersonaForIndustry(params.businessProfile.industry ?? "other");

  return {
    generationId: params.generationId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    language: params.businessProfile.language,
    geography: params.businessProfile.geography.country,
    tier: params.tier,
    industry: params.businessProfile.industry,
    voicePersona: persona,
    businessProfile: params.businessProfile,
    plan: null,
    brandTokens: null,
    kb: params.kb,
    cache: params.cache,
    logger: params.logger,
    clock: params.clock ?? defaultClock,
    abortSignal: params.abortSignal ?? new AbortController().signal,
    seed: params.seed,
    kbPackVersion: params.kbPackVersion ?? "1",
    recordCost: params.recordCost,
    emit: params.emit,
  };
}

/** Mutator helper — produces a new context with the planner result set. */
export function withPlan<T>(ctx: AgentContext, plan: T): AgentContext {
  return { ...ctx, plan };
}

/** Mutator helper — produces a new context with brand tokens set. */
export function withBrandTokens<B>(ctx: AgentContext, brandTokens: B): AgentContext {
  return { ...ctx, brandTokens };
}

/** Mutator helper — model override (from retry/budget middleware). */
export function withModelOverride(ctx: AgentContext, override: string): AgentContext {
  return { ...ctx, modelOverride: override as never };
}
