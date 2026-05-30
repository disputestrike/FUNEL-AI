/**
 * Hook Agent — writes 3-5 headline variants tied to industry pain points.
 *
 * Spec: docs/19-orchestrator-code-spec.md Â§B.2.2
 * Model: Claude Sonnet 4.6 / Fallback: Haiku 4.5 â†’ GPT-4o
 */
import { AnthropicClient } from "../llm/anthropic-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type HookInput,
  type HookOutput,
  HookOutputSchema,
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

const SYSTEM_PROMPT_HEAD = `You are the Hook agent of GoFunnelAI's autonomous generation engine.
You write headlines, subheads, and CTAs for funnels.

OBJECTIVES:
- Cold-traffic stop-power: the headline must make a scroller pause.
- Specificity over cleverness: a concrete number, place, or scenario always beats
  a clever pun. Cleverness without specificity reads as marketing noise.
- Honest claims: never promise what the BusinessProfile doesn't actually deliver.
  If proof exists in the BusinessProfile.proof.statistics or .testimonials,
  you may reference it. If it doesn't, write the hook without specific numbers.

OUTPUT SHAPE:
You will produce ONE primary hook and 4-6 variant hooks across distinct ANGLES.
Each hook = { headline, subhead, cta, angleId }.

ANGLES TO COVER (pick 4-6 of these, never repeat an angle):
  pain_focused      — names the specific frustration
  outcome_focused   — names the specific result
  identity_focused  — speaks to who they are ("for engineers who...")
  status_quo_break  — challenges conventional thinking
  time_pressure     — names a real time-sensitive context
  social_proof      — references the size of the customer base or a testimonial
  curiosity_gap     — sets up a question the page answers
  contrast          — old way vs new way

HARD CONSTRAINTS:
- headline: â‰¤ 70 chars, sentence-case, active voice.
- subhead: â‰¤ 160 chars, single sentence, expands the headline.
- cta: 2-5 words, action verb, second-person implied. "Get the quote" not "Click here".
- Never use exclamation marks in geographies tagged restrained (DE, JP, NL).
- Never use these banned words: 'crush', '10X', 'ninja', 'rockstar', 'growth hack',
  'unlock' (as verb), 'leverage' (as verb), 'unleash', 'revolutionize', 'transform'
  (use 'change' or 'improve' instead).
- Match the voice persona system prompt that follows.

OUTPUT: call the hook_output tool with valid JSON.`;

export interface HookAgentDeps {
  anthropic: AnthropicClient;
}

export function createHookAgent(deps: HookAgentDeps): Agent<HookInput, HookOutput> {
  const primary: ModelId = "claude-sonnet-4-6";
  const fallback: ModelId[] = ["claude-haiku-4-5", "gpt-4o"];

  return {
    name: "hook",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 2,
    cacheNamespace: "hook",
    optional: false,

    async *run(input: HookInput, ctx: AgentContext): AsyncIterable<AgentEvent<HookOutput>> {
      const started = Date.now();
      const model = pickModel(ctx, primary);
      yield startedEvent(ctx, "hook", model) as AgentEvent<HookOutput>;

      const kbHooks =
        input.kbHooks ??
        (await ctx.kb.retrieve({
          namespace: "hooks_library",
          industry: ctx.industry,
          topK: 12,
        }));

      const persona = personaPrompt(ctx.voicePersona);
      const restrained = ["DE", "JP", "NL"].includes(ctx.geography);

      const userTail = `Brief from Planner:
${input.brief}

Business Profile (for proof points only — do not invent claims not in here):
${renderBusinessProfile(ctx.businessProfile)}

Geography: ${ctx.geography}${restrained ? " (RESTRAINED — no exclamation marks)" : ""}
Language: ${ctx.language}
Voice Persona: ${ctx.voicePersona}

Produce ONE primary hook + 4-6 variants. Each must use a distinct angle from the
angles list. Call the hook_output tool.`;

      try {
        const result = await deps.anthropic.structuredCall({
          model,
          systemBlocks: [
            { text: SYSTEM_PROMPT_HEAD, cacheable: true },
            { text: persona, cacheable: true },
          ],
          userPrefixBlocks: [{ text: renderKb(kbHooks), cacheable: true }],
          userTail,
          outputSchema: HookOutputSchema,
          outputSchemaName: "hook_output",
          outputSchemaDescription: "Primary hook + 4-6 variants across distinct angles.",
          maxTokens: 2048,
          temperature: 0.8,
          abortSignal: ctx.abortSignal,
          onChunk: (delta: string) => {
            ctx.emit?.(chunkEvent(ctx, "hook", "primary.headline", delta));
          },
        });

        await ctx.recordCost("hook", [buildModelCall(result)]);

        yield finalEvent(
          ctx,
          "hook",
          model,
          result.output,
          { totalCents: result.costCents, calls: [buildModelCall(result)] },
          buildCacheHits(result.inputTokens, result.cachedInputTokens),
          Date.now() - started,
        ) as AgentEvent<HookOutput>;
      } catch (err) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "hook",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: true,
        } as AgentEvent<HookOutput>;
      }
    },
  };
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
