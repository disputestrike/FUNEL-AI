/**
 * Lead Magnet Agent — generates the actual deliverable content (a downloadable
 * PDF guide, checklist, template, mini-course outline, quiz, or calculator
 * spec). Opus 4.7 because perceived value > 5 minutes of customer time and
 * lead magnets are the single biggest opt-in conversion lever.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.4
 * Model: Claude Opus 4.7 / Fallback: Sonnet 4.6 â†’ GPT-4o
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type LeadMagnetInput,
  type LeadMagnetOutput,
  LeadMagnetOutputSchema,
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

const SYSTEM_PROMPT_HEAD = `You are the Lead Magnet agent of GoFunnelAI's autonomous generation engine.
You produce the actual deliverable content — the PDF guide, checklist, template,
mini-course outline, quiz, or calculator specification. Other agents handle the
opt-in form and the thank-you page. You handle the THING the user downloads.

VALUE FLOOR:
The deliverable must give the reader more than 5 minutes of value. That means
specifics, not platitudes. A checklist of 20 items the reader could not have
written themselves. A template they can literally copy/paste. A guide with
working numbers, not "best practices".

FORMAT CHOICE:
- pdf_guide: 800-2500 words across 4-8 sections. For complex topics needing depth.
- checklist: 15-30 items, each 1-2 lines, organized into 3-5 categories.
- template: a fill-in-the-blank document (email, script, spreadsheet column layout).
- mini_course: 5-10 lesson outlines, each with objective + 3-5 bullets.
- quiz: 8-12 questions with 3-4 options each, scored to recommend a path.
- calculator: input fields + formula + output explanation.

If the brief leaves format open, prefer pdf_guide for B2B/regulated; checklist for
operators; template for SaaS/coaching; mini_course for high-ticket coaching.

QUALITY GATES:
- No filler. Every paragraph must teach something.
- No upsell baked in. The deliverable is self-contained; the THANK YOU page is
  where soft CTAs live (you write that copy in 'thankYouCopy').
- Every quantitative claim must trace to BusinessProfile.proof or KB sources.
  If you can't source a number, write the deliverable without it.
- No competitor namedropping unless the BusinessProfile authorizes.

SECTION STRUCTURE (for pdf_guide):
Each section has:
  heading: 3-8 words, declarative.
  body: 150-400 words, markdown, with at least one of: a numbered list, a
        worked example, a "what to do today" callout.

opt-in promise (optinPagePromise): one sentence the opt-in page can use to
describe what the reader gets. â‰¤ 200 chars.

thankYouCopy: copy for the thank-you page — confirms the email, sets expectation
of the deliverable, soft CTA to the primary funnel offer. 60-200 words.

OUTPUT: call the lead_magnet_output tool.`;

export interface LeadMagnetAgentDeps {
  anthropic: AnthropicClient;
}

export function createLeadMagnetAgent(
  deps: LeadMagnetAgentDeps,
): Agent<LeadMagnetInput, LeadMagnetOutput> {
  const primary: ModelId = "claude-opus-4-7";
  const fallback: ModelId[] = ["claude-sonnet-4-6", "gpt-4o"];

  return {
    name: "lead_magnet",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 4,
    cacheNamespace: "lead_magnet",
    optional: true,

    async *run(
      input: LeadMagnetInput,
      ctx: AgentContext,
    ): AsyncIterable<AgentEvent<LeadMagnetOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "lead_magnet", model) as AgentEvent<LeadMagnetOutput>;

      const kbLeadMagnets =
        input.kbLeadMagnets ??
        (await ctx.kb.retrieve({
          namespace: "lead_magnets",
          industry: ctx.industry,
          topK: 5,
        }));

      const persona = personaPrompt(ctx.voicePersona);

      const userTail = `Brief from Planner:
${input.brief}

Archetype: ${input.archetype}

Business Profile (use proof verbatim; do not invent claims):
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}  Language: ${ctx.language}  Voice persona: ${ctx.voicePersona}

Pick the best format for this brief and industry, then produce the full
deliverable. Call the lead_magnet_output tool.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT_HEAD, cacheable: true },
            { text: persona, cacheable: true },
          ],
          userPrefixBlocks: [{ text: renderKb(kbLeadMagnets), cacheable: true }],
          userTail,
          outputSchema: LeadMagnetOutputSchema,
          outputSchemaName: "lead_magnet_output",
          outputSchemaDescription: "Lead magnet deliverable spec + opt-in promise + thank-you copy.",
          maxTokens: 6000,
          temperature: 0.7,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "lead_magnet", "deliverableSpec", delta));
          },
        });

        await ctx.recordCost("lead_magnet", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "lead_magnet",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<LeadMagnetOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "lead_magnet",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<LeadMagnetOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
