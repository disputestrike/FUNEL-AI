/**
 * @funnel/kb — Semantic retrieval over the embedded KB.
 *
 * Called by every generation agent (Hook, Page, Compliance, RevTry, Sequence,
 * Score). Returns top-K chunks ranked by:
 *
 *     final_score = cosine_similarity × recency_weight × quality_score
 *
 * `recency_weight = exp(-age_days * ln(2) / half_life_days)` — half-life of
 * 90 days by default, which means a chunk ingested 90 days ago has its
 * similarity halved. This is the "KBs rot in 90 days" thesis encoded in math.
 *
 * Per-cell × per-section caching reduces hot-path latency: an in-process LRU
 * keyed by `industry|geo|language|section|query_hash` holds top-K for 1 hour.
 * The cache is invalidated by `kb_pack_updated` events (see `freshness.ts`
 * which can call `invalidateCache(industry, geo, language)`).
 */
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  RetrievalQuerySchema,
  type KBChunk,
  type KBSection,
  type RetrievalQuery,
  type RetrievalResult,
} from "./types.js";
import { toPgVectorLiteral } from "./storage.js";

export interface RetrievalDeps {
  prisma: PrismaClient;
  embed: (text: string) => Promise<number[]>;
  /** Optional time source for deterministic tests. */
  now?: () => Date;
}

// ---------------------------------------------------------------------------
// In-process cache.
// ---------------------------------------------------------------------------

interface CacheEntry {
  expires_at: number;
  results: RetrievalResult[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_ENTRIES = 5000;

const _cache = new Map<string, CacheEntry>();

function cacheKey(q: RetrievalQuery): string {
  const sectionsKey = (q.section_filter ?? []).slice().sort().join(",");
  const queryHash = createHash("sha256").update(q.query_text).digest("hex").slice(0, 16);
  return [
    q.industry,
    q.geo,
    q.language,
    sectionsKey || "*",
    q.top_k,
    q.min_quality,
    q.exclude_expired ? 1 : 0,
    q.include_candidates ? 1 : 0,
    q.recency_half_life_days,
    queryHash,
  ].join("|");
}

function cacheGet(key: string, now: number): RetrievalResult[] | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (entry.expires_at <= now) {
    _cache.delete(key);
    return null;
  }
  return entry.results;
}

function cacheSet(key: string, results: RetrievalResult[], now: number): void {
  if (_cache.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest by iteration order (Map preserves insertion order).
    const oldest = _cache.keys().next().value;
    if (oldest) _cache.delete(oldest);
  }
  _cache.set(key, { expires_at: now + CACHE_TTL_MS, results });
}

/**
 * Invalidate every cached entry that touches (industry, geo, language).
 * Called when a pack is re-ingested or a chunk is retired.
 */
export function invalidateCache(
  industry: string,
  geo: string,
  language: string,
): number {
  const prefix = `${industry}|${geo}|${language}|`;
  let dropped = 0;
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) {
      _cache.delete(key);
      dropped += 1;
    }
  }
  return dropped;
}

export function clearCache(): void {
  _cache.clear();
}

// ---------------------------------------------------------------------------
// Scoring math.
// ---------------------------------------------------------------------------

export function computeRecencyWeight(
  ingestedAt: Date,
  now: Date,
  halfLifeDays: number,
): number {
  const ageMs = now.getTime() - ingestedAt.getTime();
  if (ageMs <= 0) return 1;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-(ageDays * Math.LN2) / halfLifeDays);
}

// ---------------------------------------------------------------------------
// Retrieval.
// ---------------------------------------------------------------------------

interface RawChunkRow {
  id: string;
  industry: string;
  geo: string;
  language: string;
  section: string;
  content: string;
  source: KBChunk["source"];
  source_url: string | null;
  license: string;
  quality_score: number;
  active: boolean;
  ingested_at: Date;
  expires_at: Date | null;
  similarity: number;
}

/**
 * Run a semantic retrieval.
 *
 * Returns at most `top_k` results, ranked by `score` descending. If no
 * matching chunks exist (e.g. a brand-new pack that hasn't been ingested
 * yet) returns `[]` — callers must tolerate empty retrievals and the
 * generation engine will route to a fallback prompt.
 */
