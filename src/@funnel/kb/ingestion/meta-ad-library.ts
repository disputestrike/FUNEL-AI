/**
 * Meta Ad Library ingester.
 *
 * Pulls active ads from the Meta Ad Library for configured page IDs.
 * Tells us what ads are running right now for competitors in a vertical —
 * direct fuel for the `ad_angles` retrieval section.
 *
 * Docs: https://www.facebook.com/ads/library/api
 *
 * Requires:
 *   - META_AD_LIBRARY_TOKEN — long-lived user token with `ads_read`.
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface MetaAdLibraryAd {
  id: string;
  ad_creation_time: string;
  ad_delivery_start_time: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url?: string;
  page_id: string;
  page_name: string;
  publisher_platforms?: string[];
}

interface MetaAdLibraryResponse {
  data: MetaAdLibraryAd[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export function createMetaAdLibraryIngester(
  pageIdsByIndustry: Record<string, string[]>,
): IngestionSource {
  return {
    name: "meta_ad_library",
    async run(ctx) {
      const token = ctx.env.META_AD_LIBRARY_TOKEN;
      if (!token) {
        ctx.log("warn", "META_AD_LIBRARY_TOKEN not set; skipping");
        return [];
      }
      const pageIds = pageIdsByIndustry[ctx.industry] ?? [];
      if (!pageIds.length) return [];

      const items: RawIngestedItem[] = [];
      const country = (ctx.geo.split("-")[0] ?? "US").toUpperCase();

      for (const pageId of pageIds) {
        if (items.length >= ctx.max_items) break;
        try {
          const resp = await ctx.http.get<MetaAdLibraryResponse>(
            "https://graph.facebook.com/v19.0/ads_archive",
            {
              params: {
                access_token: token,
                search_page_ids: pageId,
                ad_active_status: "ACTIVE",
                ad_reached_countries: JSON.stringify([country]),
                ad_type: "ALL",
                fields:
                  "id,ad_creation_time,ad_delivery_start_time,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_creative_link_captions,ad_snapshot_url,page_id,page_name,publisher_platforms",
                limit: 50,
              },
            },
          );
          if (resp.status !== 200) {
            ctx.log("warn", `meta_ad_library page=${pageId} status=${resp.status}`);
            continue;
          }
          for (const ad of resp.data.data) {
            if (items.length >= ctx.max_items) break;
            const content = [
              ...(ad.ad_creative_link_titles ?? []),
              ...(ad.ad_creative_bodies ?? []),
              ...(ad.ad_creative_link_descriptions ?? []),
              ...(ad.ad_creative_link_captions ?? []),
            ]
              .filter(Boolean)
              .join("\n\n")
              .trim();
            if (!content) continue;
            items.push({
              external_id: `meta_ad:${ad.id}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: "ad_angles",
              content,
              title: ad.ad_creative_link_titles?.[0],
              source_url: ad.ad_snapshot_url ?? null,
              source: "meta_ad_library",
              published_at: new Date(ad.ad_delivery_start_time),
              license: "meta-ad-library-public",
              raw: {
                page_id: ad.page_id,
                page_name: ad.page_name,
                platforms: ad.publisher_platforms,
              },
            });
          }
        } catch (err) {
          ctx.log("error", `meta_ad_library page=${pageId} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `meta_ad_library: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
