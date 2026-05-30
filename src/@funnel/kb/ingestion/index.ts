/**
 * Nightly ingestion orchestrator.
 *
 * Driven by a cron job (`pnpm --filter @funnel/kb ingest:nightly`) that fans
 * out across (industry × geo × language) cells. For each cell we:
 *
 *   1. Run every configured ingester source (NewsAPI, RSS, YouTube,
 *      Reddit, Meta Ad Library, Google Ad Transparency, Customer Conversion).
 *   2. Dedupe by `external_id` against the candidate queue.
 *   3. Run the LLM-as-judge filter (Haiku 4.5).
 *   4. Embed approved items via OpenAI text-embedding-3-large.
 *   5. Insert as candidates (active=FALSE) into kb_chunks + kb_candidate_queue.
 *
 * Domain experts approve from the admin UI; the retire pass runs quarterly.
 *
 * Concurrency: per-cell sequential, cross-cell up to `CELL_CONCURRENCY`.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { PrismaClient } from "@prisma/client";
import axios from "axios";

import type {
  HttpClient,
  IngestionContext,
  IngestionSource,
  IndustrySourceConfig,
  RawIngestedItem,
} from "./types.js";
import { createNewsApiIngester } from "./newsapi.js";
import { createRssIngester } from "./rss.js";
import { createYoutubeIngester, type WhisperTranscriber } from "./youtube.js";
import { createRedditIngester } from "./reddit.js";
import { createMetaAdLibraryIngester } from "./meta-ad-library.js";
import { createGoogleAdTransparencyIngester } from "./google-ad-transparency.js";
import {
  createCustomerConversionIngester,
  type ConversionSignalsReader,
} from "./customer-conversion.js";
import { judgeBatch, type FilterDeps } from "../pipeline/filter.js";
import { createOpenAiEmbedder, embedAndInsertCandidates } from "../pipeline/embed.js";

export interface IngestionCell {
  industry: string;
  geo: string;
  language: string;
}

export interface IngestionOptions {
  cells: IngestionCell[];
  configs: IndustrySourceConfig[];
  prisma: PrismaClient;
  anthropic: Anthropic;
  openai: OpenAI;
  conversionReader?: ConversionSignalsReader;
  whisper?: WhisperTranscriber;
  http?: HttpClient;
  env?: Record<string, string | undefined>;
  maxItemsPerSource?: number;
  cellConcurrency?: number;
  judgeConcurrency?: number;
  log?: IngestionContext["log"];
  now?: () => Date;
}

export interface IngestionRunReport {
  cells: number;
  raw_collected: number;
  approved: number;
  inserted: number;
  per_source: Record<string, number>;
  duration_ms: number;
  errors: string[];
}

const DEFAULT_HTTP: HttpClient = {
  async get(url, opts) {
    const r = await axios.get(url, opts);
    return { status: r.status, data: r.data };
  },
  async post(url, body, opts) {
    const r = await axios.post(url, body, opts);
    return { status: r.status, data: r.data };
  },
};

const DEFAULT_LOG: IngestionContext["log"] = (level, msg, meta) => {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta ?? {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

function buildSources(opts: IngestionOptions): IngestionSource[] {
  const cfgByIndustry = Object.fromEntries(opts.configs.map((c) => [c.industry, c]));
  const newsapi = Object.fromEntries(
    opts.configs.map((c) => [c.industry, c.newsapi_queries ?? []]),
  );
  const rss = Object.fromEntries(opts.configs.map((c) => [c.industry, c.rss_feeds ?? []]));
  const yt = Object.fromEntries(
    opts.configs.map((c) => [c.industry, c.youtube_channels ?? []]),
  );
  const subs = Object.fromEntries(
    opts.configs.map((c) => [c.industry, c.subreddits ?? []]),
  );
  const metaPages = Object.fromEntries(
    opts.configs.map((c) => [c.industry, c.meta_page_ids ?? []]),
  );
  const gads = Object.fromEntries(
    opts.configs.map((c) => [c.industry, c.google_advertiser_ids ?? []]),
  );
  void cfgByIndustry;

  const sources: IngestionSource[] = [
    createNewsApiIngester(newsapi),
    createRssIngester(rss),
    createYoutubeIngester(yt, opts.whisper),
    createRedditIngester(subs),
    createMetaAdLibraryIngester(metaPages),
    createGoogleAdTransparencyIngester(gads),
  ];
  if (opts.conversionReader) {
    sources.push(createCustomerConversionIngester(opts.conversionReader));
  }
  return sources;
}

async function runForCell(
  cell: IngestionCell,
  sources: IngestionSource[],
  opts: IngestionOptions,
  report: IngestionRunReport,
): Promise<void> {
  const http = opts.http ?? DEFAULT_HTTP;
  const env = opts.env ?? (typeof process !== "undefined" ? process.env : {});
  const log = opts.log ?? DEFAULT_LOG;
  const now = opts.now ?? (() => new Date());
  const maxItems = opts.maxItemsPerSource ?? 100;

  const ctx: IngestionContext = {
    industry: cell.industry,
    geo: cell.geo,
    language: cell.language,
    max_items: maxItems,
    log,
    now,
    env,
    http,
  };

  const collected: RawIngestedItem[] = [];
  for (const src of sources) {
    try {
      const items = await src.run(ctx);
      report.per_source[src.name] = (report.per_source[src.name] ?? 0) + items.length;
      collected.push(...items);
    } catch (err) {
      const msg = `${cell.industry}:${src.name} failed: ${String(err).slice(0, 200)}`;
      report.errors.push(msg);
      log("error", msg);
    }
  }
  report.raw_collected += collected.length;
  if (!collected.length) return;

  // Dedupe in-memory by external_id.
  const seen = new Set<string>();
  const deduped = collected.filter((i) => {
    if (seen.has(i.external_id)) return false;
    seen.add(i.external_id);
    return true;
  });

  // LLM-as-judge filter.
  const filterDeps: FilterDeps = {
    anthropic: opts.anthropic,
    concurrency: opts.judgeConcurrency ?? 8,
  };
  const verdicts = await judgeBatch(filterDeps, deduped);
  const approved = verdicts.filter((v) => v.verdict.keep);
  report.approved += approved.length;
  if (!approved.length) return;

  // Embed + insert as candidates.
  const embedder = createOpenAiEmbedder(opts.openai);
  const ids = await embedAndInsertCandidates(opts.prisma, embedder, approved);
  report.inserted += ids.length;
}

/**
 * Top-level entry point for the nightly cron.
 */
