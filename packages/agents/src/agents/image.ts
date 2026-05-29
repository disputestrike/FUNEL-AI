/**
 * Image Agent — generates funnel imagery via Flux 1.1 Pro (primary),
 * Ideogram v2 (typography fallback), SDXL (cheap last resort), then licensed
 * stock (Unsplash → Pexels) as the no-AI floor. Consumes brand tokens from the
 * Brand Guardian and slot specs from the Page output.
 *
 * Tier policy (brand: GoFunnelAI, gofunnelai.com):
 *   - free                : stock only, no AI gen cost.
 *   - starter / pro_boost : up to 5 AI images per funnel, remainder via stock.
 *   - growth+             : unlimited AI images.
 *
 * Each AI image:
 *   - Inherits the brand palette (hex codes injected into the Flux prompt).
 *   - Is verified by the Replicate NSFW classifier; on flag, regenerated with
 *     a sanitized prompt; on second flag, falls back to stock with a clean
 *     concept query.
 *   - Is uploaded to R2 (`gofunnelai-assets/funnels/{funnelId}/{uuid}.webp`)
 *     and the CDN URL is returned in the agent output.
 *
 * Spec: docs/19-orchestrator-code-spec.md §B.2.5
 */
import { ImageClient } from "../llm/image-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ImageInput,
  type ImageOutput,
  ImageOutputSchema,
  type ModelCallRecord,
  type ModelId,
  type Tier,
} from "../types.js";
import { imageCallCents } from "../llm/pricing.js";
import {
  finalEvent,
  nowIso,
  progressEvent,
  startedEvent,
} from "./_base.js";

export interface ImageAgentDeps {
  images: ImageClient;
}

/**
 * System prompt fragment — fed into every Flux call as a leading style block
 * so the model anchors on documentary-editorial realism, not generic stock
 * cringe.
 */
const STYLE_DIRECTION = [
  "editorial documentary photography",
  "natural lighting, real-world setting",
  "candid composition, depth of field",
  "shot on full-frame mirrorless, 35mm or 50mm prime",
  "real-feeling humans, no model poses, no fake handshakes",
  "no stock-photo cliches, no businesspeople pointing at charts",
];

const NEGATIVE_PROMPT_DEFAULTS =
  "text, watermark, logos of real brands, identifiable real public figures, blurry, distorted hands, low quality, jpeg artifacts, cartoon, anime, illustration unless specified, fake handshake, generic businesspeople, stock photo cliche";

/** AI-image quota by tier — beyond this we fall back to stock for remaining slots. */
const AI_BUDGET_BY_TIER: Record<Tier, number> = {
  free: 0,
  starter: 5,
  growth: Number.POSITIVE_INFINITY,
  scale: Number.POSITIVE_INFINITY,
  agency: Number.POSITIVE_INFINITY,
};

export function createImageAgent(deps: ImageAgentDeps): Agent<ImageInput, ImageOutput> {
  const primary: ModelId = "flux-1.1-pro";
  const fallback: ModelId[] = ["ideogram-v2", "sdxl", "unsplash-stock", "pexels-stock"];

  return {
    name: "image",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 16,
    cacheNamespace: "image",
    optional: false,

    async *run(input: ImageInput, ctx: AgentContext): AsyncIterable<AgentEvent<ImageOutput>> {
      const started = Date.now();
      yield startedEvent(ctx, "image", primary) as AgentEvent<ImageOutput>;

      const tier: Tier = ctx.tier ?? "free";
      const aiBudget = AI_BUDGET_BY_TIER[tier] ?? 0;
      const funnelId = ctx.generationId; // generationId == funnel build id

      const totalSlots = input.slots.length;
      const generated: ImageOutput["images"] = [];
      const calls: ModelCallRecord[] = [];

      let aiUsed = 0;

      for (let i = 0; i < totalSlots; i++) {
        const slot = input.slots[i]!;
        const prompt = composePrompt(slot.sceneDescription, input.brandTokens, slot.slotId, ctx.industry);
        const conceptQuery = composeConceptQuery(slot.sceneDescription, ctx.industry);

        yield progressEvent(
          ctx,
          "image",
          Math.round((i / totalSlots) * 100),
          `Generating ${slot.slotId} (${aiUsed < aiBudget ? "AI" : "stock"})`,
        );

        // Tier guardrail: route to stock-only chain once AI budget exhausted.
        const useAi = aiUsed < aiBudget;
        const forceChain = useAi
          ? undefined // default chain: flux → ideogram → sdxl → stock
          : (["stock"] as const);

        try {
          const result = await deps.images.generate({
            prompt,
            negativePrompt: NEGATIVE_PROMPT_DEFAULTS,
            aspectRatio: slot.slotId.startsWith("hero") ? "16:9" : "4:5",
            slotId: slot.slotId,
            funnelId,
            industry: typeof ctx.industry === "string" ? ctx.industry : undefined,
            paletteHex: extractPaletteHex(input.brandTokens),
            stockConceptQuery: conceptQuery,
            forceChain: forceChain as ("flux-1.1-pro" | "ideogram-v2" | "sdxl" | "stock")[] | undefined,
            seed: ctx.seed,
            abortSignal: ctx.abortSignal,
          });

          if (result.licenseType === "generated") aiUsed++;

          generated.push({
            slotId: slot.slotId,
            url: result.url,
            thumbUrl: result.thumbUrl,
            altText: deriveAltText(slot.sceneDescription),
            modelUsed: result.modelUsed,
            promptUsed: result.promptUsed,
            safetyChecks: result.safetyChecks,
            licenseType: result.licenseType,
          });

          calls.push({
            model: result.modelUsed,
            category: "image",
            unitCount: 1,
            unitRateCents: result.costCents || imageCallCents(result.modelUsed, 1),
            metadata: {
              slotId: slot.slotId,
              modelUsed: result.modelUsed,
              licenseType: result.licenseType,
              hostedOnR2: result.hostedOnR2 ? "1" : "0",
              ...(result.r2Key ? { r2Key: result.r2Key } : {}),
              ...(result.attribution ? { attribution: result.attribution.htmlCredit } : {}),
            },
          });

          if (result.safetyChecks && !result.safetyChecks.passed) {
            ctx.logger.warn("image: nsfw fallback engaged", {
              slotId: slot.slotId,
              classifier: result.safetyChecks.classifier,
              nsfwScore: result.safetyChecks.nsfwScore,
            });
          }
        } catch (err) {
          ctx.logger.warn("image: slot generation failed", { slotId: slot.slotId, err: String(err) });
          // Skip this slot but continue with others (the renderer will use a placeholder).
          continue;
        }
      }

      const output: ImageOutput = { images: generated };
      const parsed = ImageOutputSchema.safeParse(output);
      if (!parsed.success) {
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "image",
          error: { kind: "schema_invalid", errors: parsed.error.issues },
          willRetry: false,
        } as AgentEvent<ImageOutput>;
        return;
      }

      await ctx.recordCost("image", calls);

      const totalCents = calls.reduce((sum, c) => sum + (c.unitRateCents ?? 0), 0);
      yield progressEvent(ctx, "image", 100);
      yield finalEvent(
        ctx,
        "image",
        primary,
        parsed.data,
        { totalCents, calls },
        { cachedInputTokens: 0, freshInputTokens: 0, ratio: 0 },
        Date.now() - started,
      ) as AgentEvent<ImageOutput>;
    },
  };
}

