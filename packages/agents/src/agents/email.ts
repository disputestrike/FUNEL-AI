/**
 * Email Agent — 7-touch nurture sequence (subject + preheader + body in
 * markdown), per-touch type (welcome / value / proof / offer / urgency / win_back),
 * day-offset cadence, CAN-SPAM/CASL/GDPR compliance.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.9
 * Model: Claude Sonnet 4.6
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type EmailInput,
  type EmailOutput,
  EmailOutputSchema,
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

const SYSTEM_PROMPT_HEAD = `You are the Email agent of GoFunnelAI's autonomous generation engine.
You write nurture-sequence emails for a single funnel campaign.

SEQUENCE STRUCTURE (5-9 emails over 14 days):
  Day 0  (welcome):   deliver the lead magnet, set expectations, soft offer mention.
  Day 1  (value):     teach one concrete thing the reader can do today.
  Day 3  (proof):     a real story from BusinessProfile.proof — testimonial,
                      case study, or sourced statistic. Never invented.
  Day 5  (value):     a second concrete teach. Mention the offer once, soft.
  Day 7  (offer):     the offer in full. Reframe price as ROI.
  Day 10 (urgency):   real urgency only — a deadline, a cohort, a capacity
                      number that's actually true. Never fake scarcity.
  Day 14 (win_back):  one-question reactivation ("still interested?"). Make
                      it easy to reply "no" — that's the cleanest list signal.

Optional Day 2 'proof' and Day 4 'value' for higher-touch verticals.

PER-EMAIL CONSTRAINTS:
  subject: 30-50 chars optimal; avoid spammy ALL CAPS, multiple !, false urgency.
  preheader: 50-90 chars; complements subject, doesn't repeat it.
  body: markdown; â‰¤ 300 words; ONE call-to-action; signed by a real human name
        from BusinessProfile.contact or businessName if no name available.

LEGAL FOOTER (every email):
  - Sender's valid physical mailing address (CAN-SPAM, CASL).
  - Single-click unsubscribe link.
  - For GDPR geographies: reference to privacy policy + lawful basis statement.
You may indicate these requirements with placeholder tokens like {{address}},
{{unsubscribe_url}}, {{privacy_policy_url}} — the renderer fills them.

PROHIBITIONS:
- Never invent a quote, testimonial, or statistic.
- Never use clickbait subject lines that misrepresent the body.
- Never re-engage someone post-unsubscribe (handled by infra, but copy must
  acknowledge: "If you'd like to hear from us less, hit reply or unsubscribe.").

OUTPUT: call the email_output tool. The 'sequence' array must contain 5-9 items
ordered by dayOffsetH ascending.`;

export interface EmailAgentDeps {
  anthropic: AnthropicClient;
}

export function createEmailAgent(deps: EmailAgentDeps): Agent<EmailInput, EmailOutput> {
  const primary: ModelId = "claude-sonnet-4-6";
  const fallback: ModelId[] = ["claude-haiku-4-5", "gpt-4o"];

  return {
    name: "email",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 5,
    cacheNamespace: "email",
    optional: false,

    async *run(input: EmailInput, ctx: AgentContext): AsyncIterable<AgentEvent<EmailOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "email", model) as AgentEvent<EmailOutput>;

      const kbSequences =
        input.kbEmailSequences ??
        (await ctx.kb.retrieve({
          namespace: "email_sequences",
          industry: ctx.industry,
          topK: 5,
        }));

      const kbSubjects =
        input.kbSubjectLines ??
        (await ctx.kb.retrieve({
          namespace: "subject_line_winners",
          industry: ctx.industry,
          topK: 12,
        }));

      const persona = personaPrompt(ctx.voicePersona);

      const leadMagnetCtx = input.leadMagnet
        ? `Lead magnet: ${input.leadMagnet.title}\n  Promise: ${input.leadMagnet.optinPagePromise}`
        : "(no lead magnet for this funnel)";

      const hookCtx = input.hook
        ? `Hook: ${input.hook.primary.headline}`
        : "";

      const userTail = `Brief from Planner:
${input.brief}

${hookCtx}
${leadMagnetCtx}

Business Profile:
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}  Language: ${ctx.language}  Voice persona: ${ctx.voicePersona}

Produce 5-9 emails over 14 days. Call email_output.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT_HEAD, cacheable: true },
            { text: persona, cacheable: true },
          ],
          userPrefixBlocks: [
            { text: renderKb(kbSequences), cacheable: true },
            { text: renderKb(kbSubjects), cacheable: true },
          ],
          userTail,
          outputSchema: EmailOutputSchema,
          outputSchemaName: "email_output",
          outputSchemaDescription: "Nurture-sequence email array.",
          maxTokens: 6000,
          temperature: 0.7,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "email", "sequence", delta));
          },
        });

        await ctx.recordCost("email", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "email",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<EmailOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "email",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<EmailOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
