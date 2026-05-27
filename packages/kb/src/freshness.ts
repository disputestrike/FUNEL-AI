/**
 * Freshness monitor.
 *
 * Tracks `last_ingested_at` per (industry × geo × language). Alerts ops when
 * any vertical hasn't received a fresh ingestion in over `stale_threshold_days`
 * (default 7d). A stale vertical means competitors are gaining ground — the
 * generation engine for that vertical is running on old material.
 *
 * This module also exposes `runFreshnessSweep` which produces a report for
 * a Slack / PagerDuty hook to fan out.
 */
import type { PrismaClient } from "@prisma/client";
import type { FreshnessReport } from "./types.js";
import { invalidateCache } from "./retrieval.js";

export interface FreshnessOptions {
  stale_threshold_days?: number;
  now?: () => Date;
}

export async function getFreshness(
  prisma: PrismaClient,
  industry: string,
  geo: string,
  language: string,
  opts: FreshnessOptions = {},
): Promise<FreshnessReport> {
  const now = (opts.now ?? (() => new Date()))();
  const staleDays = opts.stale_threshold_days ?? 7;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      max_ingested: Date | null;
      total: bigint;
      active: bigint;
      retired: bigint;
      candidates: bigint;
    }>
  >(
    `
    SELECT MAX(ingested_at) AS max_ingested,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE active = TRUE)::bigint AS active,
           COUNT(*) FILTER (WHERE active = FALSE AND id IN (
             SELECT chunk_id FROM kb_candidate_queue
              WHERE review_decision = 'rejected'
           ))::bigint AS retired,
           COUNT(*) FILTER (WHERE active = FALSE AND id IN (
             SELECT chunk_id FROM kb_candidate_queue
              WHERE reviewed_at IS NULL
           ))::bigint AS candidates
      FROM kb_chunks
     WHERE industry = $1 AND geo = $2 AND language = $3
    `,
    industry,
    geo,
    language,
  );

  const r = rows[0];
  const lastIngestedAt = r?.max_ingested ? new Date(r.max_ingested) : null;
  const ageMs = lastIngestedAt ? now.getTime() - lastIngestedAt.getTime() : Infinity;
  const ageDays = ageMs === Infinity ? Infinity : ageMs / (1000 * 60 * 60 * 24);

  return {
    industry,
    geo,
    language,
    last_ingested_at: lastIngestedAt,
    age_days: Number.isFinite(ageDays) ? Math.round(ageDays * 100) / 100 : Infinity,
    stale: !lastIngestedAt || ageDays > staleDays,
    chunk_count: Number(r?.total ?? 0),
    active_count: Number(r?.active ?? 0),
    retired_count: Number(r?.retired ?? 0),
    candidate_count: Number(r?.candidates ?? 0),
  };
}

export interface SweepReport {
  total_cells: number;
  stale_cells: FreshnessReport[];
  empty_cells: FreshnessReport[];
  all: FreshnessReport[];
  generated_at: Date;
}

/**
 * Sweep every known (industry, geo, language) cell that has at least one
 * row in `kb_chunks` and return a report.
 */
export async function runFreshnessSweep(
  prisma: PrismaClient,
  opts: FreshnessOptions = {},
): Promise<SweepReport> {
  const cells = await prisma.$queryRawUnsafe<
    Array<{ industry: string; geo: string; language: string }>
  >(`
    SELECT DISTINCT industry, geo, language
      FROM kb_chunks
     ORDER BY industry, geo, language
  `);

  const all: FreshnessReport[] = [];
  for (const c of cells) {
    all.push(await getFreshness(prisma, c.industry, c.geo, c.language, opts));
  }

  return {
    total_cells: all.length,
    stale_cells: all.filter((r) => r.stale && r.last_ingested_at !== null),
    empty_cells: all.filter((r) => r.last_ingested_at === null),
    all,
    generated_at: (opts.now ?? (() => new Date()))(),
  };
}

/**
 * Touch a cell's freshness — call this after a successful ingestion run.
 * It also drops the retrieval cache so the next generation sees the new data.
 */
export function touchCell(industry: string, geo: string, language: string): void {
  invalidateCache(industry, geo, language);
}
