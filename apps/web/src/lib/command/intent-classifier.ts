/**
 * GoFunnelAI — Command Center intent classifier.
 *
 * The /dashboard/command surface is chat-first: users type free-form prompts
 * ("Build me a funnel for dental clinics that miss calls", "Generate 5 more
 * video ads for retargeting") and the orchestrator dispatches the right
 * pipeline behind the scenes. The classifier is the front door.
 *
 * Routing tree:
 *
 *   create_funnel     → @funnel/orchestrator generate
 *   create_campaign   → Launch Center DAG (strategy → … → export)
 *   edit_funnel       → /api/funnels/[id]/sections/[sectionId]/edit
 *   edit_campaign     → re-run a specific Launch Center agent
 *   query             → analytics (chart + insight commentary)
 *   launch            → lifecycle transition (DRAFT → READY_FOR_REVIEW etc.)
 *   generic_question  → general assistant (no orchestrator dispatch)
 *
 * Implementation: Anthropic Claude Haiku with structured (JSON) output via
 * the `tool_use` channel — fast, cheap, and forced-schema. Falls back to a
 * deterministic keyword router when no API key is configured (dev, CI, E2E).
 * Both paths emit the same {intent, parameters, confidence} shape so callers
 * don't branch on which classifier ran.
 *
 * Confidence < 0.6 → coerce to `generic_question` so we never run a
 * destructive pipeline on a hunch.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** The seven canonical intents the Command Center can dispatch to. */
export const COMMAND_INTENTS = [
  "create_funnel",
  "create_campaign",
  "edit_funnel",
  "edit_campaign",
  "query",
  "launch",
  "generic_question",
] as const;

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

/**
 * Structured parameters extracted from the user message. All optional —
 * downstream dispatchers fill in workspace defaults for anything missing.
 */
export const IntentParametersSchema = z
  .object({
    industry: z.string().optional(),
    audience: z.string().optional(),
    goal: z.string().optional(),
    /** Resolved from context.funnelId or pulled out of the user message. */
    funnelId: z.string().optional(),
    /** Resolved from context.campaignId or pulled out of the user message. */
    campaignId: z.string().optional(),
    /** Section to edit, only meaningful for edit_funnel. */
    sectionId: z.string().optional(),
    /** Asset type — "image" | "video" | "copy" — for edit_campaign regens. */
    assetType: z.enum(["image", "video", "copy", "headline", "hero"]).optional(),
    /** How many variants to generate (e.g. "5 more video ads"). */
    count: z.number().int().min(1).max(20).optional(),
    /** Free-text edit instruction. */
    instruction: z.string().optional(),
    /** Lifecycle target for `launch` intent. */
    lifecycleTarget: z
      .enum(["READY_FOR_REVIEW", "LAUNCHED", "LAUNCHED_EXTERNALLY", "PAUSED"])
      .optional(),
  })
  .passthrough();

export type IntentParameters = z.infer<typeof IntentParametersSchema>;

