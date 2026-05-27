/**
 * Image Agent — generates funnel imagery via Flux 1.1 Pro (primary),
 * Ideogram v2 (fallback), Unsplash stock (final fallback). Consumes brand
 * tokens from Brand Guardian and slot specs from the Page output.
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

const NEGATIVE_PROMPT_DEFAULTS =
  "text, watermark, logos of real brands, identifiable real human faces, blurry, distorted hands, low quality, jpeg artifacts, cartoon, anime, illustration unless specified";

export function createImageAgent(deps: ImageAgentDeps): Agent<ImageInput, ImageOutput> {
  const primary: ModelId = "flux-1.1-pro";
  const fallback: ModelId[] = ["ideogram-v2", "unsplash-stock"];

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

      const totalSlots = input.slots.length;
      const generated: ImageOutput["images"] = [];
      const calls: ModelCallRecord[] = [];

      for (let i = 0; i < totalSlots; i++) {
        const slot = input.slots[i]!;
        const prompt = composePrompt(slot.sceneDescription, input.brandTokens);

        yield progressEvent(ctx, "image", Math.round((i / totalSlots) * 100), `Generating ${slot.slotId}`);

        try {
          const result = await deps.images.generate({
            prompt,
            negativePrompt: NEGATIVE_PROMPT_DEFAULTS,
            aspectRatio: slot.slotId.startsWith("hero") ? "16:9" : "4:5",
            slotId: slot.slotId,
            seed: ctx.seed,
            abortSignal: ctx.abortSignal,
          });

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
            unitRateCents: imageCallCents(result.modelUsed, 1),
            metadata: { slotId: slot.slotId, modelUsed: result.modelUsed },
          });
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

function composePrompt(scene: string, brand: ImageInput["brandTokens"]): string {
  const palette = `${brand.palette.primary}, ${brand.palette.secondary}, ${brand.palette.accent}`;
  return [
    scene,
    `color palette: ${palette}`,
    `mood: ${brand.imagery.mood}`,
    `lighting: ${brand.imagery.lighting}`,
    `subject guidance: ${brand.imagery.subjectGuidance}`,
    "photographic, professional commercial photography",
    "no text, no logos, no watermarks, no identifiable real public figures",
  ].join(", ");
}

function deriveAltText(scene: string): string {
  return scene.length > 280 ? scene.slice(0, 277) + "..." : scene;
}
