/**
 * Google Ad Transparency Center ingester.
 *
 * Counterpart to the Meta Ad Library — Google publishes the same data
 * (creative text, advertiser, region, last-shown date) via the Ad
 * Transparency Center. There is no fully-public REST API; we use the
 * undocumented internal endpoint which returns JSON, the same way the
 * web UI consumes it.
 *
 *   POST https://adstransparency.google.com/anji/_/rpc/SearchService/SearchCreatives
 *   Headers: x-same-domain: 1, content-type: application/x-www-form-urlencoded
 *
 * Set `GOOGLE_AD_TRANSPARENCY_TOKEN` if you have an authorized proxy; otherwise
 * the ingester degrades gracefully and emits no items.
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface GoogleAdTransparencyCreative {
  advertiser_id: string;
  advertiser_name: string;
  creative_id: string;
  format: string;
  text_content?: string;
  destination_url?: string;
  first_shown?: string;
  last_shown?: string;
  region_codes?: string[];
}

interface GoogleAdTransparencyResponse {
  creatives: GoogleAdTransparencyCreative[];
  next_page_token?: string;
}

export function createGoogleAdTransparencyIngester(
  advertiserIdsByIndustry: Record<string, string[]>,
): IngestionSource {
  return {
    name: "google_ad_transparency",
    async run(ctx) {
      const token = ctx.env.GOOGLE_AD_TRANSPARENCY_TOKEN;
      if (!token) {
        ctx.log("warn", "GOOGLE_AD_TRANSPARENCY_TOKEN not set; skipping");
        return [];
      }
      const advertiserIds = advertiserIdsByIndustry[ctx.industry] ?? [];
      if (!advertiserIds.length) return [];

      const items: RawIngestedItem[] = [];
      const region = (ctx.geo.split("-")[0] ?? "US").toUpperCase();

      for (const advertiserId of advertiserIds) {
        if (items.length >= ctx.max_items) break;
        try {
          const resp = await ctx.http.post<GoogleAdTransparencyResponse>(
            "https://adstransparency.googleapis.com/v1/creatives:search",
            {
              advertiser_id: advertiserId,
              region_code: region,
              page_size: 50,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );
          if (resp.status !== 200) {
            ctx.log("warn", `gat advertiser=${advertiserId} status=${resp.status}`);
            continue;
          }
          for (const c of resp.data.creatives ?? []) {
            if (items.length >= ctx.max_items) break;
            const content = c.text_content?.trim();
            if (!content) continue;
            const published = c.first_shown ? new Date(c.first_shown) : ctx.now();
            items.push({
              external_id: `gat:${c.creative_id}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: "ad_angles",
              content,
              title: undefined,
              source_url: c.destination_url ?? null,
              source: "google_ad_transparency",
              published_at: published,
              license: "google-ad-transparency-public",
              raw: {
                advertiser_id: c.advertiser_id,
                advertiser_name: c.advertiser_name,
                format: c.format,
                last_shown: c.last_shown,
              },
            });
          }
        } catch (err) {
          ctx.log("error", `gat advertiser=${advertiserId} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `google_ad_transparency: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
