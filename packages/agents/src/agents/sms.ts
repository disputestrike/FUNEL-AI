/**
 * SMS Agent â€” 3-7 touch SMS sequence with TCPA / PECR / LSPC opt-out language.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.10
 * Model: Claude Haiku 4.5 (short copy; volume is the driver)
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ModelId,
  type SmsInput,
  type SmsOutput,
  SmsOutputSchema,
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

const SYSTEM_PROMPT_HEAD = `You are the SMS agent of GoFunnelAI's autonomous generation engine.
You write SMS sequences for new leads. Brevity is everything.

SEQUENCE STRUCTURE (3-7 messages):
  Hour 1   (reminder):     confirm what they signed up for + one small next step.
  Hour 24  (value):        one specific tip the recipient can use today.
  Hour 72  (urgency):      only real urgency â€” actual deadline, cohort, capacity.
  Day 7    (reactivation): one-question reach-out.

Optional Hour 4 (reminder) and Hour 48 (proof) for high-cadence verticals.

PER-MESSAGE CONSTRAINTS:
- â‰¤ 160 chars for 1 SMS segment (target for cost). Up to 320 (2 segments)
  acceptable when value justifies it.
- First message ALWAYS includes the sender's business name + STOP language.
- No emoji in DE, JP, NL for transactional messages.
- No clickbait shorteners; only branded short URLs.

OPT-IN LANGUAGE (legally required, generate the full text):
US: "By submitting, you agree to receive recurring marketing texts from
     [Business Name] at the number provided. Consent is not a condition of
     purchase. Msg & data rates may apply. Msg frequency varies. Reply HELP
     for help, STOP to cancel. View Privacy Policy at [link]."
UK/EU: GDPR-compliant explicit consent statement; opt-in with explicit purpose,
       lawful basis, retention, withdrawal mechanism.
CA: Express written consent under CASL; identification, contact info, opt-out.
AU: Spam Act consent statement with opt-out instructions.

STOP KEYWORDS:
US/CA: ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]
UK: ["STOP", "STOPALL"]
AU: ["STOP", "UNSUB"]

PROHIBITIONS:
- Never invent stats.
- Never imply human if the SMS is automated (state "auto-msg" or similar in the
  first message for non-trivial cadences).
- No first-name spoofing if no first name available â€” use the business name.

OUTPUT: call the sms_output tool with sequence + optInLanguage + stopKeywords.`;

export interface SmsAgentDeps {
  anthropic: AnthropicClient;
}

export function createSmsAgent(deps: SmsAgentDeps): Agent<SmsInput, SmsOutput> {
  const primary: ModelId = "claude-haiku-4-5";
  const fallback: ModelId[] = ["claude-sonnet-4-6", "gpt-4o-mini"];

  return {
    name: "sms",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 1,
    cacheNamespace: "sms",
    optional: true,

    async *run(input: SmsInput, ctx: AgentContext): AsyncIterable<AgentEvent<SmsOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "sms", model) as AgentEvent<SmsOutput>;

      const kbCompliance =
        input.kbSmsCompliance ??
        (await ctx.kb.retrieve({
          namespace: "sms_compliance",
          geography: ctx.geography,
          topK: 3,
        }));

      const userTail = `Brief from Planner:
${input.brief}

Business Profile:
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}  Language: ${ctx.language}

Produce 3-7 messages + opt-in language + STOP keywords. Call sms_output.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [{ text: SYSTEM_PROMPT_HEAD, cacheable: true }],
          userPrefixBlocks: [{ text: renderKb(kbCompliance), cacheable: true }],
          userTail,
          outputSchema: SmsOutputSchema,
          outputSchemaName: "sms_output",
          outputSchemaDescription: "SMS sequence + legal opt-in + STOP keywords.",
          maxTokens: 2048,
          temperature: 0.6,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "sms", "sequence", delta));
          },
        });

        await ctx.recordCost("sms", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "sms",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<SmsOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "sms",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<SmsOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