export async function retrieve(
  deps: RetrievalDeps,
  rawQuery: RetrievalQuery,
): Promise<RetrievalResult[]> {
  const query = RetrievalQuerySchema.parse(rawQuery);
  const now = (deps.now ?? (() => new Date()))();
  const nowMs = now.getTime();

  const key = cacheKey(query);
  const cached = cacheGet(key, nowMs);
  if (cached) return cached;

  const embedding = await deps.embed(query.query_text);
  const literal = toPgVectorLiteral(embedding);

  // Build the candidate query. We pull (top_k * 4) candidates from pgvector
  // ordered by raw cosine distance, then re-rank in-process with
  // recency × quality weighting. Over-fetch ensures we don't lose strong
  // recent items to a marginally-closer-but-ancient one.
  const overfetch = Math.min(200, query.top_k * 4);
  const sectionsClause =
    query.section_filter && query.section_filter.length
      ? `AND section = ANY($5::text[])`
      : `AND $5::text[] IS NULL OR TRUE`; // no-op when no filter; param still consumed

  const expiryClause = query.exclude_expired
    ? `AND (expires_at IS NULL OR expires_at > now())`
    : ``;

  const activeClause = query.include_candidates ? `` : `AND active = TRUE`;

  const sql = `
    SELECT id, industry, geo, language, section, content,
           source, source_url, license, quality_score, active,
           ingested_at, expires_at,
           1 - (embedding <=> $1::vector) AS similarity
      FROM kb_chunks
     WHERE industry = $2
       AND geo = $3
       AND language = $4
       ${query.section_filter && query.section_filter.length ? `AND section = ANY($5::text[])` : ``}
       ${expiryClause}
       ${activeClause}
     ORDER BY embedding <=> $1::vector ASC
     LIMIT ${overfetch}
  `;

  const params: unknown[] = [literal, query.industry, query.geo, query.language];
  if (query.section_filter && query.section_filter.length) {
    params.push(query.section_filter);
  }
  void sectionsClause; // documented above; left for grep-ability.

  const rows = await deps.prisma.$queryRawUnsafe<RawChunkRow[]>(sql, ...params);

  const scored: RetrievalResult[] = rows
    .map((r) => {
      const quality = Number(r.quality_score) || 0;
      if (quality < query.min_quality) return null;

      const similarity = Number(r.similarity);
      const recency = computeRecencyWeight(
        new Date(r.ingested_at),
        now,
        query.recency_half_life_days,
      );
      const score = similarity * recency * Math.max(quality, 0.01);

      const chunk: KBChunk = {
        id: r.id,
        industry: r.industry,
        geo: r.geo,
        language: r.language,
        section: r.section as KBSection,
        content: r.content,
        source: r.source,
        source_url: r.source_url,
        license: r.license,
        quality_score: quality,
        active: r.active,
        ingested_at: new Date(r.ingested_at),
        expires_at: r.expires_at ? new Date(r.expires_at) : null,
      };

      const result: RetrievalResult = {
        chunk,
        similarity,
        recency_weight: recency,
        score,
        provenance: {
          source: chunk.source,
          source_url: chunk.source_url ?? null,
          ingested_at: chunk.ingested_at,
          license: chunk.license,
        },
      };
      return result;
    })
    .filter((x): x is RetrievalResult => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.top_k);

  cacheSet(key, scored, nowMs);
  return scored;
}

/**
 * Convenience wrapper: retrieve only the top-N chunks from a single section.
 * Used by agents that already know which canonical section they want
 * (e.g. the Hook agent calling for `ad_angles`).
 */
export async function retrieveSection(
  deps: RetrievalDeps,
  industry: string,
  geo: string,
  language: string,
  section: KBSection,
  query_text: string,
  top_k = 5,
): Promise<RetrievalResult[]> {
  return retrieve(deps, {
    industry,
    geo,
    language,
    query_text,
    top_k,
    section_filter: [section],
    recency_half_life_days: 90,
    min_quality: 0,
    exclude_expired: true,
    include_candidates: false,
  });
}
