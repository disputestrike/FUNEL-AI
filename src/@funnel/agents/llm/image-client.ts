/**
 * Image generation client.
 *
 * Multiplexes Flux 1.1 Pro (Replicate, primary), Ideogram v2 (fallback, better
 * in-image typography), Stable Diffusion XL (last-resort cheap), and licensed
 * stock (Unsplash + Pexels) as the no-AI fallback.
 *
 * Pipeline per slot:
 *   1. Try AI provider chain (skipped entirely on free tier)
 *   2. Run NSFW classifier on the result (Replicate falcons-ai/nsfw_image_detection)
 *   3. On NSFW flag, regenerate with adjusted prompt; on second flag, fall back
 *      to stock with a clean concept query.
 *   4. Upload approved image to R2 → return CDN URL + license metadata.
 *
 * No network coupling: the underlying adapters (ReplicateImageClient, StockClient,
 * R2AssetsClient) are injected so tests can fake the whole pipeline.
 */
import Replicate from "replicate";
import type { ModelId } from "../types.js";
import { imageCallCents } from "./pricing.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ImageProviderChain = ("flux-1.1-pro" | "ideogram-v2" | "sdxl" | "stock")[];

export interface ImageGenParams {
  /** Final prompt the model will receive (brand-aware). */
  prompt: string;
  /** Negative prompt — keywords to avoid. */
  negativePrompt?: string;
  /** Output aspect ratio (16:9, 1:1, 4:5, etc.). */
  aspectRatio?: string;
  /** Slot id (e.g. "hero", "section.proof.0") for tracking. */
  slotId: string;
  /** Funnel id — used in the R2 object key. */
  funnelId?: string;
  /** Industry hint — biases stock fallback queries. */
  industry?: string;
  /** Brand palette hex codes — fed to colour-enforcement layer. */
  paletteHex?: string[];
  /** Concept query to use if we fall back to stock (cleaner than the full Flux prompt). */
  stockConceptQuery?: string;
  /** Force a specific provider chain (e.g. free tier → ["stock"]). */
  forceChain?: ImageProviderChain;
  seed?: number;
  abortSignal?: AbortSignal;
}

export interface ImageGenResult {
  modelUsed: ModelId;
  /** Final CDN URL (R2-hosted) if upload succeeded; else provider URL. */
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
  /** Set when sourced from stock — used for footer credit. */
  attribution?: {
    photographer: string;
    photographerUrl?: string;
    sourceUrl: string;
    htmlCredit: string;
  };
  /** True iff successfully uploaded to R2 (else url is the provider's temp URL). */
  hostedOnR2: boolean;
  /** R2 bucket key, when hostedOnR2. */
  r2Key?: string;
}

// ---------------------------------------------------------------------------
// Injectable adapter interfaces (kept here so @funnel/agents stays
// independent of @funnel/integrations).
// ---------------------------------------------------------------------------

export interface ReplicateImageAdapter {
  hasToken(): boolean;
  run(input: {
    model: "flux-1.1-pro" | "ideogram-v2" | "sdxl";
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    seed?: number;
    outputFormat?: "webp" | "jpg" | "png";
    outputQuality?: number;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; model: string; costCents: number; predictionId: string }>;
  classifyNSFW(
    imageUrl: string,
    abortSignal?: AbortSignal,
  ): Promise<{ passed: boolean; nsfwScore: number; classifier: string }>;
}

export interface StockSearchAdapter {
  hasAnyKey(): boolean;
  search(input: {
    query: string;
    industry?: string;
    orientation?: "landscape" | "portrait" | "squarish";
    abortSignal?: AbortSignal;
  }): Promise<{
    url: string;
    thumbUrl: string;
    source: "unsplash" | "pexels";
    license: string;
    attribution: { photographer: string; photographerUrl?: string; sourceUrl: string; htmlCredit: string };
  }>;
  trackDownload(image: { trackDownloadUrl?: string }): Promise<void>;
}

export interface R2UploadAdapter {
  hasCredentials(): boolean;
  uploadFromUrl(input: {
    funnelId: string;
    sourceUrl: string;
    contentType?: string;
    extension?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ cdnUrl: string; key: string }>;
}

export interface ImageClientOptions {
  /** Legacy Replicate SDK instance — used when no `replicateAdapter` injected. */
  replicate?: Replicate;
  /** Preferred: inject the new ReplicateImageClient (handles SDXL + NSFW). */
  replicateAdapter?: ReplicateImageAdapter;
  /** Inject stock client (Unsplash + Pexels). */
  stockAdapter?: StockSearchAdapter;
  /** Inject R2 uploader; if absent, results return provider URLs. */
  r2Adapter?: R2UploadAdapter;
  /** Legacy single-key Unsplash fallback. */
  unsplashAccessKey?: string;
}

// ---------------------------------------------------------------------------
// ImageClient
// ---------------------------------------------------------------------------

export class ImageClient {
  private replicate?: Replicate;
  private replicateAdapter?: ReplicateImageAdapter;
  private stock?: StockSearchAdapter;
  private r2?: R2UploadAdapter;
  private unsplashAccessKey?: string;

