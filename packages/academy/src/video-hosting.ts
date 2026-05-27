/**
 * Cloudflare Stream integration for the Academy.
 *
 * Responsibilities:
 *   - Upload + transcode (Cloudflare returns HLS automatically)
 *   - Captions in up to 10 launch languages
 *   - Per-user watermarked playback (paid courses only)
 *   - Per-user analytics (% watched, drop-off points)
 *
 * We never store the raw API token here; the caller passes a `StreamClient`.
 * In tests we inject a fake that mirrors the API surface.
 */

import { ulid } from "ulid";
import { z } from "zod";

/** ISO 639-1 codes for the 10 launch languages (Doc 15 country matrix). */
export const SUPPORTED_CAPTION_LANGS = [
  "en", // English
  "es", // Spanish
  "fr", // French
  "de", // German
  "pt", // Portuguese (BR + PT)
  "it", // Italian
  "ja", // Japanese
  "zh", // Chinese (Simplified)
  "ar", // Arabic
  "hi", // Hindi
] as const;
export type CaptionLang = (typeof SUPPORTED_CAPTION_LANGS)[number];

/**
 * Minimum surface we need from Cloudflare Stream. We model only what's used —
 * the real client (e.g. `@cloudflare/stream`) is wrapped behind this interface
 * so we can swap providers (Mux is the contingency per the spec).
 */
export interface StreamClient {
  /** Upload a video by direct URL (Cloudflare pulls). Returns the Stream UID. */
  uploadByUrl(args: {
    url: string;
    name: string;
    watermark_profile_id?: string;
  }): Promise<{ uid: string; status: "queued" | "ready" }>;

  /** Returns metadata once transcoding is done. */
  getVideo(uid: string): Promise<{
    uid: string;
    status: "queued" | "in_progress" | "ready" | "error";
    duration_seconds: number;
    hls_url: string;
    dash_url: string;
    thumbnail_url: string;
  }>;

  /** Attach a caption track. */
  addCaption(
    uid: string,
    lang: CaptionLang,
    captionFileUrl: string,
  ): Promise<{ uid: string; lang: CaptionLang; url: string }>;

  /** Mint a signed playback URL (used for paid + watermarked videos). */
  signedPlaybackUrl(
    uid: string,
    args: {
      user_id: string;
      ttl_seconds: number;
      /** Watermark text rendered on the video — typically "user@email | ts". */
      watermark_text?: string;
    },
  ): Promise<{ url: string; expires_at: string }>;

  /** Pull aggregate playback analytics for a (video, user) pair. */
  userAnalytics(args: { uid: string; user_id: string }): Promise<{
    watched_pct: number;
    last_position_seconds: number;
    dropoff_seconds: number[];
  }>;
}

/* ===== Public API ====================================================== */

const UploadInputSchema = z.object({
  source_url: z.string().url(),
  title: z.string().min(1),
  paid: z.boolean().default(false),
});

export async function uploadLessonVideo(
  args: z.infer<typeof UploadInputSchema>,
  client: StreamClient,
): Promise<{ uid: string; hls_url: string; duration_seconds: number }> {
  const parsed = UploadInputSchema.parse(args);

  const { uid } = await client.uploadByUrl({
    url: parsed.source_url,
    name: parsed.title,
    // Paid courses pull a per-user-watermarked frame at playback time.
    watermark_profile_id: parsed.paid ? "academy-paid-watermark" : undefined,
  });

  // Poll-or-callback is handled by the worker; here we return the queued UID
  // immediately and the caller will hydrate `hls_url` / `duration_seconds`
  // when the `stream.video.ready` webhook fires.
  const meta = await client.getVideo(uid);
  return {
    uid: meta.uid,
    hls_url: meta.hls_url,
    duration_seconds: meta.duration_seconds,
  };
}

/** Attach the launch-language caption pack. Returns the URL map for the lesson body. */
export async function attachCaptionPack(
  uid: string,
  pack: Partial<Record<CaptionLang, string>>,
  client: StreamClient,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [lang, fileUrl] of Object.entries(pack)) {
    if (!fileUrl) continue;
    if (!SUPPORTED_CAPTION_LANGS.includes(lang as CaptionLang)) {
      throw new Error(`Unsupported caption language: ${lang}`);
    }
    const res = await client.addCaption(uid, lang as CaptionLang, fileUrl);
    out[lang] = res.url;
  }
  return out;
}

/**
 * Mint a per-user signed playback URL for a watermarked, paid-course video.
 * `email_for_watermark` is rendered as a faint overlay so a leaked recording
 * carries the user's identity.
 */
export async function getWatermarkedPlaybackUrl(args: {
  stream_uid: string;
  user_id: string;
  email_for_watermark: string;
  client: StreamClient;
  ttl_seconds?: number;
}): Promise<{ url: string; expires_at: string; token: string }> {
  const ttl = args.ttl_seconds ?? 60 * 60 * 4; // 4 hours default
  const tokenSeed = ulid();
  const signed = await args.client.signedPlaybackUrl(args.stream_uid, {
    user_id: args.user_id,
    ttl_seconds: ttl,
    watermark_text: `${args.email_for_watermark} | ${tokenSeed.slice(-8)}`,
  });
  return {
    url: signed.url,
    expires_at: signed.expires_at,
    token: tokenSeed,
  };
}

/**
 * Fetch per-user analytics. Drop-off seconds are timestamps where ≥ 5% of
 * viewers paused/closed — used by the course editor to fix dead spots.
 */
export async function getLessonAnalyticsForUser(args: {
  stream_uid: string;
  user_id: string;
  client: StreamClient;
}): Promise<{ watched_pct: number; last_position_seconds: number; dropoff_seconds: number[] }> {
  return args.client.userAnalytics({
    uid: args.stream_uid,
    user_id: args.user_id,
  });
}