export async function runIngestionCycle(
  opts: IngestionOptions,
): Promise<IngestionRunReport> {
  const start = Date.now();
  const sources = buildSources(opts);
  const report: IngestionRunReport = {
    cells: opts.cells.length,
    raw_collected: 0,
    approved: 0,
    inserted: 0,
    per_source: {},
    duration_ms: 0,
    errors: [],
  };

  const concurrency = Math.max(1, Math.min(opts.cellConcurrency ?? 4, 16));
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= opts.cells.length) return;
      const cell = opts.cells[i];
      if (!cell) return;
      try {
        await runForCell(cell, sources, opts, report);
      } catch (err) {
        report.errors.push(`cell ${cell.industry}/${cell.geo}/${cell.language}: ${err}`);
      }
    }
  });
  await Promise.all(workers);

  report.duration_ms = Date.now() - start;
  return report;
}

// Re-exports for callers who want to wire bespoke pipelines.
export type {
  IngestionSource,
  RawIngestedItem,
  IngestionContext,
  IndustrySourceConfig,
  HttpClient,
} from "./types.js";
export { createNewsApiIngester } from "./newsapi.js";
export { createRssIngester } from "./rss.js";
export { createYoutubeIngester } from "./youtube.js";
export { createRedditIngester } from "./reddit.js";
export { createMetaAdLibraryIngester } from "./meta-ad-library.js";
export { createGoogleAdTransparencyIngester } from "./google-ad-transparency.js";
export { createCustomerConversionIngester } from "./customer-conversion.js";
export type { ConversionSignalsReader, ConversionSignal } from "./customer-conversion.js";
export type { WhisperTranscriber } from "./youtube.js";
