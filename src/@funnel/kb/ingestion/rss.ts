/**
 * RSS ingester.
 *
 * Polls the top-20 authority blog/feed URLs configured per industry pack.
 * Authority blogs are the lifeblood of fresh ad-angle and proof-type material.
 *
 * Uses `rss-parser` for robust RSS / Atom handling and cheerio to strip
 * HTML from `content:encoded` payloads.
 */
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface RssItemEx {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  "content:encoded"?: string;
}

export function createRssIngester(
  feedsByIndustry: Record<string, string[]>,
): IngestionSource {
  const parser = new Parser<unknown, RssItemEx>({
    timeout: 15_000,
    customFields: { item: ["content:encoded"] },
  });

  return {
    name: "rss",
    async run(ctx) {
      const feeds = feedsByIndustry[ctx.industry] ?? [];
      if (!feeds.length) {
        ctx.log("info", `no rss feeds configured for ${ctx.industry}`);
        return [];
      }

      const items: RawIngestedItem[] = [];
      const since = new Date(ctx.now().getTime() - 7 * 24 * 60 * 60 * 1000);

      for (const url of feeds) {
        if (items.length >= ctx.max_items) break;
        try {
          const feed = await parser.parseURL(url);
          for (const item of feed.items ?? []) {
            const dateStr = item.isoDate ?? item.pubDate;
            const publishedAt = dateStr ? new Date(dateStr) : ctx.now();
            if (Number.isNaN(publishedAt.getTime())) continue;
            if (publishedAt < since) continue;

            const html = item["content:encoded"] ?? item.content ?? "";
            const plain = html
              ? cheerio.load(html).root().text().trim()
              : (item.contentSnippet ?? "").trim();
            if (!plain || plain.length < 80) continue;

            items.push({
              external_id: `rss:${item.guid ?? item.link ?? plain.slice(0, 64)}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: "ad_angles",
              content: [item.title, plain].filter(Boolean).join("\n\n"),
              title: item.title,
              source_url: item.link ?? null,
              source: "rss",
              published_at: publishedAt,
              license: "rss-fair-use",
              raw: { feed: url, feed_title: feed.title },
            });
            if (items.length >= ctx.max_items) break;
          }
        } catch (err) {
          ctx.log("warn", `rss feed=${url} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `rss: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