/**
 * Compose the final Flux/Ideogram prompt. Stacks:
 *   1. Industry-specific subject scaffolding
 *   2. Scene from Page agent
 *   3. Brand palette injection (hex codes literally — Flux understands hex)
 *   4. Brand imagery directives
 *   5. Editorial style anchor
 */
function composePrompt(
  scene: string,
  brand: ImageInput["brandTokens"],
  slotId: string,
  industry: string | undefined,
): string {
  const palette = brand.palette;
  const paletteLine = [
    `primary ${palette.primary}`,
    `secondary ${palette.secondary}`,
    `accent ${palette.accent}`,
  ].join(", ");

  const industryAnchor = INDUSTRY_VISUAL_ANCHORS[String(industry ?? "").toLowerCase()];
  const isGraphic = slotId.includes("icon") || slotId.includes("graphic") || slotId.includes("illustration");
  const palettePhrasing = isGraphic
    ? `strict color palette adherence: only use ${paletteLine}, neutral whites, soft greys`
    : `color palette: ${paletteLine}, neutral whites, soft greys`;

  const parts: string[] = [];
  if (industryAnchor) parts.push(industryAnchor);
  parts.push(scene);
  parts.push(palettePhrasing);
  parts.push(`mood: ${brand.imagery.mood}`);
  parts.push(`lighting: ${brand.imagery.lighting}`);
  parts.push(`subject guidance: ${brand.imagery.subjectGuidance}`);
  parts.push(...STYLE_DIRECTION);
  parts.push("no text, no logos, no watermarks, no identifiable real public figures");
  return parts.join(". ");
}

/** Industry-specific scene anchors so the model doesn't drift into generic stock. */
const INDUSTRY_VISUAL_ANCHORS: Record<string, string> = {
  solar:
    "Suburban home rooftop with installed solar panels, real family on porch, golden-hour sun on the array",
  hvac:
    "Real HVAC technician working on an outdoor condenser at a residential home, focused, no posed smile",
  real_estate:
    "Modern home exterior with manicured landscaping, key handover or front-porch detail, warm afternoon light",
  coaching: "Coach mid-conversation across a desk, real listening posture, natural office light",
  fitness: "Real athlete training in a gym, mid-rep, sweat, no model-posing",
  med_spa: "Clean modern aesthetic clinic, soft natural light, real client receiving treatment",
  cosmetic_surgery:
    "Modern surgical consultation room, warm lighting, real patient-doctor conversation, no graphic imagery",
  dental: "Clean modern dental office, patient smile after care, hygienist in scrubs",
  chiropractic: "Chiropractor adjusting patient on table, modern wellness clinic, soft daylight",
  insurance: "Advisor and family at kitchen table reviewing documents, warm light",
  mortgage: "Couple receiving keys from agent at front door of new home, candid moment",
  financial_advisor: "Advisor and client at modern office desk with laptop and printed charts",
  legal: "Lawyer at desk reading documents in a modern law office, no exaggerated gestures",
  saas:
    "Real product UI on a laptop screen in a modern workspace, hands on keyboard, depth of field",
  ecommerce: "Studio product flatlay or in-use lifestyle shot, soft directional light",
  agency: "Creative team at whiteboard mid-discussion, real collaboration energy",
  education: "Students engaged in classroom or workshop, natural curiosity, no posed group shots",
  home_services: "Tradesperson working at a residential home, real action shot",
  supplements: "Wellness product flatlay with natural elements, soft daylight",
  info_products: "Creator at home desk with camera and ring light, real workspace clutter",
};

/** Cleaner query for stock search — pulls subject + industry. */
function composeConceptQuery(scene: string, industry: string | undefined): string {
  const head = scene.split(",")[0]!.trim();
  return industry ? `${industry} ${head}` : head;
}

function extractPaletteHex(brand: ImageInput["brandTokens"]): string[] {
  const p = brand.palette;
  return [p.primary, p.secondary, p.accent].filter(Boolean);
}

function deriveAltText(scene: string): string {
  return scene.length > 280 ? scene.slice(0, 277) + "..." : scene;
}
