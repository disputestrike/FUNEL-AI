/**
 * Ad Copy Agent â€” 8-10 ad variants per platform, in each platform's structured
 * format (Meta primary text + headline + description, TikTok hook + description,
 * Google RSA headlines + descriptions, LinkedIn intro text + headline, YouTube
 * companion banner copy).
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.7
 * Model: Claude Sonnet 4.6 / Fallback: Haiku 4.5 â†’ GPT-4o-mini
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type AdCopyInput,
  type AdCopyOutput,
  AdCopyOutputSchema,
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ModelId,
} from "../types.js";
import { personaPrompt } from "../prompts/voice-personas.js";
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

const SYSTEM_PROMPT_HEAD = `You are the Ad Copy agent of GoFunnelAI's autonomous generation engine.
You write paid-ad copy for Meta, TikTok, Google Search, YouTube, and LinkedIn.

PER-PLATFORM REQUIREMENTS:

Meta (Facebook + Instagram):
  primaryText: 90-125 chars optimal (300 max)
  headline: â‰¤ 27 chars optimal (40 max)
  description: â‰¤ 27 chars optimal (40 max)
  cta: from approved list: Learn More, Sign Up, Get Quote, Book Now, Apply Now,
       Get Offer, Subscribe, Download, Shop Now, See Menu, Contact Us
  Tone: native, scroll-stopping, hook in line 1.

TikTok:
  primaryText: hook in first 3 seconds of copy (â‰¤ 100 chars)
  headline: â‰¤ 40 chars
  cta: Learn More, Sign Up, Download, Watch More, Shop Now
  Tone: native to TikTok â€” UGC voice, not polished.

Google Search (RSA):
  headline: â‰¤ 30 chars (you'll produce multiple short headlines)
  description: â‰¤ 90 chars
  Tone: keyword-rich, intent-matching.

YouTube (companion):
  primaryText: â‰¤ 100 chars
  headline: â‰¤ 15 chars (overlay)
  cta: Learn More, Subscribe, Watch More, Sign Up
  Tone: spoken-first, video-companion.

LinkedIn:
  primaryText: â‰¤ 150 chars (600 max â€” but short performs)
  headline: â‰¤ 70 chars
  description: â‰¤ 100 chars
  cta: Learn More, Sign Up, Register, Apply, Download
  Tone: professional, value-prop forward.

COMPLIANCE PRE-FLIGHT (record in complianceFlags array per variant):
- Superlative without proof ("best", "#1") â†’ flag "needs_substantiation"
- Health/financial outcome promise â†’ flag "regulated_claim_review"
- "Guaranteed" or "risk-free" â†’ flag "guarantee_disclosure_required"
- First-person customer voice without proof â†’ flag "testimonial_authorization_needed"
- Geo-specific bans (DE-health "best", US-insurance "guaranteed") â†’ flag with rule id

VARIANTS REQUIREMENT:
Produce EXACTLY 8-10 variants per platform requested. Each variant tests one
different ANGLE (pain, outcome, identity, social_proof, contrast, urgency,
curiosity_gap, status_quo). Two variants may share an angle ONLY if they
differ on opening verb or specificity.

CHARACTER COUNTS:
Include 'characterCounts' as a record of every text field's actual length.

OUTPUT: call the ad_copy_output tool.`;

export interface AdCopyAgentDeps {
  anthropic: AnthropicClient;
}

export function createAdCopyAgent(deps: AdCopyAgentDeps): Agent<AdCopyInput, AdCopyOutput> {
  const primary: ModelId = "claude-sonnet-4-6";
  const fallback: ModelId[] = ["claude-haiku-4-5", "gpt-4o-mini"];

  return {
    name: "ad_copy",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 3,
    cacheNamespace: "ad_copy",
    optional: false,

    async *run(input: AdCopyInput, ctx: AgentContext): AsyncIterable<AgentEvent<AdCopyOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "ad_copy", model) as AgentEvent<AdCopyOutput>;

      const kbPolicy =
        input.kbAdPolicy ??
        (await Promise.all(
          input.platforms.map((p) =>
            ctx.kb.retrieve({
              namespace: "ad_policy",
              industry: ctx.industry,
              geography: ctx.geography,
              extraFilters: { platform: p },
              topK: 3,
            }),
          ),
        )).flat();

      const kbWinning =
        input.kbWinningAds ??
        (await ctx.kb.retrieve({ namespace: "winning_ads", industry: ctx.industry, topK: 8 }));

      const persona = personaPrompt(ctx.voicePersona);

      const hookSection = input.hook
        ? `Primary hook: "${input.hook.primary.headline}" / "${input.hook.primary.subhead}" / CTA: ${input.hook.primary.cta}\nAngle variants from Hook agent:\n${input.hook.variants.map((v) => `  - [${v.angleId ?? "?"}] ${v.headline}`).join("\n")}`
        : "(no hook output â€” derive from brief alone)";

      const userTail = `Brief from Planner:
${input.brief}

Platforms to produce: ${input.platforms.join(", ")}

${hookSection}

Business Profile:
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}  Language: ${ctx.language}  Voice persona: ${ctx.voicePersona}

For EACH platform, produce 8-10 variants across distinct angles. Fill
characterCounts and complianceFlags. Call the ad_copy_output tool.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT_HEAD, cacheable: true },
            { text: persona, cacheable: true },
          ],
          userPrefixBlocks: [
            { text: renderKb(kbPolicy), cacheable: true },
            { text: renderKb(kbWinning), cacheable: true },
          ],
          userTail,
          outputSchema: AdCopyOutputSchema,
          outputSchemaName: "ad_copy_output",
          outputSchemaDescription: "Per-platform ad variants with char counts + compliance flags.",
          maxTokens: 6000,
          temperature: 0.85,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "ad_copy", "platforms", delta));
          },
        });

        await ctx.recordCost("ad_copy", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "ad_copy",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<AdCopyOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "ad_copy",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<AdCopyOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
