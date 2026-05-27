/**
 * Prompt-caching strategy (Doc 19 §F).
 *
 * Anthropic prompt caching uses `cache_control: { type: 'ephemeral' }` markers
 * on system + user blocks. Our agents call into this module to **describe**
 * the cacheable prefix; the adapter (`AnthropicClient.invoke`) translates the
 * `cache: { key }` annotations into provider-specific markers.
 *
 * The orchestrator caches:
 *   1. Agent system prompt + role + constraints      → `sys:{agent}:v{n}`
 *   2. Few-shot examples per agent + industry        → `fewshot:{agent}:{industry}:v{n}`
 *   3. Industry KB excerpts                          → `industry:{industry}:{geo}:v{n}`
 *   4. Compliance rules library                      → `compliance:{geo}:{industry}:v{n}`
 *   5. Archetype templates                           → `archetypes:v{n}`
 *   6. Hooks library                                 → `hooks:{industry}:v{n}`
 *   7. Brand Guardian style guide (per workspace)    → `brand:{workspaceId}:v{n}`
 *
 * Fresh tail is whatever changes per call: Business Profile, brief,
 * per-call variables.
 */

import type { AgentName, PromptCacheClient } from "./types.js";

/** Current prompt-pack version. Bump when prompts change to invalidate cache. */
export const PROMPT_VERSION = 3;
export const COMPLIANCE_PACK_VERSION = 4;
export const ARCHETYPES_VERSION = 2;

export type CacheBlock = {
  text: string;
  /** Stable cache key — present iff this block should be marked cacheable. */
  cacheKey?: string;
  /** Approximate token count (we cache things ≥ 1K tokens; smaller blocks
   *  rarely pay back the bookkeeping). */
  approxTokens?: number;
};

export function sysKey(agent: AgentName, version = PROMPT_VERSION): string {
  return `sys:${agent}:v${version}`;
}

export function fewshotKey(agent: AgentName, industry: string, version = PROMPT_VERSION): string {
  return `fewshot:${agent}:${industry}:v${version}`;
}

export function industryKey(industry: string, geography: string, version = PROMPT_VERSION): string {
  return `industry:${industry}:${geography}:v${version}`;
}

export function complianceKey(
  geography: string,
  industry: string,
  archetype: string,
  version = COMPLIANCE_PACK_VERSION,
): string {
  return `compliance:${geography}:${industry}:${archetype}:v${version}`;
}

export function archetypesKey(version = ARCHETYPES_VERSION): string {
  return `archetypes:v${version}`;
}

export function hooksKey(industry: string, version = PROMPT_VERSION): string {
  return `hooks:${industry}:v${version}`;
}

export function brandKey(workspaceId: string, version = PROMPT_VERSION): string {
  return `brand:${workspaceId}:v${version}`;
}

/**
 * Helper used by agents to assemble a cacheable system message in the
 * provider-agnostic shape `{ text, cache?: { key } }[]`.
 *
 * Order matters — anything stable goes first so the cache hit is maximal.
 */
export function buildSystemBlocks(args: {
  agent: AgentName;
  sysText: string;
  fewshotText?: string;
  industry?: string;
}): CacheBlock[] {
  const blocks: CacheBlock[] = [{ text: args.sysText, cacheKey: sysKey(args.agent) }];
  if (args.fewshotText && args.industry) {
    blocks.push({
      text: args.fewshotText,
      cacheKey: fewshotKey(args.agent, args.industry),
    });
  }
  return blocks;
}

export function buildUserBlocks(args: {
  industry?: string;
  geography?: string;
  industryKb?: string;
  complianceRules?: string;
  archetypeTemplates?: string;
  brandTokens?: string;
  workspaceId?: string;
  archetype?: string;
  freshTail: string;
}): CacheBlock[] {
  const blocks: CacheBlock[] = [];
  if (args.industryKb && args.industry && args.geography) {
    blocks.push({
      text: args.industryKb,
      cacheKey: industryKey(args.industry, args.geography),
    });
  }
  if (args.archetypeTemplates) {
    blocks.push({ text: args.archetypeTemplates, cacheKey: archetypesKey() });
  }
  if (
    args.complianceRules &&
    args.industry &&
    args.geography &&
    args.archetype
  ) {
    blocks.push({
      text: args.complianceRules,
      cacheKey: complianceKey(args.geography, args.industry, args.archetype),
    });
  }
  if (args.brandTokens && args.workspaceId) {
    blocks.push({ text: args.brandTokens, cacheKey: brandKey(args.workspaceId) });
  }
  blocks.push({ text: args.freshTail }); // NOT cached
  return blocks;
}

/**
 * Application-layer cache for things Anthropic's 5-minute TTL is too short for
 * (notably Brand Guardian output). Backed by `PromptCacheClient`.
 */
export class ApplicationCache {
  constructor(private readonly client: PromptCacheClient) {}

  async getBrandTokens<T>(workspaceId: string): Promise<T | null> {
    const raw = await this.client.get(brandKey(workspaceId));
    if (!raw) return null;
    try {
      return JSON.parse(raw.text) as T;
    } catch {
      return null;
    }
  }

  async setBrandTokens<T>(workspaceId: string, value: T): Promise<void> {
    const text = JSON.stringify(value);
    // 24h TTL — brand tokens are stable per workspace.
    await this.client.set(brandKey(workspaceId), { text, tokens: estimateTokens(text) }, 60 * 60 * 24);
  }
}

/** ~4 chars per token as a cheap heuristic — close enough for cache sizing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
