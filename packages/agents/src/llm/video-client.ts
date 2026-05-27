/**
 * Video generation client.
 *
 * Multiplexes Runway Gen-3, Veo 3, and stock B-roll fallback (Pexels).
 * Generation can take 1-3 minutes — caller is responsible for emitting
 * "polishing" events.
 */
import Replicate from "replicate";
import type { AgentError, ModelId } from "../types.js";
import { videoCallCents } from "./pricing.js";

export interface VideoGenParams {
  prompt: string;
  durationS?: number;
  aspectRatio?: string;
  heroImageUrl?: string;
  abortSignal?: AbortSignal;
  seed?: number;
}

export interface VideoGenResult {
  modelUsed: ModelId;
  url: string;
  thumbUrl?: string;
  durationS: number;
  costCents: number;
  srtCaptions: string;
}

export interface VideoClientOptions {
  replicate?: Replicate;
  pexelsApiKey?: string;
}

export class VideoClient {
  private replicate?: Replicate;
  private pexelsApiKey?: string;

  constructor(opts: VideoClientOptions = {}) {
    this.replicate =
      opts.replicate ??
      (process.env["REPLICATE_API_TOKEN"]
        ? new Replicate({ auth: process.env["REPLICATE_API_TOKEN"] })
        : undefined);
    this.pexelsApiKey = opts.pexelsApiKey ?? process.env["PEXELS_API_KEY"];
  }

  async generate(params: VideoGenParams): Promise<VideoGenResult> {
    const chain: ModelId[] = ["runway-gen-3", "veo-3", "stock-broll"];
    let lastError: unknown;

    const duration = Math.min(15, Math.max(6, params.durationS ?? 8));

    for (const model of chain) {
      try {
        const result = await this.runOne(model, { ...params, durationS: duration });
        return {
          modelUsed: model,
          url: result.url,
          thumbUrl: result.thumbUrl,
          durationS: duration,
          costCents: videoCallCents(model, duration),
          srtCaptions: result.srtCaptions ?? defaultSrt(params.prompt, duration),
        };
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    const e: AgentError = {
      kind: "unknown",
      message: `video chain exhausted: ${String(lastError)}`,
      raw: lastError,
    };
    throw e;
  }

  private async runOne(
    model: ModelId,
    params: VideoGenParams,
  ): Promise<{ url: string; thumbUrl?: string; srtCaptions?: string }> {
    if (model === "runway-gen-3" || model === "veo-3") {
      if (!this.replicate) throw new Error("VideoClient: REPLICATE_API_TOKEN missing");
      const replicateModel =
        model === "runway-gen-3" ? "runwayml/gen-3-alpha" : "google-deepmind/veo-3";
      const output = (await this.replicate.run(
        replicateModel,
        {
          input: {
            prompt: params.prompt,
            duration: params.durationS ?? 8,
            aspect_ratio: params.aspectRatio ?? "16:9",
            ...(params.heroImageUrl ? { image: params.heroImageUrl } : {}),
            ...(params.seed ? { seed: params.seed } : {}),
          },
          signal: params.abortSignal,
        } as never,
      )) as string | string[];
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) throw new Error(`${model} returned empty output`);
      return { url };
    }

    if (model === "stock-broll") {
      if (!this.pexelsApiKey) {
        return {
          url: `https://videos.pexels.com/video-placeholder?prompt=${encodeURIComponent(
            params.prompt.slice(0, 60),
          )}`,
        };
      }
      const query = encodeURIComponent(params.prompt.slice(0, 100));
      const res = await fetch(
        `https://api.pexels.com/videos/search?per_page=1&query=${query}`,
        { headers: { Authorization: this.pexelsApiKey }, signal: params.abortSignal },
      );
      if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
      const json = (await res.json()) as {
        videos?: Array<{
          video_files?: Array<{ link?: string; quality?: string }>;
          image?: string;
        }>;
      };
      const v = json.videos?.[0];
      const file = v?.video_files?.find((f) => f.quality === "hd") ?? v?.video_files?.[0];
      if (!file?.link) throw new Error("Pexels returned no usable file");
      return { url: file.link, thumbUrl: v?.image };
    }
    throw new Error(`Unknown video model: ${model}`);
  }
}

function defaultSrt(prompt: string, durationS: number): string {
  const text = prompt.split(/[.!?]/)[0]?.trim().slice(0, 120) ?? "";
  return `1\n00:00:00,000 --> 00:00:${String(durationS).padStart(2, "0")},000\n${text}\n`;
}
