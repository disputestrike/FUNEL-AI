/**
 * Shared ingestion-source contract.
 *
 * Each ingester (newsapi.ts, rss.ts, youtube.ts, …) implements
 * `IngestionSource` and yields `RawIngestedItem`s. The orchestrator collects
 * items, hands them to the LLM-as-judge filter, embeds approved items, and
 * inserts them into the candidate queue.
 */
import type { KBSection } from "../types.js";

export interface RawIngestedItem {
  /** Stable per-source ID. Used for dedupe — re-running an ingester for the
   *  same news article will produce the same external_id and the
   *  orchestrator will skip the duplicate. */
  external_id: string;
  industry: string;
  geo: string;
  language: string;
  /** Best-guess section. Filter agent may re-classify. */
  section: KBSection;
  content: string;
  title?: string;
  source_url: string | null;
  source:
    | "newsapi"
    | "rss"
    | "youtube"
    | "reddit"
    | "meta_ad_library"
    | "google_ad_transparency"
    | "customer_conversion";
  published_at: Date;
  license: string;
  /** Source-specific raw payload for traceability. */
  raw?: Record<string, unknown>;
}

export interface IngestionContext {
  industry: string;
  geo: string;
  language: string;
  /** Hard cap on items per source per run. */
  max_items: number;
  /** Logger callback (kept simple to avoid pulling in a logger dep). */
  log: (level: "info" | "warn" | "error", msg: string, meta?: object) => void;
  /** Wall-clock now — DI'd for tests. */
  now: () => Date;
  /** Allow ingesters to read API keys from env without coupling to process.env. */
  env: Record<string, string | undefined>;
  /** HTTP fetcher (axios-compatible, DI'd for tests). */
  http: HttpClient;
}

export interface HttpClient {
  get: <T = unknown>(
    url: string,
    opts?: { headers?: Record<string, string>; params?: Record<string, unknown> },
  ) => Promise<{ status: number; data: T }>;
  post: <T = unknown>(
    url: string,
    body: unknown,
    opts?: { headers?: Record<string, string> },
  ) => Promise<{ status: number; data: T }>;
}

export interface IngestionSource {
  /** Stable name used in logs and metrics. */
  name: string;
  /** Pull the latest items for a (industry × geo × language) cell. */
  run(ctx: IngestionContext): Promise<RawIngestedItem[]>;
}

/**
 * Per-industry ingester config — RSS feeds, YouTube channels, etc.
 * Lives alongside the pack templates in `src/packs/<industry>/sources.json`
 * and is loaded by the orchestrator.
 */
export interface IndustrySourceConfig {
  industry: string;
  /** Free-text query terms to send to NewsAPI. */
  newsapi_queries?: string[];
  /** RSS feed URLs to scrape. */
  rss_feeds?: string[];
  /** YouTube channel IDs to pull transcripts from. */
  youtube_channels?: string[];
  /** Subreddits (without the r/). */
  subreddits?: string[];
  /** Meta Ad Library page IDs to monitor. */
  meta_page_ids?: string[];
  /** Google Ad Transparency advertiser IDs to monitor. */
  google_advertiser_ids?: string[];
}
