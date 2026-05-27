/**
 * NewsAPI.org ingester.
 *
 * Pulls the last 24 h of news per industry's configured query terms.
 * Each article becomes a raw item targeted at the `urgency_triggers`
 * section (news drives urgency framings) — the LLM-as-judge filter may
 * reroute to another section.
 *
 * Docs: https://newsapi.org/docs/endpoints/everything
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: "ok" | "error";
  totalResults: number;
  articles: NewsApiArticle[];
  message?: string;
}

export function createNewsApiIngester(
  queriesByIndustry: Record<string, string[]>,
): IngestionSource {
  return {
    name: "newsapi",
    async run(ctx) {
      const apiKey = ctx.env.NEWSAPI_KEY;
      if (!apiKey) {
        ctx.log("warn", "NEWSAPI_KEY not set; skipping newsapi ingester");
        return [];
      }
      const queries = queriesByIndustry[ctx.industry] ?? [];
      if (!queries.length) {
        ctx.log("info", `no newsapi queries configured for ${ctx.industry}`);
        return [];
      }

      const items: RawIngestedItem[] = [];
      const since = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);

      for (const q of queries) {
        if (items.length >= ctx.max_items) break;
        try {
          const { status, data } = await ctx.http.get<NewsApiResponse>(
            "https://newsapi.org/v2/everything",
            {
              headers: { "X-Api-Key": apiKey },
              params: {
                q,
                language: ctx.language.split("-")[0] ?? "en",
                from: since.toISOString(),
                sortBy: "publishedAt",
                pageSize: Math.min(50, ctx.max_items - items.length),
              },
            },
          );
          if (status !== 200 || data.status !== "ok") {
            ctx.log("warn", `newsapi q=${q} status=${status} ${data.message ?? ""}`);
            continue;
          }
          for (const a of data.articles) {
            const content = [a.title, a.description, a.content]
              .filter(Boolean)
              .join("\n\n")
              .trim();
            if (!content) continue;
            items.push({
              external_id: `newsapi:${a.url}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: "urgency_triggers",
              content,
              title: a.title,
              source_url: a.url,
              source: "newsapi",
              published_at: new Date(a.publishedAt),
              license: "newsapi-fair-use",
              raw: { source_name: a.source.name, author: a.author },
            });
            if (items.length >= ctx.max_items) break;
          }
        } catch (err) {
          ctx.log("error", `newsapi q=${q} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `newsapi: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
