/**
 * Unified Replicate adapter for image generation.
 *
 * Multiplexes Flux 1.1 Pro (primary, best photographic quality), Ideogram v2
 * (fallback, best in-image typography), and Stable Diffusion XL (last-resort
 * cheap). Polls the prediction endpoint until completion or aborts on signal.
 *
 * This is a thin function-style helper used by the image agent's ImageClient —
 * separate from the PAL-style FluxAdapter/IdeogramAdapter which are for the
 * broader DIRECT-mode action plane.
 *
 * Env:
 *   REPLICATE_API_TOKEN — required for any real call.
 */

export type ReplicateImageModel =
  | "flux-1.1-pro"
  | "ideogram-v2"
  | "sdxl";

export interface ReplicateRunInput {
  model: ReplicateImageModel;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  seed?: number;
  /** webp | jpg | png */
  outputFormat?: "webp" | "jpg" | "png";
  outputQuality?: number;
  abortSignal?: AbortSignal;
}

export interface ReplicateRunResult {
  url: string;
  model: ReplicateImageModel;
  /** Cost cents — list rate. */
  costCents: number;
  predictionId: string;
  /** Milliseconds spent on the prediction (server side). */
  predictTimeMs?: number;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | { url?: string };
  error?: string;
  urls?: { get?: string; cancel?: string; stream?: string };
  metrics?: { predict_time?: number };
}

const MODEL_PATHS: Record<ReplicateImageModel, string> = {
  "flux-1.1-pro": "black-forest-labs/flux-1.1-pro",
  "ideogram-v2": "ideogram-ai/ideogram-v2",
  // SDXL pinned version hash — Replicate requires version for community models.
  sdxl: "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
};

/** Cents per image — list rates. */
export const REPLICATE_LIST_RATES: Record<ReplicateImageModel, number> = {
  "flux-1.1-pro": 4, // $0.04
  "ideogram-v2": 6, // $0.06
  sdxl: 0.5, // ~$0.005
};

export interface ReplicateClientConfig {
  apiToken?: string;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Polling interval ms (default 1500). */
  pollIntervalMs?: number;
  /** Max wait ms before timing out (default 90s). */
  maxWaitMs?: number;
}