export const ClassifyResultSchema = z.object({
  intent: z.enum(COMMAND_INTENTS),
  parameters: IntentParametersSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export type ClassifyResult = z.infer<typeof ClassifyResultSchema>;

/** Context the chat surface already has at hand. */
export interface ClassifyContext {
  funnelId?: string;
  campaignId?: string;
  workspaceId: string;
  /** Optional last 5 turns (rolling) so follow-ups resolve correctly. */
  recentTurns?: Array<{ role: "user" | "assistant"; text: string }>;
}

const CONFIDENCE_FLOOR = 0.6;

const CLASSIFIER_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are the routing layer of the GoFunnelAI Command Center.

Classify the user's most recent message into exactly ONE of these intents:

- create_funnel: build a new landing page / funnel from a brief.
  Triggers: "build me a funnel", "create a landing page", "I need a page for…"

- create_campaign: build a new ad/launch campaign for an existing funnel.
  Triggers: "create a campaign", "launch ads", "promote my funnel", anywhere
  the user names a goal like "booked demos" or "qualified leads" with a target
  audience.

- edit_funnel: change an EXISTING funnel (copy, hero, section, image).
  Triggers: "make the hero more premium", "shorter subhead", "swap image".
  Requires funnelId in context.

- edit_campaign: regenerate ads, swap creative, change audience on an
  EXISTING campaign.
  Triggers: "generate 5 more video ads", "target schools instead of clinics",
  "make ad copy more urgent". Often requires campaignId in context.

- query: analytics question. The user wants numbers or insight.
  Triggers: "show me which creative is winning", "what's my CTR",
  "performance this week".

- launch: lifecycle transition for a funnel or campaign.
  Triggers: "mark as launched externally", "publish the funnel", "pause the
  campaign", "move to review".

- generic_question: anything else — how-to, conceptual, off-topic.

Output a single tool_use call to the "classify" tool with:
  intent, parameters {industry, audience, goal, funnelId, campaignId,
  sectionId, assetType, count, instruction, lifecycleTarget}, confidence
  (0..1), and a one-sentence rationale.

If the message is ambiguous or mixes intents, prefer generic_question with
low confidence. Never invent a funnelId or campaignId — only carry forward
what context provides.`;

const CLASSIFIER_TOOL = {
  name: "classify",
  description:
    "Emit the routing decision for the GoFunnelAI Command Center. Required for every turn.",
  input_schema: {
    type: "object" as const,
    properties: {
      intent: { type: "string", enum: COMMAND_INTENTS as unknown as string[] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string" },
      parameters: {
        type: "object",
        additionalProperties: true,
        properties: {
          industry: { type: "string" },
          audience: { type: "string" },
          goal: { type: "string" },
          funnelId: { type: "string" },
          campaignId: { type: "string" },
          sectionId: { type: "string" },
          assetType: {
            type: "string",
            enum: ["image", "video", "copy", "headline", "hero"],
          },
          count: { type: "integer", minimum: 1, maximum: 20 },
          instruction: { type: "string" },
          lifecycleTarget: {
            type: "string",
            enum: [
              "READY_FOR_REVIEW",
              "LAUNCHED",
              "LAUNCHED_EXTERNALLY",
              "PAUSED",
            ],
          },
        },
      },
    },
    required: ["intent", "confidence", "parameters"],
  },
};

/**
 * Classify a user message into a Command Center intent.
 *
 * Always returns a result — never throws. If the LLM call fails or no
 * API key is configured, falls back to a deterministic keyword router.
 */
export async function classifyIntent(
  message: string,
  context: ClassifyContext,
  deps: { client?: Anthropic } = {},
): Promise<ClassifyResult> {
  const client =
    deps.client ??
    (process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null);

  if (!client) {
    return mergeContext(keywordClassify(message), context);
  }

  try {
    const turns = (context.recentTurns ?? []).slice(-5);
    const response = await client.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: "classify" },
      tools: [CLASSIFIER_TOOL],
      messages: [
        ...turns.map((t) => ({ role: t.role, content: t.text })),
        { role: "user" as const, content: message },
      ],
    });

    const toolBlock = response.content.find(
      (block) => block.type === "tool_use" && block.name === "classify",
    );
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return mergeContext(keywordClassify(message), context);
    }

    const parsed = ClassifyResultSchema.safeParse(toolBlock.input);
    if (!parsed.success) {
      return mergeContext(keywordClassify(message), context);
    }

    return mergeContext(coerceLowConfidence(parsed.data), context);
  } catch {
    return mergeContext(keywordClassify(message), context);
  }
}

/**
 * Deterministic keyword router. Used (1) when no API key is set and (2)
 * as a safety net when the LLM call fails or returns malformed JSON.
 *
 * Order matters — more specific intents are checked first.
 */
export function keywordClassify(message: string): ClassifyResult {
  const text = message.toLowerCase().trim();
  if (!text) {
    return {
      intent: "generic_question",
      parameters: {},
      confidence: 0,
      rationale: "Empty message.",
    };
  }

  // ---- launch (high specificity) ----
  if (
    /\b(mark|move|set)\b.*\b(launch|launched|live|paused|review)\b/.test(text) ||
    /\blaunched externally\b/.test(text) ||
    /\b(publish|pause|unpublish) (the )?(funnel|campaign)\b/.test(text)
  ) {
    return {
      intent: "launch",
      parameters: {
        lifecycleTarget: /externally/.test(text)
          ? "LAUNCHED_EXTERNALLY"
          : /pause/.test(text)
            ? "PAUSED"
            : /review/.test(text)
              ? "READY_FOR_REVIEW"
              : "LAUNCHED",
      },
      confidence: 0.85,
      rationale: "Keyword match: lifecycle verb.",
    };
  }

  // ---- query (analytics) ----
  if (
    /\b(show|which|what|how many|how much|performance|winning|ctr|cpc|cpa|roas|conversion)\b/.test(
      text,
    ) &&
    !/\b(create|build|make|generate)\b/.test(text)
  ) {
    return {
      intent: "query",
      parameters: {},
      confidence: 0.78,
      rationale: "Keyword match: analytics verb without create verb.",
    };
  }

  // ---- create_campaign ----
  if (
    /\b(launch|run|create|start)\b.*\bcampaign\b/.test(text) ||
    /\bads? (for|to|targeting)\b/.test(text) ||
    /\bbooked demos?\b/.test(text) ||
    /\bqualified leads?\b/.test(text)
  ) {
    return {
      intent: "create_campaign",
      parameters: extractCampaignParams(text),
      confidence: 0.82,
      rationale: "Keyword match: campaign creation verb.",
    };
  }

  // ---- create_funnel ----
  if (
    /\b(build|create|make|generate)\b.*\b(funnel|landing page|page|site)\b/.test(
      text,
    ) ||
    /\bfunnel for\b/.test(text)
  ) {
    return {
      intent: "create_funnel",
      parameters: extractFunnelParams(text),
      confidence: 0.84,
      rationale: "Keyword match: funnel creation verb.",
    };
  }

  // ---- edit_campaign ----
  if (
    /\b(more|another|additional)\b.*\b(ad|ads|video|videos|creative|variant)s?\b/.test(
      text,
    ) ||
    /\b(target|targeting)\b.*\b(instead|rather|not)\b/.test(text) ||
    /\bregenerate\b/.test(text)
  ) {
    return {
      intent: "edit_campaign",
      parameters: extractEditCampaignParams(text),
      confidence: 0.78,
      rationale: "Keyword match: more variants or audience swap.",
    };
  }

  // ---- edit_funnel ----
  if (
    /\b(make|change|edit|swap|rewrite)\b.*\b(hero|headline|subhead|image|section|copy)\b/.test(
      text,
    ) ||
    /\b(shorter|longer|premium|urgent|softer|punchier|simpler)\b/.test(text)
  ) {
    return {
      intent: "edit_funnel",
      parameters: { instruction: message },
      confidence: 0.74,
      rationale: "Keyword match: edit verb + target slot.",
    };
  }

  return {
    intent: "generic_question",
    parameters: {},
    confidence: 0.4,
    rationale: "No keyword match.",
  };
}

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function coerceLowConfidence(result: ClassifyResult): ClassifyResult {
  if (result.confidence < CONFIDENCE_FLOOR && result.intent !== "generic_question") {
    return {
      ...result,
      intent: "generic_question",
      rationale: `Low confidence (${result.confidence.toFixed(2)}) coerced from ${result.intent}.`,
    };
  }
  return result;
}

function mergeContext(
  result: ClassifyResult,
  context: ClassifyContext,
): ClassifyResult {
  // Pull pinned context forward as default parameters. The LLM may already
  // have supplied them; explicit wins, context fills gaps.
  const parameters: IntentParameters = { ...result.parameters };
  if (!parameters.funnelId && context.funnelId) {
    parameters.funnelId = context.funnelId;
  }
  if (!parameters.campaignId && context.campaignId) {
    parameters.campaignId = context.campaignId;
  }
  return { ...result, parameters };
}

function extractFunnelParams(text: string): IntentParameters {
  const params: IntentParameters = {};
  const forMatch = text.match(/funnel for ([a-z0-9 ,&'-]+?)( that| who| with| to|$)/);
  if (forMatch?.[1]) params.industry = forMatch[1].trim();
  const goalMatch = text.match(/goal:?\s+([a-z0-9 ,&'-]+)/);
  if (goalMatch?.[1]) params.goal = goalMatch[1].trim();
  const targetMatch = text.match(/(?:target(?:ing)?|for) ([a-z0-9 ,&'-]+?)(?: with| to| and| that|$)/);
  if (targetMatch?.[1]) params.audience = targetMatch[1].trim();
  return params;
}

function extractCampaignParams(text: string): IntentParameters {
  const params: IntentParameters = {};
  const goalMatch =
    text.match(/goal:?\s+([a-z0-9 ,&'-]+)/) ??
    text.match(/(?:to|for) (booked demos?|qualified leads?|trials?|signups?|consults?)/);
  if (goalMatch?.[1]) params.goal = goalMatch[1].trim();
  const audienceMatch = text.match(/targeting ([a-z0-9 ,&'-]+?)(?:,| with| to| goal|$)/);
  if (audienceMatch?.[1]) params.audience = audienceMatch[1].trim();
  return params;
}

function extractEditCampaignParams(text: string): IntentParameters {
  const params: IntentParameters = { instruction: text };
  const countMatch = text.match(/(\d+)\s+(?:more|additional|new)/);
  if (countMatch?.[1]) params.count = Math.min(20, Number(countMatch[1]));
  if (/\bvideo\b/.test(text)) params.assetType = "video";
  else if (/\bimage\b/.test(text)) params.assetType = "image";
  else if (/\bcopy\b/.test(text)) params.assetType = "copy";
  return params;
}
