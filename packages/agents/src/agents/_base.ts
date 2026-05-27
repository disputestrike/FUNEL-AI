/**
 * Internal helpers shared by every agent.
 *
 * Centralizes:
 *   - `now()` for event timestamps (so seed-based tests are deterministic).
 *   - The `ModelCallRecord` builder for LLM calls.
 *   - The cache-key composition helper.
 *   - The default "stream + finalize" flow used by every LLM agent.
 */
import {
  type AgentContext,
  type AgentEvent,
  type AgentName,
  type CacheHitRecord,
  type CostRecord,
  type ModelCallRecord,
  type ModelId,
} from "../types.js";

export function nowIso(ctx: AgentContext): string {
  return ctx.clock.now().toISOString();
}

export function startedEvent(ctx: AgentContext, agent: AgentName, modelUsed: ModelId): AgentEvent<unknown> {
  return { type: "started", ts: nowIso(ctx), agent, modelUsed };
}

export function chunkEvent(
  ctx: AgentContext,
  agent: AgentName,
  slot: string,
  delta: string,
  cumulative?: string,
): AgentEvent<unknown> {
  return { type: "chunk", ts: nowIso(ctx), agent, slot, delta, cumulative };
}

export function progressEvent(
  ctx: AgentContext,
  agent: AgentName,
  pct: number,
  note?: string,
): AgentEvent<unknown> {
  return { type: "progress", ts: nowIso(ctx), agent, pct, note };
}

export function finalEvent<T>(
  ctx: AgentContext,
  agent: AgentName,
  modelUsed: ModelId,
  output: T,
  cost: CostRecord,
  cacheHits: CacheHitRecord,
  durationMs: number,
): AgentEvent<T> {
  return {
    type: "final",
    ts: nowIso(ctx),
    agent,
    output,
    cost,
    cacheHits,
    durationMs,
    modelUsed,
  };
}

export function buildModelCall(
  result: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    costCents: number;
    modelUsed: ModelId;
  },
): ModelCallRecord {
  const totalInput = result.inputTokens + (result.cachedInputTokens ?? 0);
  return {
    model: result.modelUsed,
    category: "llm",
    unitCount: totalInput + result.outputTokens,
    unitRateCents: result.costCents / Math.max(1, totalInput + result.outputTokens),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cachedInputTokens: result.cachedInputTokens,
  };
}

export function buildCacheHits(
  inputTokens: number,
  cachedInputTokens: number,
): CacheHitRecord {
  const total = inputTokens + cachedInputTokens;
  return {
    cachedInputTokens,
    freshInputTokens: inputTokens,
    ratio: total === 0 ? 0 : cachedInputTokens / total,
  };
}

export function pickModel(ctx: AgentContext, primary: ModelId): ModelId {
  return (ctx.modelOverride as ModelId) ?? primary;
}

/** Render KB docs as a compact list for prompt injection. */
export function renderKb(docs: { id: string; source: string; chunk: string }[] | undefined): string {
  if (!docs || docs.length === 0) return "(no KB excerpts available)";
  return docs
    .map((d, i) => `[KB ${i + 1} — ${d.source} (id ${d.id})]\n${d.chunk}`)
    .join("\n\n");
}

/** Render Business Profile compactly for prompts. */
export function renderBusinessProfile(profile: AgentContext["businessProfile"]): string {
  return JSON.stringify(
    {
      businessName: profile.businessName,
      industry: profile.industry,
      subIndustry: profile.subIndustry,
      geography: profile.geography,
      language: profile.language,
      offer: profile.offer,
      targetCustomer: profile.targetCustomer,
      proof: profile.proof,
      brand: profile.brand,
      contact: { website: profile.contact?.website },
      regulated: profile.regulated,
      notes: profile.notes,
    },
    null,
    2,
  );
}
