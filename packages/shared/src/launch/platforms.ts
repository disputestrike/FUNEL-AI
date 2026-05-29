/**
 * GoFunnelAI — Platform metadata.
 *
 * Static (compile-time-known) facts about every ad platform GoFunnelAI
 * supports. Used by:
 *
 *   - The variant generator to bound headline/primary-text/description
 *     length to platform-native limits.
 *   - The export packager to pick the correct CSV column layout.
 *   - The Launch Center cockpit to enable/disable Conversions-API / Lead-Gen
 *     toggles per platform.
 *
 * Character limits reflect each platform's published policies as of 2026 Q1.
 * If a platform doesn't surface a "description" slot, the field is `null`.
 */

import { Platform } from "./types.js";

export interface PlatformCharacterLimits {
  primaryText: number;
  headline: number;
  description: number | null;
}

export interface PlatformMeta {
  name: string;
  adFormats: readonly string[];
  audienceCapabilities: readonly string[];
  requiresVideoFormat: boolean;
  supportsLeadGen: boolean;
  supportsConversionsApi: boolean;
  characterLimits: PlatformCharacterLimits;
}

export const PLATFORM_META: Readonly<Record<Platform, PlatformMeta>> = {
  [Platform.Meta]: {
    name: "Meta (Facebook + Instagram)",
    adFormats: [
      "single_image",
      "single_video",
      "carousel",
      "collection",
      "reels",
      "stories",
      "instant_experience",
    ],
    audienceCapabilities: [
      "detailed_targeting",
      "custom_audience",
      "lookalike",
      "saved_audience",
      "advantage_plus",
      "geo_radius",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: true,
    supportsConversionsApi: true,
    characterLimits: {
      primaryText: 125,
      headline: 40,
      description: 30,
    },
  },

  [Platform.Google]: {
    name: "Google Ads",
    adFormats: [
      "responsive_search",
      "responsive_display",
      "performance_max",
      "discovery",
      "demand_gen",
      "shopping",
    ],
    audienceCapabilities: [
      "in_market",
      "affinity",
      "custom_intent",
      "customer_match",
      "similar_audience",
      "remarketing",
      "geo_radius",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: true,
    supportsConversionsApi: true, // Enhanced Conversions / GA4 server-side
    characterLimits: {
      primaryText: 90, // description line
      headline: 30,
      description: 90,
    },
  },

  [Platform.TikTok]: {
    name: "TikTok Ads",
    adFormats: ["in_feed", "top_view", "spark_ads", "carousel", "collection"],
    audienceCapabilities: [
      "interest",
      "behavior",
      "custom_audience",
      "lookalike",
      "geo_radius",
    ],
    requiresVideoFormat: true,
    supportsLeadGen: true,
    supportsConversionsApi: true, // Events API
    characterLimits: {
      primaryText: 100,
      headline: 40,
      description: null,
    },
  },

  [Platform.YouTube]: {
    name: "YouTube Ads",
    adFormats: ["skippable_in_stream", "non_skippable_in_stream", "bumper", "shorts", "discovery", "masthead"],
    audienceCapabilities: [
      "in_market",
      "affinity",
      "custom_intent",
      "customer_match",
      "remarketing",
    ],
    requiresVideoFormat: true,
    supportsLeadGen: true,
    supportsConversionsApi: true,
    characterLimits: {
      primaryText: 70, // long headline
      headline: 30,
      description: 90,
    },
  },

  [Platform.LinkedIn]: {
    name: "LinkedIn Ads",
    adFormats: [
      "single_image",
      "single_video",
      "carousel",
      "message",
      "conversation",
      "document",
      "event",
    ],
    audienceCapabilities: [
      "job_title",
      "company",
      "industry",
      "seniority",
      "skill",
      "matched_audience",
      "lookalike",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: true,
    supportsConversionsApi: true, // Conversions API for LinkedIn
    characterLimits: {
      primaryText: 150,
      headline: 70,
      description: 100,
    },
  },

  [Platform.X]: {
    name: "X (Twitter) Ads",
    adFormats: ["promoted_post", "video_ads", "carousel", "takeover", "amplify"],
    audienceCapabilities: [
      "follower_lookalike",
      "interest",
      "keyword",
      "tailored_audience",
      "geo_radius",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: false,
    supportsConversionsApi: true, // Conversions API for X
    characterLimits: {
      primaryText: 280,
      headline: 50,
      description: null,
    },
  },

  [Platform.Snapchat]: {
    name: "Snapchat Ads",
    adFormats: ["single_image", "single_video", "story", "collection", "filter", "lens"],
    audienceCapabilities: [
      "interest",
      "behavior",
      "lifestyle",
      "custom_audience",
      "lookalike",
      "geo_radius",
    ],
    requiresVideoFormat: true,
    supportsLeadGen: false,
    supportsConversionsApi: true, // CAPI
    characterLimits: {
      primaryText: 80,
      headline: 34,
      description: null,
    },
  },

  [Platform.Pinterest]: {
    name: "Pinterest Ads",
    adFormats: ["standard_pin", "video_pin", "carousel_pin", "shopping_pin", "idea_pin"],
    audienceCapabilities: [
      "interest",
      "keyword",
      "actalike",
      "customer_list",
      "engagement",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: true,
    supportsConversionsApi: true, // Conversions API
    characterLimits: {
      primaryText: 500,
      headline: 100,
      description: 500,
    },
  },

  [Platform.Reddit]: {
    name: "Reddit Ads",
    adFormats: ["promoted_post", "video", "carousel", "conversation"],
    audienceCapabilities: [
      "subreddit",
      "interest",
      "keyword",
      "custom_audience",
      "geo_radius",
    ],
    requiresVideoFormat: false,
    supportsLeadGen: false,
    supportsConversionsApi: true, // Conversions API for Reddit
    characterLimits: {
      primaryText: 300,
      headline: 300,
      description: null,
    },
  },
} as const;

/**
 * Convenience accessor with a typed return. Throws if the platform is not
 * registered (should never happen for typed callers).
 */
export function getPlatformMeta(platform: Platform): PlatformMeta {
  const meta = PLATFORM_META[platform];
  if (!meta) {
    throw new Error(`Unknown platform: ${String(platform)}`);
  }
  return meta;
}

export const ALL_PLATFORMS: readonly Platform[] = Object.freeze(
  Object.values(Platform) as Platform[],
);
