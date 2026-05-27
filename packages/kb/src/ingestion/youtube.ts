/**
 * YouTube ingester.
 *
 * For each configured channel:
 *   1. List the last N videos via the YouTube Data API v3 `search.list`.
 *   2. For each video, try the captions endpoint; if no captions are
 *      available, fall back to Whisper transcription on the audio.
 *
 * Transcripts feed `ad_angles` and `pain_points` — top creators surface
 * the verbatim phrasings buyers actually use, which is gold for the
 * Hook agent.
 *
 * Note on Whisper fallback: this module does not embed a binary
 * downloader. The orchestrator wires a `transcribeAudio` callback in
 * via `WhisperTranscriber`. In production that lives in
 * `@funnel/integrations` and calls OpenAI's Whisper or a self-hosted
 * `faster-whisper` endpoint. The unit tests pass a stub.
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

interface YouTubeSearchItem {
  id: { videoId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface YouTubeCaptionListResponse {
  items: Array<{
    id: string;
    snippet: { language: string; trackKind: string; name: string };
  }>;
}

export interface WhisperTranscriber {
  /** Returns plain-text transcript for a YouTube video URL. */
  transcribeFromYouTube(url: string): Promise<string>;
}

export function createYoutubeIngester(
  channelsByIndustry: Record<string, string[]>,
  whisper?: WhisperTranscriber,
): IngestionSource {
  return {
    name: "youtube",
    async run(ctx) {
      const apiKey = ctx.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        ctx.log("warn", "YOUTUBE_API_KEY not set; skipping youtube ingester");
        return [];
      }
      const channels = channelsByIndustry[ctx.industry] ?? [];
      if (!channels.length) return [];

      const items: RawIngestedItem[] = [];
      const publishedAfter = new Date(
        ctx.now().getTime() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      for (const channelId of channels) {
        if (items.length >= ctx.max_items) break;
        try {
          const search = await ctx.http.get<YouTubeSearchResponse>(
            "https://www.googleapis.com/youtube/v3/search",
            {
              params: {
                key: apiKey,
                channelId,
                part: "snippet",
                order: "date",
                publishedAfter,
                maxResults: 10,
                type: "video",
              },
            },
          );
          if (search.status !== 200) {
            ctx.log("warn", `youtube search channel=${channelId} status=${search.status}`);
            continue;
          }
          for (const v of search.data.items) {
            const videoId = v.id.videoId;
            if (!videoId) continue;
            if (items.length >= ctx.max_items) break;

            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            let transcript = "";
            try {
              const caps = await ctx.http.get<YouTubeCaptionListResponse>(
                "https://www.googleapis.com/youtube/v3/captions",
                { params: { key: apiKey, part: "snippet", videoId } },
              );
              const hasCaptions = caps.status === 200 && caps.data.items.length > 0;
              if (hasCaptions && whisper) {
                // Captions are gated by oauth; use Whisper unconditionally
                // when we have a transcriber — it's simpler than juggling
                // multiple auth flows. The captions check above is mostly
                // a hint that the video has speech.
                transcript = await whisper.transcribeFromYouTube(videoUrl);
              } else if (whisper) {
                transcript = await whisper.transcribeFromYouTube(videoUrl);
              }
            } catch (err) {
              ctx.log("warn", `youtube transcript failed videoId=${videoId}`, {
                err: String(err),
              });
            }

            const content =
              transcript ||
              [v.snippet.title, v.snippet.description].filter(Boolean).join("\n\n");
            if (!content) continue;

            items.push({
              external_id: `youtube:${videoId}`,
              industry: ctx.industry,
              geo: ctx.geo,
              language: ctx.language,
              section: transcript ? "ad_angles" : "ad_angles",
              content,
              title: v.snippet.title,
              source_url: videoUrl,
              source: "youtube",
              published_at: new Date(v.snippet.publishedAt),
              license: transcript ? "whisper-transcribed" : "youtube-snippet",
              raw: {
                channel_id: v.snippet.channelId,
                channel_title: v.snippet.channelTitle,
                has_transcript: Boolean(transcript),
              },
            });
          }
        } catch (err) {
          ctx.log("error", `youtube channel=${channelId} failed`, { err: String(err) });
        }
      }
      ctx.log("info", `youtube: ${items.length} items for ${ctx.industry}`);
      return items;
    },
  };
}
