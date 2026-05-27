/**
 * Candidate queue accessors.
 *
 * `kb_candidate_queue` is a wide table that wraps `kb_chunks` rows in the
 * "candidate" state (chunks.active = FALSE) and records the filter verdict
 * + review state. The admin console reads from here.
 *
 *   CREATE TABLE kb_candidate_queue (
 *     id              TEXT PRIMARY KEY,
 *     chunk_id        TEXT NOT NULL REFERENCES kb_chunks(id) ON DELETE CASCADE,
 *     external_id     TEXT NOT NULL UNIQUE,
 *     industry        TEXT NOT NULL,
 *     geo             TEXT NOT NULL,
 *     language        TEXT NOT NULL,
 *     section         TEXT NOT NULL,
 *     source          TEXT NOT NULL,
 *     filter_verdict  JSONB NOT NULL,
 *     proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     reviewed_at     TIMESTAMPTZ,
 *     reviewer_user_id TEXT,
 *     review_decision TEXT,             -- approved | rejected | edits_required
 *     review_notes    TEXT
 *   );
 */
import type { PrismaClient } from "@prisma/client";
import type { CandidateChunk, KBSection } from "../types.js";

export interface ListCandidatesArgs {
  industry?: string;
  geo?: string;
  language?: string;
  section?: KBSection;
  unreviewed_only?: boolean;
  min_quality?: number;
  limit?: number;
  offset?: number;
}

interface CandidateRow {
  candidate_id: string;
  chunk_id: string;
  external_id: string;
  industry: string;
  geo: string;
  language: string;
  section: string;
  source: CandidateChunk["source"];
  filter_verdict: CandidateChunk["filter_verdict"];
  proposed_at: Date;
  reviewed_at: Date | null;
  reviewer_user_id: string | null;
  review_decision: "approved" | "rejected" | "edits_required" | null;
  review_notes: string | null;
  content: string;
  source_url: string | null;
  license: string;
  quality_score: number;
  ingested_at: Date;
  expires_at: Date | null;
  active: boolean;
}

export async function listCandidates(
  prisma: PrismaClient,
  args: ListCandidatesArgs = {},
): Promise<CandidateChunk[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: string, val: unknown) => {
    params.push(val);
    conds.push(cond.replace("$?", `$${params.length}`));
  };
  if (args.industry) add("q.industry = $?", args.industry);
  if (args.geo) add("q.geo = $?", args.geo);
  if (args.language) add("q.language = $?", args.language);
  if (args.section) add("q.section = $?", args.section);
  if (args.unreviewed_only) conds.push("q.reviewed_at IS NULL");
  if (typeof args.min_quality === "number") {
    add("(q.filter_verdict->>'quality')::float >= $?", args.min_quality);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(args.limit ?? 50, 500);
  const offset = args.offset ?? 0;

  const rows = await prisma.$queryRawUnsafe<CandidateRow[]>(
    `
    SELECT
      q.id AS candidate_id, q.chunk_id, q.external_id, q.industry, q.geo, q.language,
      q.section, q.source, q.filter_verdict, q.proposed_at, q.reviewed_at,
      q.reviewer_user_id, q.review_decision, q.review_notes,
      c.content, c.source_url, c.license, c.quality_score, c.ingested_at,
      c.expires_at, c.active
    FROM kb_candidate_queue q
    JOIN kb_chunks c ON c.id = q.chunk_id
    ${where}
    ORDER BY q.proposed_at DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    ...params,
  );

  return rows.map((r) => ({
    candidate_id: r.candidate_id,
    id: r.chunk_id,
    industry: r.industry,
    geo: r.geo,
    language: r.language,
    section: r.section as KBSection,
    content: r.content,
    source: r.source,
    source_url: r.source_url,
    license: r.license,
    quality_score: Number(r.quality_score),
    active: r.active,
    ingested_at: new Date(r.ingested_at),
    expires_at: r.expires_at ? new Date(r.expires_at) : null,
    filter_verdict: r.filter_verdict,
    proposed_at: new Date(r.proposed_at),
    reviewed_at: r.reviewed_at ? new Date(r.reviewed_at) : undefined,
    reviewer_user_id: r.reviewer_user_id ?? undefined,
    review_decision: r.review_decision ?? undefined,
    review_notes: r.review_notes ?? undefined,
  }));
}

export async function getCandidate(
  prisma: PrismaClient,
  candidateId: string,
): Promise<CandidateChunk | null> {
  const rows = await listCandidates(prisma, {});
  // Fallback narrow query — listCandidates filters in SQL, but for a single
  // id we do a direct fetch:
  void rows;
  const r = await prisma.$queryRawUnsafe<CandidateRow[]>(
    `
    SELECT
      q.id AS candidate_id, q.chunk_id, q.external_id, q.industry, q.geo, q.language,
      q.section, q.source, q.filter_verdict, q.proposed_at, q.reviewed_at,
      q.reviewer_user_id, q.review_decision, q.review_notes,
      c.content, c.source_url, c.license, c.quality_score, c.ingested_at,
      c.expires_at, c.active
    FROM kb_candidate_queue q
    JOIN kb_chunks c ON c.id = q.chunk_id
    WHERE q.id = $1
    LIMIT 1
    `,
    candidateId,
  );
  const row = r[0];
  if (!row) return null;
  return {
    candidate_id: row.candidate_id,
    id: row.chunk_id,
    industry: row.industry,
    geo: row.geo,
    language: row.language,
    section: row.section as KBSection,
    content: row.content,
    source: row.source,
    source_url: row.source_url,
    license: row.license,
    quality_score: Number(row.quality_score),
    active: row.active,
    ingested_at: new Date(row.ingested_at),
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    filter_verdict: row.filter_verdict,
    proposed_at: new Date(row.proposed_at),
    reviewed_at: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewer_user_id: row.reviewer_user_id ?? undefined,
    review_decision: row.review_decision ?? undefined,
    review_notes: row.review_notes ?? undefined,
  };
}

export interface CandidateStats {
  total_pending: number;
  total_approved: number;
  total_rejected: number;
  by_industry: Array<{ industry: string; pending: number }>;
}

export async function getCandidateStats(prisma: PrismaClient): Promise<CandidateStats> {
  const totals = await prisma.$queryRawUnsafe<
    Array<{ review_decision: string | null; n: bigint }>
  >(`
    SELECT review_decision, COUNT(*) AS n
      FROM kb_candidate_queue
     GROUP BY review_decision
  `);
  let pending = 0,
    approved = 0,
    rejected = 0;
  for (const t of totals) {
    const n = Number(t.n);
    if (t.review_decision === null) pending += n;
    else if (t.review_decision === "approved") approved += n;
    else if (t.review_decision === "rejected") rejected += n;
  }
  const byIndustry = await prisma.$queryRawUnsafe<
    Array<{ industry: string; pending: bigint }>
  >(`
    SELECT industry, COUNT(*) AS pending
      FROM kb_candidate_queue
     WHERE reviewed_at IS NULL
     GROUP BY industry
     ORDER BY pending DESC
  `);
  return {
    total_pending: pending,
    total_approved: approved,
    total_rejected: rejected,
    by_industry: byIndustry.map((r) => ({
      industry: r.industry,
      pending: Number(r.pending),
    })),
  };
}
