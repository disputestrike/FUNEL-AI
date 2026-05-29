/**
 * Planner Agent — picks funnel archetype, dispatches downstream agents.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.1
 * Model: Claude Opus 4.7 (high-stakes — sets the whole run)
 * Fallback chain: Sonnet 4.6 â†’ GPT-4o
 */
import type { z } from "zod";
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ModelId,
  type PlannerInput,
  type PlannerOutput,
  PlannerOutputSchema,
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

const SYSTEM_PROMPT = `You are the Planner agent of GoFunnelAI's autonomous generation engine.
Your job is to decide the optimal funnel ARCHETYPE for a specific business
and to brief the downstream agents. You do NOT write copy or design pages.

You will be given:
- A Business Profile (industry, offer, target customer, geography, tier).
- An industry knowledge pack (proven funnels in this vertical).
- Three to five archetype templates with conversion-rate ranges by industry.

Choose the archetype that maximizes expected lead value given:
(a) the offer's price point and sales cycle length,
(b) the customer's awareness level (cold / warm / hot),
(c) regulatory constraints in this geography (e.g., financial-services
    compliance pre-empts tripwire pricing patterns).

Produce a JSON object that matches the PlannerOutput schema EXACTLY.
Briefs must be 60-150 words, specific, and actionable. Do NOT invent
facts about the business — if a fact is missing, instruct the relevant
downstream agent to leave a placeholder and flag it to Fact-Check.

Constraints:
- Never recommend the 'tripwire' archetype for regulated verticals
  (legal, financial advisory, medical) without an explicit human-review flag.
- For geographies with strict ad rules (DE, FR, CA-QC), require the
  Compliance agent in 'dispatch' with priority 'must'.
- If the BusinessProfile lacks a clear primary offer, the only
  archetype allowed is 'lead_magnet_optin'.

DISPATCH KEYS (use these exact names):
  hook, page, lead_magnet, image, video, ad_copy, audience, email, sms,
  voice_script, upsell, fact_check, compliance, qa, brand_guardian

REQUIRED in dispatch (always 'must' priority):
  page, hook, brand_guardian, fact_check, compliance, qa

CONDITIONAL:
  - upsell: only if archetype supports paid upsells (tripwire, application_funnel, product_launch)
  - voice_script: 'must' if target customer has phone, otherwise 'should'
  - video: 'should' for cold-traffic archetypes; 'optional' for application_funnel
  - sms: 'should' for free_consult_booking; 'optional' otherwise

Output ALL fields of PlannerOutput. estimatedCostCents should be 50-150,
estimatedDurationMs 30000-90000.`;

const ARCHETYPE_TEMPLATES = `ARCHETYPE TEMPLATES:

1. lead_magnet_optin
   - Free downloadable resource â†’ email opt-in â†’ nurture sequence
   - Best for: cold traffic, long sales cycles, complex offers, building list
   - Conversion: 25-40% to opt-in; 2-5% to paid (post-nurture)
   - Sections: hero â†’ problem â†’ lead-magnet offer â†’ opt-in form â†’ social proof â†’ CTA
   - Industries: SaaS, coaching, info products, B2B

2. free_consult_booking
   - Direct booking of free 15-30min consult or quote
   - Best for: services with sales-cycle 7-60 days, high deal value
   - Conversion: 8-18% book; 25-45% of bookings show; 20-40% of shows close
   - Sections: hero â†’ trust â†’ process â†’ calendar â†’ guarantee â†’ FAQ
   - Industries: solar, HVAC, real estate, financial advisory, legal, dental

3. tripwire
   - Low-priced offer ($7-$47) â†’ bump â†’ upsell â†’ downsell
   - Best for: warm/hot traffic, simple offers, ecommerce
   - Conversion: 3-8% on cold; 6-15% on warm
   - Sections: hero â†’ benefit-driven offer â†’ social proof â†’ checkout
   - Industries: ecommerce, info products, supplements, courses
   - NOT permitted for: legal, financial advisory, medical (regulatory)

4. webinar_evergreen
   - Registration â†’ automated webinar â†’ CTA at end
   - Best for: education-heavy offers, $500-$5k price point
   - Conversion: 15-30% register; 30-50% show; 5-15% of shows buy
   - Sections: registration page â†’ confirmation â†’ reminders â†’ replay
   - Industries: coaching, courses, B2B SaaS, agency services

5. application_funnel
   - Long-form qualification questions â†’ application review â†’ strategy call
   - Best for: $5k+ services, premium positioning, high-ticket coaching
   - Conversion: 1-4% complete application; 30-60% accepted; 25-50% close
   - Sections: hero â†’ who-this-is-for â†’ application â†’ confirmation
   - Industries: high-ticket coaching, agency, premium services

6. product_launch
   - Multi-day pre-launch sequence â†’ cart-open â†’ cart-close
   - Best for: course launches, premium product drops
   - Conversion: 15-25% list-to-buyer over a launch window
   - Sections: pre-launch content â†’ sales page â†’ cart â†’ bonuses â†’ close`;

export interface PlannerAgentDeps {
  anthropic: AnthropicClient;
}

export function createPlannerAgent(deps: PlannerAgentDeps): Agent<PlannerInput, PlannerOutput> {
  const primary: ModelId = "claude-opus-4-7";
  const fallback: ModelId[] = ["claude-sonnet-4-6", "gpt-4o"];

  return {
    name: "planner",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 8,
    cacheNamespace: "planner",
    optional: false,

    async *run(input: PlannerInput, ctx: AgentContext): AsyncIterable<AgentEvent<PlannerOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "planner", model) as AgentEvent<PlannerOutput>;

      // KB retrieval — industry + archetypes
      const kbIndustry =
        input.kbIndustryDocs ??
        (await ctx.kb.retrieve({
          namespace: "industry_pack",
          industry: ctx.industry,
          geography: ctx.geography,
          topK: 8,
        }));
      const kbArchetypes =
        input.kbArchetypeDocs ??
        (await ctx.kb.retrieve({
          namespace: "archetype_examples",
          industry: ctx.industry,
          topK: 5,
        }));

      const cacheKey = ctx.cache.key("planner", "3", {
        industry: String(ctx.industry),
        geography: ctx.geography,
        tier: ctx.tier,
        kbVersion: ctx.kbPackVersion ?? "1",
      });

      const userTail = `Business Profile:
${renderBusinessProfile(ctx.businessProfile)}

Industry KB excerpt:
${renderKb(kbIndustry)}

Archetype hint from user: ${input.archetypeHint ?? "(none — choose freely)"}

Language: ${ctx.language}
Geography: ${ctx.geography}
Tier: ${ctx.tier}
Voice Persona (auto-routed): ${ctx.voicePersona}

Respond by calling the planner_output tool with valid JSON.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT, cacheable: true },
            { text: ARCHETYPE_TEMPLATES, cacheable: true },
          ],
          userPrefixBlocks: [
            { text: renderKb(kbArchetypes), cacheable: true },
          ],
          userTail,
          outputSchema: PlannerOutputSchema,
          outputSchemaName: "planner_output",
          outputSchemaDescription: "Funnel archetype selection + dispatch briefs for downstream agents.",
          maxTokens: 4096,
          temperature: 0.5,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "planner", "rationale", delta));
          },
        });

        const recommendation = await ctx.recordCost("planner", [buildModelCall(result)]);
        if (recommendation.status === "overrun") {
          ctx.logger.warn("planner: budget overrun", { remaining: recommendation.remainingCents });
        }

        yield finalEvent(
          ctx,
          "planner",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<PlannerOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "planner",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<PlannerOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
