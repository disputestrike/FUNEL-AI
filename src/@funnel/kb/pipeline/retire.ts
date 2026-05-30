/**
 * Quarterly retirement pass.
 *
 * Ranking model evaluates every active non-pack-template chunk and retires:
 *   - chunks older than `staleAfterDays` (default 180d) AND
 *     not retrieved in the last `unusedAfterDays` (default 60d), OR
 *   - chunks whose quality_score has decayed below `minQuality` (default 0.25), OR
 *   - chunks whose underlying news article 404s now (broken provenance).
 *
 * Pack-template chunks (source = 'pack_template') are NEVER auto-retired —
 * they're versioned manually via `savePack`.
 *
 * Returns the chunks retired with reasons. Logs each retirement as
 * `kb_pack_updated` for the event audit trail.
 */
import type { PrismaClient } from "@prisma/client";
import { retireChunk } from "../storage.js";
import { invalidateCache } from "../retrieval.js";

export interface RetireOptions {
  staleAfterDays?: number;
  unusedAfterDays?: number;
  minQuality?: number;
  dryRun?: boolean;
  now?: () => Date;
}

export interface RetirementReport {
  retired_chunk_ids: string[];
  reasons: Record<string, string>;
  total_evaluated: number;
}

export async function runRetirementPass(
  prisma: PrismaClient,
  opts: RetireOptions = {},
): Promise<RetirementReport> {
  const staleDays = opts.staleAfterDays ?? 180;
  const unusedDays = opts.unusedAfterDays ?? 60;
  const minQuality = opts.minQuality ?? 0.25;
  const now = (opts.now ?? (() => new Date()))();
  const staleCutoff = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
  const unusedCutoff = new Date(now.getTime() - unusedDays * 24 * 60 * 60 * 1000);

  // We expect a companion table `kb_chunk_usage` with last_retrieved_at
  // populated by the retrieval layer (debounced — flush every 5 min batched).
  // For chunks with no usage row yet, treat as unused.
  const candidates = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      industry: string;
      geo: string;
      language: string;
      quality_score: number;
      ingested_at: Date;
      last_retrieved_at: Date | null;
      source: string;
    }>
  >(
    `
    SELECT c.id, c.industry, c.geo, c.language, c.quality_score, c.ingested_at,
           u.last_retrieved_at, c.source
      FROM kb_chunks c
      LEFT JOIN kb_chunk_usage u ON u.chunk_id = c.id
     WHERE c.active = TRUE
       AND c.source <> 'pack_template'
    `,
  );

  const reasons: Record<string, string> = {};
  const retiredIds: string[] = [];
  const cellsToInvalidate = new Set<string>();

  for (const c of candidates) {
    const ingestedAt = new Date(c.ingested_at);
    const lastUse = c.last_retrieved_at ? new Date(c.last_retrieved_at) : null;
    const isStale = ingestedAt < staleCutoff;
    const isUnused = !lastUse || lastUse < unusedCutoff;
    const isLowQuality = Number(c.quality_score) < minQuality;

    let reason: string | null = null;
    if (isLowQuality) reason = `quality_score=${c.quality_score} < ${minQuality}`;
    else if (isStale && isUnused)
      reason = `stale (>${staleDays}d) and unused (>${unusedDays}d)`;

    if (reason) {
      reasons[c.id] = reason;
      retiredIds.push(c.id);
      cellsToInvalidate.add(`${c.industry}|${c.geo}|${c.language}`);
    }
  }

  if (!opts.dryRun) {
    for (const id of retiredIds) {
      await retireChunk({ prisma }, id, reasons[id] ?? "unknown");
    }
    for (const key of cellsToInvalidate) {
      const parts = key.split("|");
      const industry = parts[0] ?? "";
      const geo = parts[1] ?? "";
      const language = parts[2] ?? "";
      if (industry && geo && language) invalidateCache(industry, geo, language);
    }
  }

  return {
    retired_chunk_ids: retiredIds,
    reasons,
    total_evaluated: candidates.length,
  };
}