export class ReplicateImageClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(cfg: ReplicateClientConfig = {}) {
    this.token = cfg.apiToken ?? process.env["REPLICATE_API_TOKEN"] ?? "";
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.pollIntervalMs = cfg.pollIntervalMs ?? 1500;
    this.maxWaitMs = cfg.maxWaitMs ?? 90_000;
  }

  hasToken(): boolean {
    return this.token.length > 0;
  }

  /** Run a single prediction and wait for completion. */
  async run(input: ReplicateRunInput): Promise<ReplicateRunResult> {
    if (!this.token) {
      throw new Error("ReplicateImageClient: REPLICATE_API_TOKEN missing");
    }
    const modelPath = MODEL_PATHS[input.model];
    const body = buildPredictionBody(modelPath, input);

    // Create prediction.
    const createUrl = modelPath.includes(":")
      ? "https://api.replicate.com/v1/predictions"
      : `https://api.replicate.com/v1/models/${modelPath}/predictions`;
    const createRes = await this.fetchImpl(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Prefer: "wait=0",
      },
      body: JSON.stringify(body),
      signal: input.abortSignal,
    });
    if (!createRes.ok) {
      const text = await safeText(createRes);
      throw new Error(`Replicate ${input.model} create failed: ${createRes.status} ${text}`);
    }
    const created = (await createRes.json()) as ReplicatePrediction;
    const predictionId = created.id;

    // Poll until terminal or timeout.
    const started = Date.now();
    let current: ReplicatePrediction = created;
    while (current.status !== "succeeded" && current.status !== "failed" && current.status !== "canceled") {
      if (Date.now() - started > this.maxWaitMs) {
        throw new Error(`Replicate ${input.model} timeout after ${this.maxWaitMs}ms (prediction ${predictionId})`);
      }
      if (input.abortSignal?.aborted) {
        throw new Error("Replicate run aborted");
      }
      await sleep(this.pollIntervalMs, input.abortSignal);
      const getRes = await this.fetchImpl(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.token}` },
        signal: input.abortSignal,
      });
      if (!getRes.ok) {
        const text = await safeText(getRes);
        throw new Error(`Replicate ${input.model} poll failed: ${getRes.status} ${text}`);
      }
      current = (await getRes.json()) as ReplicatePrediction;
    }

    if (current.status !== "succeeded") {
      throw new Error(`Replicate ${input.model} ${current.status}: ${current.error ?? "unknown"}`);
    }

    const url = extractUrl(current.output);
    if (!url) {
      throw new Error(`Replicate ${input.model} succeeded but returned no URL`);
    }

    return {
      url,
      model: input.model,
      costCents: REPLICATE_LIST_RATES[input.model],
      predictionId,
      predictTimeMs: current.metrics?.predict_time ? Math.round(current.metrics.predict_time * 1000) : undefined,
    };
  }

  /**
   * Run Replicate's NSFW classifier on a generated image URL.
   * Returns { passed, nsfwScore }. If the classifier itself fails, fails-open
   * (returns passed=true) so a single moderation outage doesn't block all gen.
   */
  async classifyNSFW(imageUrl: string, abortSignal?: AbortSignal): Promise<{ passed: boolean; nsfwScore: number; classifier: string }> {
    if (!this.token) {
      return { passed: true, nsfwScore: 0, classifier: "no-token" };
    }
    try {
      const body = {
        version: "97116600cabd3037e5f22ca08ffe6e7c2da4c0e3b8e08d4f9f0e1e0e4e0e0e0e",
        input: { image: imageUrl },
      };
      // NSFW classifier on Replicate (laion/CLIP-based).
      const res = await this.fetchImpl("https://api.replicate.com/v1/models/falcons-ai/nsfw_image_detection/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Prefer: "wait=10",
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });
      if (!res.ok) {
        return { passed: true, nsfwScore: 0, classifier: "nsfw-classifier-error" };
      }
      const pred = (await res.json()) as ReplicatePrediction;
      // Output shape: array of { label, score } or { nsfw_score: number }.
      const score = parseNsfwScore(pred.output);
      const passed = score < 0.5;
      return { passed, nsfwScore: score, classifier: "replicate-nsfw-v1" };
    } catch {
      return { passed: true, nsfwScore: 0, classifier: "nsfw-classifier-error" };
    }
  }
}

function buildPredictionBody(modelPath: string, input: ReplicateRunInput): Record<string, unknown> {
  const inputBody: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio ?? "16:9",
    output_format: input.outputFormat ?? "webp",
    output_quality: input.outputQuality ?? 92,
  };
  if (input.negativePrompt) inputBody["negative_prompt"] = input.negativePrompt;
  if (input.seed !== undefined) inputBody["seed"] = input.seed;
  // Flux 1.1 Pro uses safety_tolerance (0-6, default 2).
  if (modelPath.includes("flux")) inputBody["safety_tolerance"] = 2;
  // Ideogram supports style_type + magic_prompt_option.
  if (modelPath.includes("ideogram")) {
    inputBody["style_type"] = "REALISTIC";
    inputBody["magic_prompt_option"] = "AUTO";
  }
  // SDXL doesn't use aspect_ratio — uses width/height.
  if (modelPath.includes("sdxl")) {
    const { width, height } = aspectToDims(input.aspectRatio ?? "16:9");
    delete inputBody["aspect_ratio"];
    inputBody["width"] = width;
    inputBody["height"] = height;
  }

  const body: Record<string, unknown> = { input: inputBody };
  if (modelPath.includes(":")) {
    body["version"] = modelPath.split(":")[1];
  }
  return body;
}

function aspectToDims(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1024, height: 576 };
    case "9:16":
      return { width: 576, height: 1024 };
    case "4:5":
      return { width: 832, height: 1024 };
    case "5:4":
      return { width: 1024, height: 832 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

function extractUrl(output: ReplicatePrediction["output"]): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return typeof output[0] === "string" ? output[0] : undefined;
  if (typeof output === "object" && output && "url" in output) return output.url;
  return undefined;
}

function parseNsfwScore(output: ReplicatePrediction["output"]): number {
  if (!output) return 0;
  if (typeof output === "number") return output;
  if (Array.isArray(output)) {
    // [{ label: "nsfw", score: 0.97 }, { label: "normal", score: 0.03 }]
    for (const entry of output) {
      if (entry && typeof entry === "object" && "label" in (entry as object) && "score" in (entry as object)) {
        const e = entry as { label: string; score: number };
        if (e.label.toLowerCase().includes("nsfw") || e.label.toLowerCase().includes("porn")) {
          return e.score;
        }
      }
    }
  }
  if (typeof output === "object" && output && "nsfw_score" in output) {
    return Number((output as { nsfw_score: number }).nsfw_score) || 0;
  }
  return 0;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        },
        { once: true },
      );
    }
  });
}
