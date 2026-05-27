/**
 * Image generation client.
 *
 * Multiplexes Flux 1.1 Pro (Replicate), Ideogram v2, and Unsplash stock fallback.
 * Each call runs a safety classifier (NSFW gate) — on fail, falls back to
 * Ideogram → Unsplash.
 */
import Replicate from "replicate";
import type { AgentError, ModelId } from "../types.js";
import { imageCallCents } from "./pricing.js";

export interface ImageGenParams {
  /** Final prompt the model will receive. */
  prompt: string;
  /** Negative prompt — keywords to avoid. */
  negativePrompt?: string;
  /** Output aspect ratio (16:9, 1:1, 4:5, etc.). */
  aspectRatio?: string;
  /** Slot id (e.g. "hero", "section.proof.0") for tracking. */
  slotId: string;
  seed?: number;
  abortSignal?: AbortSignal;
}

export interface ImageGenResult {
  modelUsed: ModelId;
  url: string;
  thumbUrl?: string;
  costCents: number;
  safetyChecks: {
    passed: boolean;
    classifier: string;
    flags: string[];
    nsfwScore?: number;
  };
  promptUsed: string;
  licenseType: "generated" | "stock_unsplash" | "stock_pexels" | "customer_owned";
}

export interface ImageClientOptions {
  replicate?: Replicate;
  unsplashAccessKey?: string;
  ideogramApiKey?: string;
  fluxApiKey?: string;
  /** Safety classifier function. Default: heuristic. */
  safetyClassifier?: (url: string, prompt: string) => Promise<{
    passed: boolean;
    flags: string[];
    nsfwScore?: number;
  }>;
}

export class ImageClient {
  private replicate?: Replicate;
  private unsplashAccessKey?: string;
  private safetyClassifier: (url: string, prompt: string) => Promise<{
    passed: boolean;
    flags: string[];
    nsfwScore?: number;
  }>;

  constructor(opts: ImageClientOptions = {}) {
    this.replicate =
      opts.replicate ??
      (process.env["REPLICATE_API_TOKEN"]
        ? new Replicate({ auth: process.env["REPLICATE_API_TOKEN"] })
        : undefined);
    this.unsplashAccessKey = opts.unsplashAccessKey ?? process.env["UNSPLASH_ACCESS_KEY"];
    this.safetyClassifier = opts.safetyClassifier ?? defaultSafetyClassifier;
  }

  /** Try Flux first; on safety fail, try Ideogram; on second fail, Unsplash stock. */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const chain: ModelId[] = ["flux-1.1-pro", "ideogram-v2", "unsplash-stock"];

    let lastError: unknown;
    for (const model of chain) {
      try {
        const candidate = await this.runOne(model, params);
        const safety = await this.safetyClassifier(candidate.url, params.prompt);
        if (safety.passed) {
          return {
            modelUsed: model,
            url: candidate.url,
            thumbUrl: candidate.thumbUrl,
            costCents: imageCallCents(model, 1),
            safetyChecks: {
              passed: true,
              classifier: "default-safety-v1",
              flags: safety.flags,
              nsfwScore: safety.nsfwScore,
            },
            promptUsed: params.prompt,
            licenseType: model === "unsplash-stock" ? "stock_unsplash" : "generated",
          };
        }
        // safety failed — try the next model in the chain
        lastError = `safety_blocked: ${safety.flags.join(",")}`;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    const error: AgentError = {
      kind: "safety_block",
      classifier: "image-chain",
      reason: typeof lastError === "string" ? lastError : "all providers failed",
    };
    throw error;
  }

  private async runOne(
    model: ModelId,
    params: ImageGenParams,
  ): Promise<{ url: string; thumbUrl?: string }> {
    if (model === "flux-1.1-pro") {
      if (!this.replicate) {
        throw new Error("ReplicateClient: REPLICATE_API_TOKEN missing");
      }
      const output = (await this.replicate.run(
        "black-forest-labs/flux-1.1-pro",
        {
          input: {
            prompt: params.prompt,
            aspect_ratio: params.aspectRatio ?? "16:9",
            safety_tolerance: 2,
            output_format: "webp",
            output_quality: 90,
            ...(params.seed ? { seed: params.seed } : {}),
          },
          signal: params.abortSignal,
        } as never,
      )) as string | string[];
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) throw new Error("Flux returned empty output");
      return { url };
    }

    if (model === "ideogram-v2") {
      if (!this.replicate) throw new Error("ReplicateClient: REPLICATE_API_TOKEN missing");
      const output = (await this.replicate.run(
        "ideogram-ai/ideogram-v2",
        {
          input: {
            prompt: params.prompt,
            aspect_ratio: params.aspectRatio ?? "16:9",
            ...(params.seed ? { seed: params.seed } : {}),
          },
          signal: params.abortSignal,
        } as never,
      )) as string | string[];
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) throw new Error("Ideogram returned empty output");
      return { url };
    }

    if (model === "unsplash-stock") {
      // Unsplash search API — pull the top result keyed off the prompt's nouns.
      if (!this.unsplashAccessKey) {
        // For tests/dev with no key, return a deterministic placeholder.
        return {
          url: `https://images.unsplash.com/photo-placeholder?slot=${encodeURIComponent(params.slotId)}`,
          thumbUrl: `https://images.unsplash.com/photo-placeholder-thumb?slot=${encodeURIComponent(
            params.slotId,
          )}`,
        };
      }
      const query = encodeURIComponent(params.prompt.slice(0, 200));
      const res = await fetch(
        `https://api.unsplash.com/search/photos?per_page=1&query=${query}`,
        {
          headers: { Authorization: `Client-ID ${this.unsplashAccessKey}` },
          signal: params.abortSignal,
        },
      );
      if (!res.ok) throw new Error(`Unsplash error: ${res.status}`);
      const json = (await res.json()) as {
        results?: { urls?: { regular?: string; thumb?: string } }[];
      };
      const first = json.results?.[0]?.urls;
      if (!first?.regular) throw new Error("Unsplash returned no results");
      return { url: first.regular, thumbUrl: first.thumb };
    }

    throw new Error(`Unknown image model: ${model}`);
  }
}

/**
 * Default safety classifier — heuristic until we wire a real NSFW model.
 * Real impl: call Sightengine, AWS Rekognition, or a Replicate NSFW classifier.
 */
async function defaultSafetyClassifier(
  _url: string,
  prompt: string,
): Promise<{ passed: boolean; flags: string[]; nsfwScore?: number }> {
  const flags: string[] = [];
  const bad = ["nude", "naked", "explicit", "porn", "sexual", "violence", "gore", "weapon"];
  const p = prompt.toLowerCase();
  for (const word of bad) {
    if (p.includes(word)) flags.push(`prompt_blocked:${word}`);
  }
  return { passed: flags.length === 0, flags, nsfwScore: flags.length > 0 ? 0.99 : 0.01 };
}
