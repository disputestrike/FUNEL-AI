/**
 * Page Agent — assembles funnel JSON (hero, problem, solution, proof, offer,
 * guarantee, FAQ, final CTA) with markdown bodies, JSON-LD metadata, and
 * structured block specs ready for the renderer.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.3
 * Model: Claude Sonnet 4.6 / Fallback: Sonnet 4.5 â†’ GPT-4o
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ModelId,
  type PageInput,
  type PageOutput,
  PageOutputSchema,
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

const SYSTEM_PROMPT_HEAD = `You are the Page agent of GoFunnelAI's autonomous generation engine.
You write long-form landing page copy. Your output is the body of the funnel.

LAYOUT LAWS:
1. One idea per section. If a section has two ideas, split it.
2. Sections appear in the order required by the archetype (below).
3. Every section body is markdown, second-person, scannable. Use bold and short
   paragraphs; avoid walls of text.
4. Every claim is grounded in BusinessProfile.proof (testimonials, statistics,
   case studies). If proof for a claim does not exist, omit the claim — never
   invent numbers, never cite "studies show" without a source in the profile.
5. The 'proof' section MUST pull from BusinessProfile.proof.testimonials and
   .caseStudies verbatim. Do not invent attributions. If proof.testimonials is
   empty, the proof section uses category-level patterns (e.g., certifications,
   years in business) without a named quote.
6. Every section's 'body' field is markdown; 'heading' is a single sentence.
7. 'blocks' is optional — populate it with renderer-ready structured data only
   when the section type benefits from it (e.g., features list, FAQ items).

ARCHETYPE SECTION ORDER (use ONLY these section types):
  lead_magnet_optin:    hero â†’ problem â†’ solution â†’ offer (lead magnet) â†’ proof â†’ faq â†’ cta_final
  free_consult_booking: hero â†’ problem â†’ solution â†’ proof â†’ offer â†’ guarantee â†’ faq â†’ cta_final
  tripwire:             hero â†’ problem â†’ solution â†’ offer â†’ proof â†’ guarantee â†’ cta_final
  webinar_evergreen:    hero â†’ problem â†’ agitation â†’ solution â†’ proof â†’ offer â†’ cta_final
  application_funnel:   hero â†’ problem â†’ solution â†’ proof â†’ offer â†’ faq â†’ cta_final
  product_launch:       hero â†’ problem â†’ solution â†’ features â†’ proof â†’ offer â†’ guarantee â†’ cta_final

META & SEO:
- metaTitle â‰¤ 70 chars, includes primary keyword + brand.
- metaDescription 120-160 chars, includes primary benefit + soft CTA.
- schemaOrg = valid JSON-LD. Use 'Service' or 'Product' as @type as appropriate.
  Include 'name', 'description', 'provider.name', and 'aggregateRating' ONLY if
  the BusinessProfile actually contains rating data.

ACCESSIBILITY:
- For every section that should contain an image, mention the image placement in
  the markdown body using the syntax ![alt-text-placeholder](image:slot-name)
  so the Image agent can fill it. Do NOT hardcode URLs.

OUTPUT: call the page_output tool.`;

export interface PageAgentDeps {
  anthropic: AnthropicClient;
}

export function createPageAgent(deps: PageAgentDeps): Agent<PageInput, PageOutput> {
  const primary: ModelId = "claude-sonnet-4-6";
  const fallback: ModelId[] = ["claude-sonnet-4-6", "gpt-4o"];

  return {
    name: "page",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 5,
    cacheNamespace: "page",
    optional: false,

    async *run(input: PageInput, ctx: AgentContext): AsyncIterable<AgentEvent<PageOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "page", model) as AgentEvent<PageOutput>;

      const kbPatterns =
        input.kbPagePatterns ??
        (await ctx.kb.retrieve({
          namespace: "page_patterns",
          industry: ctx.industry,
          archetype: input.archetype,
          topK: 8,
        }));

      const persona = personaPrompt(ctx.voicePersona);

      const hookSection = input.hook
        ? `Primary headline (from Hook agent):\n  ${input.hook.primary.headline}\n  ${input.hook.primary.subhead}\n  CTA: ${input.hook.primary.cta}`
        : `(Hook output not yet available — use Planner brief to draft hero, will be merged at assembly.)`;

      const userTail = `Brief from Planner:
${input.brief}

Archetype: ${input.archetype}

${hookSection}

Business Profile (use proof verbatim; do not invent attributions):
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}  Language: ${ctx.language}  Voice persona: ${ctx.voicePersona}

Produce the complete page output. Use the archetype's required section order.
Call the page_output tool.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT_HEAD, cacheable: true },
            { text: persona, cacheable: true },
          ],
          userPrefixBlocks: [{ text: renderKb(kbPatterns), cacheable: true }],
          userTail,
          outputSchema: PageOutputSchema,
          outputSchemaName: "page_output",
          outputSchemaDescription: "Funnel landing-page sections + meta + JSON-LD.",
          maxTokens: 6000,
          temperature: 0.7,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "page", "sections", delta));
          },
        });

        await ctx.recordCost("page", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "page",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<PageOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "page",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<PageOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
