/**
 * Audience Agent â€” targeting parameters per ad platform.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.8
 * Model: Claude Sonnet 4.6
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type AudienceInput,
  type AudienceOutput,
  AudienceOutputSchema,
  type ModelId,
} from "../types.js";
import {
  buildCacheHits,
  buildModelCall,
  chunkEvent,
  finalEvent,
  nowIso,
  pickModel,
  renderBusinessProfile,
  renderKb,
  startedEvent,
} from "./_base.js";

const SYSTEM_PROMPT_HEAD = `You are the Audience agent of GoFunnelAI's autonomous generation engine.
You produce primary + secondary personas and per-platform targeting specs.

PERSONAS:
Each persona is a real archetype, not a demographic abstraction. Required fields:
  name (e.g. "Hands-on HVAC Owner"), role, jobToBeDone, demographics, psychographics.
Include 1 primary + 2-3 secondary personas. Personas must collectively cover at
least 70% of expected lead volume.

PLATFORM TARGETING:

Meta:
  interests: 5-15, each â‰¥1k audience size; do NOT use protected categories
    (health condition, financial-distress, race, religion, sexual orientation).
  behaviors: 0-5
  demographics: age, gender, geo, language, life events, education, parental,
    job titles (if available)
  excludes: 3-8 exclusion audiences (existing customers, churned leads, etc.)

Google Ads:
  keywords: 15-30 (mix exact-match + phrase-match), grouped by intent stage
  negKeywords: 10-30 (job seekers, free, cheap, DIY, careers, news, etc.)
  demographics: age, household income (where allowed), parental, geo

TikTok:
  interests: 5-12 native TikTok interest categories
  demographics: age (18+ for any monetization-related), geo, language

LinkedIn:
  jobTitles: 10-25 specific job titles (and variations)
  industries: 3-8 industry tags
  seniorities: which levels (manager, director, VP, C-suite)

LOOKALIKE SEED:
Recommend the best source for a lookalike audience:
  customer_list  â€” best if BusinessProfile has 500+ closed customers
  pixel_event    â€” best if there's existing pixel traffic with conversions
  crm            â€” if a CRM is connected and qualified-lead events exist

HARD BANS:
- Health conditions on Meta (e.g., "diabetes interest") â€” banned globally.
- Financial distress targeting on Meta â€” banned.
- Negative-attribute targeting ("recently divorced") â€” banned.

OUTPUT: call the audience_output tool.`;

export interface AudienceAgentDeps {
  anthropic: AnthropicClient;
}

export function createAudienceAgent(
  deps: AudienceAgentDeps,
): Agent<AudienceInput, AudienceOutput> {
  const primary: ModelId = "claude-sonnet-4-6";
  const fallback: ModelId[] = ["claude-haiku-4-5", "gpt-4o-mini"];

  return {
    name: "audience",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 2,
    cacheNamespace: "audience",
    optional: false,

    async *run(input: AudienceInput, ctx: AgentContext): AsyncIterable<AgentEvent<AudienceOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "audience", model) as AgentEvent<AudienceOutput>;

      const kbTargeting =
        input.kbTargetingLibraries ??
        (await ctx.kb.retrieve({
          namespace: "targeting_libraries",
          industry: ctx.industry,
          topK: 5,
        }));

      const userTail = `Brief from Planner:
${input.brief}

Business Profile:
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}

Produce primary + secondary personas + platform targeting. Call audience_output.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [{ text: SYSTEM_PROMPT_HEAD, cacheable: true }],
          userPrefixBlocks: [{ text: renderKb(kbTargeting), cacheable: true }],
          userTail,
          outputSchema: AudienceOutputSchema,
          outputSchemaName: "audience_output",
          outputSchemaDescription: "Personas + per-platform targeting + lookalike seed spec.",
          maxTokens: 4096,
          temperature: 0.5,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "audience", "platformTargeting", delta));
          },
        });

        await ctx.recordCost("audience", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "audience",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<AudienceOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "audience",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<AudienceOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
