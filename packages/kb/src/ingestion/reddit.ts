/**
 * Reddit ingester.
 *
 * Pulls the top `hot` threads from each configured subreddit, plus their
 * top N comments. Reddit is the single best source of verbatim buyer pain
 * phrases â€” exactly what Sections 2 (personas) and 3 (pain points) need.
 *
 * Uses Reddit's OAuth2 script-flow (client id + secret + username + password).
 * For read-only ingestion we can also use the `application_only` flow.
 *
 * Docs: https://www.reddit.com/dev/api/
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface RedditAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditListing<T> {
  kind: string;
  data: {
    after: string | null;
    children: Array<{ kind: string; data: T }>;
  };
}

interface RedditPost {
  id: string;
  name: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  over_18: boolean;
}

interface RedditComment {
  id: string;
  body: string;
  score: number;
  author: string;
  created_utc: number;
}

let _tokenCache: { token: string; expires_at: number } | null = null;

async function getRedditAccessToken(
  ctx: Parameters<IngestionSource["run"]>[0],
): Promise<string | null> {
  const clientId = ctx.env.REDDIT_CLIENT_ID;
  const clientSecret = ctx.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = ctx.now().getTime();
  if (_tokenCache && _tokenCache.expires_at > now) return _tokenCache.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await ctx.http.post<RedditAuthResponse>(
    "https://www.reddit.com/api/v1/access_token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "gofunnelai.com-kb-ingester/0.1",
      },
    },
  );
  if (resp.status !== 200) return null;
  _tokenCache = {
    token: resp.data.access_token,
    expires_at: now + (resp.data.expires_in - 60) * 1000,
  };
  return _tokenCache.token;
}

export function createRedditIngester(
  subredditsByIndustry: Record<string, string[]>,
): IngestionSource {
  return {
    name: "reddit",
    async run(ctx) {
      const subs = subredditsByIndustry[ctx.industry] ?? [];
      if (!subs.length) return [];

      const token = await getRedditAccessToken(ctx);
      if (!token) {
        ctx.log("warn", "Reddit credentials missing; skipping reddit ingester");
        return [];
      }

      const items: RawIngestedItem[] = [];
      const headers = {
        Authorization: `Bearer ${token}`,
        "User-Agent": "gofunnelai.com-kb-ingester/0.1",
      };

      for (const sub of subs) {
        if (items.length >= ctx.max_items) break;
        try {
          const listing = await ctx.http.get<RedditListing<RedditPost>>(
            `https://oauth.reddit.com/r/${sub}/hot`,
            { headers, params: { limit: 25 } },
          );
          if (listing.status !== 200) {
            ctx.log("warn", `reddit r/${sub} status=${listing.status}`);
            continue;
          }
          for (const child of listing.data.data.children) {
            const post = child.data;
            if (post.over_18) continue;
            if (items.length >= ctx.max_items) break;
            const content = [post.title, post.selftext].filter(Boolean).join("\n\n").trim();
            if (content.length < 40) continue;

            items.push({
              external_id: `reddit:${post.name}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: "pain_points",
              content,
              title: post.title,
              source_url: `https://www.reddit.com${post.permalink}`,
              source: "reddit",
              published_at: new Date(post.created_utc * 1000),
              license: "reddit-fair-use",
              raw: {
                subreddit: post.subreddit,
                score: post.score,
                num_comments: post.num_comments,
              },
            });
          }
        } catch (err) {
          ctx.log("error", `reddit r/${sub} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `reddit: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
