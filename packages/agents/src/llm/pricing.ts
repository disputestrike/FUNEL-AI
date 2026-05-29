/**
 * Model pricing table (USD cents per 1M tokens or per unit).
 * Cost-governor reads live rates from pricing.yaml in prod; this is the local
 * fallback used by agents to compute ModelCallRecord.unitRateCents.
 *
 * Update via the weekly pricing.yaml sync. Rates are LIST rates (not negotiated).
 */
import type { ModelId } from "../types.js";

export interface LlmRate {
  /** cents per 1M input tokens (uncached) */
  inputCentsPerMTok: number;
  /** cents per 1M input tokens delivered via prompt cache hit */
  cachedInputCentsPerMTok: number;
  /** cents per 1M input tokens written into prompt cache */
  cacheWriteCentsPerMTok: number;
  /** cents per 1M output tokens */
  outputCentsPerMTok: number;
}

export interface ImageRate {
  /** cents per generated image */
  centsPerImage: number;
}

export interface VideoRate {
  /** cents per second of generated video */
  centsPerSecond: number;
}

export const LLM_RATES: Record<string, LlmRate> = {
  "claude-opus-4-7": {
    inputCentsPerMTok: 1500,
    cachedInputCentsPerMTok: 150,
    cacheWriteCentsPerMTok: 1875,
    outputCentsPerMTok: 7500,
  },
  "claude-sonnet-4-6": {
    inputCentsPerMTok: 300,
    cachedInputCentsPerMTok: 30,
    cacheWriteCentsPerMTok: 375,
    outputCentsPerMTok: 1500,
  },
  "claude-haiku-4-5": {
    inputCentsPerMTok: 100,
    cachedInputCentsPerMTok: 10,
    cacheWriteCentsPerMTok: 125,
    outputCentsPerMTok: 500,
  },
  "gpt-4o": {
    inputCentsPerMTok: 250,
    cachedInputCentsPerMTok: 125,
    cacheWriteCentsPerMTok: 250,
    outputCentsPerMTok: 1000,
  },
  "gpt-4o-mini": {
    inputCentsPerMTok: 15,
    cachedInputCentsPerMTok: 7.5,
    cacheWriteCentsPerMTok: 15,
    outputCentsPerMTok: 60,
  },
};

export const IMAGE_RATES: Record<string, ImageRate> = {
  "flux-1.1-pro": { centsPerImage: 4 }, // $0.04 / img — Replicate list rate
  "ideogram-v2": { centsPerImage: 6 }, // $0.06 / img — Replicate list rate
  sdxl: { centsPerImage: 0.5 }, // ~$0.005 / img — SDXL on Replicate
  "unsplash-stock": { centsPerImage: 0 },
  "pexels-stock": { centsPerImage: 0 },
};

export const VIDEO_RATES: Record<string, VideoRate> = {
  "runway-gen-3": { centsPerSecond: 5 },
  "veo-3": { centsPerSecond: 7 },
  "stock-broll": { centsPerSecond: 0 },
};

export function llmCallCents(
  model: ModelId,
  input: { inputTokens: number; outputTokens: number; cachedInputTokens?: number },
): number {
  const rate = LLM_RATES[model];
  if (!rate) return 0;
  const cached = input.cachedInputTokens ?? 0;
  const fresh = Math.max(0, input.inputTokens - cached);
  const cents =
    (fresh * rate.inputCentsPerMTok) / 1_000_000 +
    (cached * rate.cachedInputCentsPerMTok) / 1_000_000 +
    (input.outputTokens * rate.outputCentsPerMTok) / 1_000_000;
  // round to 4 decimals
  return Math.round(cents * 10_000) / 10_000;
}

export function imageCallCents(model: ModelId, images: number): number {
  return (IMAGE_RATES[model]?.centsPerImage ?? 0) * images;
}

export function videoCallCents(model: ModelId, seconds: number): number {
  return (VIDEO_RATES[model]?.centsPerSecond ?? 0) * seconds;
}
