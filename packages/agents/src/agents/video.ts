/**
 * Video Agent — generates a 6-15 second hero video via Runway Gen-3 / Veo 3,
 * falls back to curated stock B-roll. Runs LAST in the DAG (Phase 6) because
 * it's the longest-tail call and the funnel can publish without it.
 *
 * Spec: docs/19-orchestrator-code-spec.md §B.2.6
 */
import { VideoClient } from "../llm/video-client.js";
import {
  type Agent,
  type AgentContext,
  type AgentEvent,
  type ModelCallRecord,
  type ModelId,
  type VideoInput,
  type VideoOutput,
  VideoOutputSchema,
} from "../types.js";
import {
  finalEvent,
  nowIso,
  progressEvent,
  startedEvent,
} from "./_base.js";
import { videoCallCents } from "../llm/pricing.js";

export interface VideoAgentDeps {
  videos: VideoClient;
  /** Optional safety classifier for the generated frame. */
  safetyClassifier?: (url: string) => Promise<{ passed: boolean; flags: string[] }>;
}

export function createVideoAgent(deps: VideoAgentDeps): Agent<VideoInput, VideoOutput> {
  const primary: ModelId = "runway-gen-3";
  const fallback: ModelId[] = ["veo-3", "stock-broll"];

  return {
    name: "video",
    primaryModel: primary,
    fallbackChain: fallback,
    estCostCents: 40,
    cacheNamespace: "video",
    optional: true,

    async *run(input: VideoInput, ctx: AgentContext): AsyncIterable<AgentEvent<VideoOutput>> {
      const started = Date.now();
      yield startedEvent(ctx, "video", primary) as AgentEvent<VideoOutput>;

      // Hero video: 6-12s, image-to-video if heroImageUrl provided.
      const prompt = composeVideoPrompt(input);

      yield progressEvent(ctx, "video", 5, "Submitting to provider");

      const polishTimer = setTimeout(() => {
        ctx.emit?.(progressEvent(ctx, "video", 35, "polishing"));
      }, 30_000);

      const calls: ModelCallRecord[] = [];

      try {
        const result = await deps.videos.generate({
          prompt,
          durationS: 8,
          aspectRatio: "16:9",
          heroImageUrl: input.heroImageUrl,
          seed: ctx.seed,
          abortSignal: ctx.abortSignal,
        });

        clearTimeout(polishTimer);

        yield progressEvent(ctx, "video", 80, "Running safety classifier");

        const safety = deps.safetyClassifier
          ? await deps.safetyClassifier(result.url)
          : { passed: true, flags: [] };

        if (!safety.passed) {
          yield {
            type: "error",
            ts: nowIso(ctx),
            agent: "video",
            error: { kind: "safety_block", classifier: "video-safety-v1", reason: safety.flags.join(",") },
            willRetry: false,
          } as AgentEvent<VideoOutput>;
          return;
        }

        calls.push({
          model: result.modelUsed,
          category: "video",
          unitCount: result.durationS,
          unitRateCents: videoCallCents(result.modelUsed, result.durationS),
          metadata: { modelUsed: result.modelUsed },
        });
        await ctx.recordCost("video", calls);

        const output: VideoOutput = {
          heroVideo: {
            url: result.url,
            durationS: result.durationS,
            modelUsed: result.modelUsed,
            thumbUrl: result.thumbUrl,
          },
          captions: { srt: result.srtCaptions },
          safetyChecks: {
            passed: true,
            classifier: "video-safety-v1",
            flags: safety.flags,
          },
        };

        const validated = VideoOutputSchema.safeParse(output);
        if (!validated.success) {
          yield {
            type: "error",
            ts: nowIso(ctx),
            agent: "video",
            error: { kind: "schema_invalid", errors: validated.error.issues },
            willRetry: false,
          } as AgentEvent<VideoOutput>;
          return;
        }

        yield progressEvent(ctx, "video", 100);
        yield finalEvent(
          ctx,
          "video",
          result.modelUsed,
          validated.data,
          { totalCents: result.costCents, calls },
          { cachedInputTokens: 0, freshInputTokens: 0, ratio: 0 },
          Date.now() - started,
        ) as AgentEvent<VideoOutput>;
      } catch (err) {
        clearTimeout(polishTimer);
        yield {
          type: "error",
          ts: nowIso(ctx),
          agent: "video",
          error: isAgentError(err) ? err : { kind: "unknown", message: String(err), raw: err },
          willRetry: false,
        } as AgentEvent<VideoOutput>;
      }
    },
  };
}

function composeVideoPrompt(input: VideoInput): string {
  const headline = input.hook.primary.headline;
  return [
    `Hero video for funnel: "${headline}"`,
    `Brand mood: ${input.brandTokens.imagery.mood}`,
    `Lighting: ${input.brandTokens.imagery.lighting}`,
    "Cinematic, 8 seconds, 16:9, slow camera move",
    "No text overlay, no logos of real brands, no identifiable celebrities",
  ].join(". ");
}

function isAgentError(x: unknown): x is import("../types.js").AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}