  constructor(opts: ImageClientOptions = {}) {
    this.replicateAdapter = opts.replicateAdapter;
    this.stock = opts.stockAdapter;
    this.r2 = opts.r2Adapter;
    this.replicate =
      opts.replicate ??
      (process.env["REPLICATE_API_TOKEN"]
        ? new Replicate({ auth: process.env["REPLICATE_API_TOKEN"] })
        : undefined);
    this.unsplashAccessKey = opts.unsplashAccessKey ?? process.env["UNSPLASH_ACCESS_KEY"];
  }

  /**
   * Try the configured provider chain. AI calls run through an NSFW classifier;
   * a flagged result triggers a single regeneration with a sanitized prompt,
   * then falls back to stock.
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const chain: ImageProviderChain =
      params.forceChain ?? ["flux-1.1-pro", "ideogram-v2", "sdxl", "stock"];
    let lastError: string | undefined;
    let attemptedSafetyRetry = false;
    let currentPrompt = params.prompt;

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i]!;
      try {
        const candidate = await this.runProvider(provider, { ...params, prompt: currentPrompt });
        const safety = await this.classifySafety(candidate.url, currentPrompt, params.abortSignal);

        if (!safety.passed) {
          // First NSFW hit: sanitize prompt + retry the same provider once.
          if (!attemptedSafetyRetry && provider !== "stock") {
            attemptedSafetyRetry = true;
            currentPrompt = sanitizePrompt(currentPrompt);
            i = i - 1; // retry same index
            lastError = `nsfw_flagged:${safety.nsfwScore?.toFixed(2)}`;
            continue;
          }
          // Second NSFW hit: skip this provider and continue down the chain.
          lastError = `nsfw_flagged_again:${safety.nsfwScore?.toFixed(2)}`;
          continue;
        }

        // Approved → upload to R2 if available, return.
        const uploaded = await this.uploadIfPossible(candidate.url, params);
        const finalUrl = uploaded?.cdnUrl ?? candidate.url;

        return {
          modelUsed: candidate.modelId,
          url: finalUrl,
          thumbUrl: candidate.thumbUrl,
          costCents: candidate.costCents,
          safetyChecks: {
            passed: true,
            classifier: safety.classifier,
            flags: [],
            nsfwScore: safety.nsfwScore,
          },
          promptUsed: currentPrompt,
          licenseType: candidate.licenseType,
          attribution: candidate.attribution,
          hostedOnR2: !!uploaded,
          r2Key: uploaded?.key,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
    }

    throw new Error(`image: all providers failed: ${lastError ?? "unknown"}`);
  }

  // -------------------------------------------------------------------------
  // Provider dispatch
  // -------------------------------------------------------------------------

  private async runProvider(
    provider: ImageProviderChain[number],
    params: ImageGenParams,
  ): Promise<{
    url: string;
    thumbUrl?: string;
    modelId: ModelId;
    costCents: number;
    licenseType: ImageGenResult["licenseType"];
    attribution?: ImageGenResult["attribution"];
  }> {
    if (provider === "stock") {
      return this.runStock(params);
    }

    // Try injected adapter first (preferred — handles SDXL + better polling).
    if (this.replicateAdapter && this.replicateAdapter.hasToken()) {
      const result = await this.replicateAdapter.run({
        model: provider,
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio ?? "16:9",
        seed: params.seed,
        outputFormat: "webp",
        outputQuality: 92,
        abortSignal: params.abortSignal,
      });
      const modelId: ModelId = provider;
      return {
        url: result.url,
        modelId,
        costCents: result.costCents,
        licenseType: "generated",
      };
    }

    // Legacy Replicate SDK path (Flux + Ideogram only).
    if (!this.replicate) {
      throw new Error("ImageClient: no Replicate adapter or token configured");
    }
    if (provider === "sdxl") {
      throw new Error("ImageClient: SDXL requires the injected ReplicateImageAdapter");
    }
    const output = (await this.replicate.run(
      provider === "flux-1.1-pro" ? "black-forest-labs/flux-1.1-pro" : "ideogram-ai/ideogram-v2",
      {
        input: {
          prompt: params.prompt,
          aspect_ratio: params.aspectRatio ?? "16:9",
          ...(provider === "flux-1.1-pro" ? { safety_tolerance: 2, output_format: "webp", output_quality: 90 } : {}),
          ...(params.seed ? { seed: params.seed } : {}),
        },
        signal: params.abortSignal,
      } as never,
    )) as string | string[];
    const url = Array.isArray(output) ? output[0] : output;
    if (!url) throw new Error(`${provider} returned empty output`);
    return {
      url,
      modelId: provider,
      costCents: imageCallCents(provider, 1),
      licenseType: "generated",
    };
  }

  private async runStock(params: ImageGenParams): Promise<{
    url: string;
    thumbUrl?: string;
    modelId: ModelId;
    costCents: number;
    licenseType: ImageGenResult["licenseType"];
    attribution?: ImageGenResult["attribution"];
  }> {
    const query = params.stockConceptQuery ?? extractConceptQuery(params.prompt);
    const orientation = aspectToOrientation(params.aspectRatio ?? "16:9");

    if (this.stock && this.stock.hasAnyKey()) {
      const hit = await this.stock.search({
        query,
        industry: params.industry,
        orientation,
        abortSignal: params.abortSignal,
      });
      // Fire-and-forget download tracking (Unsplash API guideline).
      void this.stock.trackDownload(hit as { trackDownloadUrl?: string });
      return {
        url: hit.url,
        thumbUrl: hit.thumbUrl,
        modelId: "unsplash-stock",
        costCents: 0,
        licenseType: hit.source === "unsplash" ? "stock_unsplash" : "stock_pexels",
        attribution: hit.attribution,
      };
    }

    // Legacy single-key Unsplash path (back-compat for tests/dev).
    if (!this.unsplashAccessKey) {
      return {
        url: `https://images.unsplash.com/photo-placeholder?slot=${encodeURIComponent(params.slotId)}`,
        thumbUrl: `https://images.unsplash.com/photo-placeholder-thumb?slot=${encodeURIComponent(params.slotId)}`,
        modelId: "unsplash-stock",
        costCents: 0,
        licenseType: "stock_unsplash",
      };
    }
    const res = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Client-ID ${this.unsplashAccessKey}` },
        signal: params.abortSignal,
      },
    );
    if (!res.ok) throw new Error(`Unsplash error: ${res.status}`);
    const json = (await res.json()) as {
      results?: Array<{
        urls?: { regular?: string; thumb?: string };
        user?: { name: string; links?: { html: string } };
        links?: { html: string };
      }>;
    };
    const first = json.results?.[0];
    if (!first?.urls?.regular) throw new Error("Unsplash returned no results");
    return {
      url: first.urls.regular,
      thumbUrl: first.urls.thumb,
      modelId: "unsplash-stock",
      costCents: 0,
      licenseType: "stock_unsplash",
      attribution: first.user
        ? {
            photographer: first.user.name,
            photographerUrl: first.user.links?.html,
            sourceUrl: first.links?.html ?? "https://unsplash.com",
            htmlCredit: `Photo by ${first.user.name} on Unsplash`,
          }
        : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Safety + upload helpers
  // -------------------------------------------------------------------------

  private async classifySafety(
    url: string,
    prompt: string,
    abortSignal?: AbortSignal,
  ): Promise<{ passed: boolean; nsfwScore?: number; classifier: string }> {
    // Prompt-level pre-screen (cheap heuristic — catches obviously bad inputs).
    const promptFlags = promptRedFlags(prompt);
    if (promptFlags.length > 0) {
      return { passed: false, nsfwScore: 0.99, classifier: `prompt-heuristic:${promptFlags.join(",")}` };
    }
    // Output-level model call (Replicate falcons-ai/nsfw_image_detection).
    if (this.replicateAdapter && this.replicateAdapter.hasToken()) {
      try {
        const out = await this.replicateAdapter.classifyNSFW(url, abortSignal);
        return out;
      } catch {
        return { passed: true, classifier: "nsfw-classifier-skip", nsfwScore: 0 };
      }
    }
    return { passed: true, classifier: "no-classifier-configured", nsfwScore: 0 };
  }

  private async uploadIfPossible(
    sourceUrl: string,
    params: ImageGenParams,
  ): Promise<{ cdnUrl: string; key: string } | undefined> {
    if (!this.r2 || !this.r2.hasCredentials() || !params.funnelId) return undefined;
    try {
      return await this.r2.uploadFromUrl({
        funnelId: params.funnelId,
        sourceUrl,
        extension: "webp",
        contentType: "image/webp",
        abortSignal: params.abortSignal,
      });
    } catch {
      return undefined; // Non-fatal — fall back to provider URL.
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function promptRedFlags(prompt: string): string[] {
  const flags: string[] = [];
  const bad = ["nude", "naked", "explicit", "porn", "sexual", "gore", "weapon brandishing"];
  const p = prompt.toLowerCase();
  for (const word of bad) {
    if (p.includes(word)) flags.push(word);
  }
  return flags;
}

function sanitizePrompt(prompt: string): string {
  // Append explicit SFW constraints; the next generation should comply.
  return `${prompt}, family-friendly, fully clothed, professional editorial photography, SFW`;
}

function aspectToOrientation(ratio: string): "landscape" | "portrait" | "squarish" {
  if (ratio === "1:1") return "squarish";
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return "landscape";
  if (w >= h) return "landscape";
  return "portrait";
}

/** Extract a clean noun-heavy concept query for stock search from a verbose Flux prompt. */
function extractConceptQuery(prompt: string): string {
  // Take the first clause (before the first comma) — that's usually the subject.
  const head = prompt.split(",")[0]!.trim();
  // Strip "photorealistic", "editorial", style adjectives.
  return head
    .replace(/photorealistic|editorial|documentary|cinematic|golden hour|moody|portrait/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
