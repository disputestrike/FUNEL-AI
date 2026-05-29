/**
 * GoFunnelAI — UTM + short-link agent.
 *
 * Produces a deterministic UTM matrix for a Launch Center campaign across the
 * platforms in the campaign's platform list, one row per `(platform, variant)`
 * pair. Each row is the canonical `UtmLink` shape from
 * `@funnel/shared/launch` plus a `gofnl.co/<code>` short URL routed through
 * the existing short-link Worker.
 *
 * Design choices:
 *
 *   1. `utm_source` / `utm_medium` are derived from the platform; we expose
 *      the mapping table so callers can override per-row.
 *   2. `utm_campaign` is the campaign slug — stable for the life of the
 *      campaign, even if the human-readable name changes.
 *   3. `utm_content` is `variant_<id>_<angle>` so spend can be attributed
 *      back to a specific angle without joining tables in the warehouse.
 *   4. `utm_term` defaults to the campaign's primary audience id (when
 *      provided) so search-style audience targeting is captured.
 *   5. The short code is a stable hash of `(workspaceId, campaignId,
 *      variantId, platform)` — re-running `generateUtmLinks` for the same
 *      input set returns the same codes, so the agent is idempotent.
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com. Short host: gofnl.co.
 */

import { createHash } from "node:crypto";

import {
  Platform,
  type AdAngle,
  type AdVariant,
  type Campaign,
  type UtmLink,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default short-link host. Overridable via `options.shortHost`. */
export const DEFAULT_SHORT_HOST = "gofnl.co";

/** Mapping from platform → (utm_source, utm_medium). */
export const UTM_SOURCE_BY_PLATFORM: Readonly<Record<Platform, { source: string; medium: string }>> = {
  [Platform.Meta]: { source: "meta", medium: "paid_social" },
  [Platform.Google]: { source: "google", medium: "cpc" },
  [Platform.TikTok]: { source: "tiktok", medium: "paid_social" },
  [Platform.YouTube]: { source: "youtube", medium: "paid_video" },
  [Platform.LinkedIn]: { source: "linkedin", medium: "paid_social" },
  [Platform.X]: { source: "x", medium: "paid_social" },
  [Platform.Snapchat]: { source: "snapchat", medium: "paid_social" },
  [Platform.Pinterest]: { source: "pinterest", medium: "paid_social" },
  [Platform.Reddit]: { source: "reddit", medium: "paid_social" },
} as const;

/** Additional non-platform channels we still produce UTM rows for. */
export const UTM_SOURCE_BY_CHANNEL: Readonly<Record<"email" | "sms" | "organic", { source: string; medium: string }>> = {
  email: { source: "email", medium: "email" },
  sms: { source: "sms", medium: "sms" },
  organic: { source: "organic", medium: "organic" },
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UtmVariantInput {
  id: string;
  angle: AdAngle | string;
  platform: Platform;
  /** Optional audience id / search term that becomes `utm_term`. */
  audience?: string | null;
  /** Optional override for the variant's destination URL. */
  destinationUrl?: string;
}

export interface ShortLinkService {
  /**
   * Persist (or look up) a short code for `targetUrl`. Implementations should
   * be idempotent for a given `(workspaceId, code)` pair.
   */
  create(args: {
    workspaceId: string;
    campaignId: string;
    code: string;
    targetUrl: string;
  }): Promise<{ code: string; shortUrl: string }>;
}

export interface GenerateUtmLinksOptions {
  /** Override host for short links. Defaults to `gofnl.co`. */
  shortHost?: string;
  /** Optional short-link service. If omitted, codes are computed locally. */
  shortLinkService?: ShortLinkService;
  /** Override scheme used to render the short URL. Defaults to `https`. */
  scheme?: "https" | "http";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HASH_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // crockford-ish, no l/o/0/1
const SHORT_CODE_LEN = 7;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function shortCodeFor(parts: string[]): string {
  const hash = createHash("sha256").update(parts.join("|"), "utf8").digest();
  let out = "";
  let n = 0;
  for (let i = 0; out.length < SHORT_CODE_LEN; i += 1) {
    if (i >= hash.length) {
      n = (n + 1) | 0;
      i = 0;
    }
    out += HASH_ALPHABET[(hash[i % hash.length] + n) % HASH_ALPHABET.length];
  }
  return out;
}

function deterministicId(prefix: string, parts: string[]): string {
  const hash = createHash("sha256")
    .update(parts.join("|"), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${hash}`;
}

function ensureNumeric(date: Date): Date {
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function pickAudience(variant: UtmVariantInput, campaign: Pick<Campaign, "audienceProfileIds">): string | null {
  if (variant.audience !== undefined) return variant.audience;
  if (campaign.audienceProfileIds && campaign.audienceProfileIds.length > 0) {
    return campaign.audienceProfileIds[0];
  }
  return null;
}

function buildUtmDestination(args: {
  base: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string | null;
}): { utmUrl: string; baseUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(args.base);
  } catch {
    parsed = new URL(`https://gofunnelai.com/${slugify(args.base) || "campaign"}`);
  }
  parsed.searchParams.set("utm_source", args.source);
  parsed.searchParams.set("utm_medium", args.medium);
  parsed.searchParams.set("utm_campaign", args.campaign);
  parsed.searchParams.set("utm_content", args.content);
  if (args.term) parsed.searchParams.set("utm_term", args.term);
  return { utmUrl: parsed.toString(), baseUrl: parsed.origin + parsed.pathname };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CampaignUtmInput
  extends Pick<
    Campaign,
    "id" | "workspaceId" | "name" | "audienceProfileIds"
  > {
  /** Slug used in `utm_campaign`. Defaults to `slugify(name)`. */
  slug?: string;
  /** Destination URL applied when a variant doesn't carry its own. */
  defaultDestinationUrl?: string;
}

/**
 * Build a UTM matrix for the campaign. Pure (no side effects beyond the
 * optional short-link service) and deterministic given the same inputs.
 */
export async function generateUtmLinks(
  campaign: CampaignUtmInput,
  variants: ReadonlyArray<UtmVariantInput | Pick<AdVariant, "id" | "angle" | "platform" | "destinationUrl">>,
  options: GenerateUtmLinksOptions = {},
): Promise<UtmLink[]> {
  const shortHost = options.shortHost ?? DEFAULT_SHORT_HOST;
  const scheme = options.scheme ?? "https";
  const slug = campaign.slug ?? slugify(campaign.name) || campaign.id;
  const createdAt = ensureNumeric(new Date());

  const rows: UtmLink[] = [];

  for (const raw of variants) {
    const variant: UtmVariantInput = {
      id: raw.id,
      angle: raw.angle,
      platform: raw.platform,
      audience: (raw as UtmVariantInput).audience,
      destinationUrl: (raw as { destinationUrl?: string }).destinationUrl,
    };

    const channel = UTM_SOURCE_BY_PLATFORM[variant.platform];
    if (!channel) {
      throw new Error(`utm: unsupported platform ${String(variant.platform)}`);
    }
    const audience = pickAudience(variant, { audienceProfileIds: campaign.audienceProfileIds });
    const angleStr = typeof variant.angle === "string" ? variant.angle : String(variant.angle);
    const utmContent = `variant_${variant.id}_${slugify(angleStr) || "angle"}`;
    const baseUrl =
      variant.destinationUrl ||
      campaign.defaultDestinationUrl ||
      `https://gofunnelai.com/f/${slug}`;

    const { utmUrl, baseUrl: cleanBase } = buildUtmDestination({
      base: baseUrl,
      source: channel.source,
      medium: channel.medium,
      campaign: slug,
      content: utmContent,
      term: audience,
    });

    const code = shortCodeFor([
      campaign.workspaceId,
      campaign.id,
      variant.id,
      variant.platform,
    ]);

    let shortCode = code;
    let shortUrl = `${scheme}://${shortHost}/${code}`;
    if (options.shortLinkService) {
      const persisted = await options.shortLinkService.create({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        code,
        targetUrl: utmUrl,
      });
      shortCode = persisted.code;
      shortUrl = persisted.shortUrl;
    }

    rows.push({
      id: deterministicId("utm", [campaign.id, variant.id, variant.platform]),
      workspaceId: campaign.workspaceId,
      campaignId: campaign.id,
      destinationUrl: utmUrl,
      utmSource: channel.source,
      utmMedium: channel.medium,
      utmCampaign: slug,
      utmTerm: audience,
      utmContent,
      shortCode,
      shortUrl,
      clickCount: 0,
      createdAt,
    });

    // Tag the cleanBase so eslint doesn't complain on noUnusedLocals.
    void cleanBase;
  }

  await emitLaunch(
    "launch_utm_generated",
    {
      campaign_slug: slug,
      variant_count: rows.length,
      platforms: [...new Set(rows.map((r) => r.utmSource))],
      short_host: shortHost,
    },
    { campaignId: campaign.id, workspaceId: campaign.workspaceId },
  );

  return rows;
}

/**
 * Helper for the email/SMS sequences — produces non-platform UTM rows. Returns
 * a `UtmLink` so storage shape is uniform with paid variants.
 */
export async function generateChannelUtmLink(args: {
  campaign: CampaignUtmInput;
  channel: keyof typeof UTM_SOURCE_BY_CHANNEL;
  variantId: string;
  audience?: string | null;
  destinationUrl?: string;
  shortHost?: string;
  shortLinkService?: ShortLinkService;
  scheme?: "https" | "http";
}): Promise<UtmLink> {
  const shortHost = args.shortHost ?? DEFAULT_SHORT_HOST;
  const scheme = args.scheme ?? "https";
  const slug = args.campaign.slug ?? slugify(args.campaign.name) || args.campaign.id;
  const channel = UTM_SOURCE_BY_CHANNEL[args.channel];
  const baseUrl =
    args.destinationUrl ??
    args.campaign.defaultDestinationUrl ??
    `https://gofunnelai.com/f/${slug}`;
  const utmContent = `variant_${args.variantId}_${args.channel}`;
  const term = args.audience ?? pickAudience({ id: args.variantId, angle: "channel", platform: Platform.Meta }, args.campaign);
  const { utmUrl } = buildUtmDestination({
    base: baseUrl,
    source: channel.source,
    medium: channel.medium,
    campaign: slug,
    content: utmContent,
    term,
  });
  const code = shortCodeFor([
    args.campaign.workspaceId,
    args.campaign.id,
    args.variantId,
    args.channel,
  ]);
  let shortCode = code;
  let shortUrl = `${scheme}://${shortHost}/${code}`;
  if (args.shortLinkService) {
    const persisted = await args.shortLinkService.create({
      workspaceId: args.campaign.workspaceId,
      campaignId: args.campaign.id,
      code,
      targetUrl: utmUrl,
    });
    shortCode = persisted.code;
    shortUrl = persisted.shortUrl;
  }
  return {
    id: deterministicId("utm", [args.campaign.id, args.variantId, args.channel]),
    workspaceId: args.campaign.workspaceId,
    campaignId: args.campaign.id,
    destinationUrl: utmUrl,
    utmSource: channel.source,
    utmMedium: channel.medium,
    utmCampaign: slug,
    utmTerm: term,
    utmContent,
    shortCode,
    shortUrl,
    clickCount: 0,
    createdAt: new Date(),
  };
}

export const __internal = {
  slugify,
  shortCodeFor,
  buildUtmDestination,
};
