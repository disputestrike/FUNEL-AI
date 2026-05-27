/**
 * Domain-expert review hooks.
 *
 * Powers the weekly /admin/kb review UI. The admin app:
 *   1. Lists pending candidates with `listCandidates({ unreviewed_only: true })`.
 *   2. Calls `approveCandidate` / `rejectCandidate` / `requestEdits`.
 *
 * Approving flips the underlying `kb_chunks.active` to TRUE and invalidates
 * the retrieval cache for that (industry, geo, language) cell so the new
 * material shows up immediately in agent retrievals.
 */
import type { PrismaClient } from "@prisma/client";
import { activateChunk, retireChunk } from "../storage.js";
import { invalidateCache } from "../retrieval.js";
import { listCandidates, type ListCandidatesArgs } from "./candidate-queue.js";
import type { CandidateChunk } from "../types.js";

export interface ReviewDeps {
  prisma: PrismaClient;
}

export interface ReviewAction {
  candidate_id: string;
  reviewer_user_id: string;
  notes?: string;
}

async function loadCandidate(
  prisma: PrismaClient,
  candidate_id: string,
): Promise<CandidateChunk | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      industry: string;
      geo: string;
      language: string;
      chunk_id: string;
    }>
  >(
    `SELECT industry, geo, language, chunk_id
       FROM kb_candidate_queue
      WHERE id = $1
      LIMIT 1`,
    candidate_id,
  );
  if (!rows.length) return null;
  const cell = rows[0];
  if (!cell) return null;
  const list = await listCandidates(prisma, {
    industry: cell.industry,
    geo: cell.geo,
    language: cell.language,
    limit: 500,
  });
  return list.find((c) => c.candidate_id === candidate_id) ?? null;
}

export async function approveCandidate(
  deps: ReviewDeps,
  action: ReviewAction,
): Promise<CandidateChunk> {
  const cand = await loadCandidate(deps.prisma, action.candidate_id);
  if (!cand) throw new Error(`candidate not found: ${action.candidate_id}`);

  await deps.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      UPDATE kb_candidate_queue
         SET reviewed_at = now(),
             reviewer_user_id = $2,
             review_decision = 'approved',
             review_notes = $3
       WHERE id = $1
      `,
      action.candidate_id,
      action.reviewer_user_id,
      action.notes ?? null,
    );
  });
  await activateChunk(deps, cand.id!);
  invalidateCache(cand.industry, cand.geo, cand.language);

  return {
    ...cand,
    reviewed_at: new Date(),
    reviewer_user_id: action.reviewer_user_id,
    review_decision: "approved",
    review_notes: action.notes,
    active: true,
  };
}

export async function rejectCandidate(
  deps: ReviewDeps,
  action: ReviewAction,
): Promise<CandidateChunk> {
  const cand = await loadCandidate(deps.prisma, action.candidate_id);
  if (!cand) throw new Error(`candidate not found: ${action.candidate_id}`);

  await deps.prisma.$executeRawUnsafe(
    `
    UPDATE kb_candidate_queue
       SET reviewed_at = now(),
           reviewer_user_id = $2,
           review_decision = 'rejected',
           review_notes = $3
     WHERE id = $1
    `,
    action.candidate_id,
    action.reviewer_user_id,
    action.notes ?? null,
  );
  await retireChunk(deps, cand.id!, `rejected by ${action.reviewer_user_id}`);

  return {
    ...cand,
    reviewed_at: new Date(),
    reviewer_user_id: action.reviewer_user_id,
    review_decision: "rejected",
    review_notes: action.notes,
    active: false,
  };
}

export async function requestEdits(
  deps: ReviewDeps,
  action: ReviewAction,
): Promise<void> {
  await deps.prisma.$executeRawUnsafe(
    `
    UPDATE kb_candidate_queue
       SET reviewed_at = now(),
           reviewer_user_id = $2,
           review_decision = 'edits_required',
           review_notes = $3
     WHERE id = $1
    `,
    action.candidate_id,
    action.reviewer_user_id,
    action.notes ?? null,
  );
}

/**
 * Convenience: pending review queue for the dashboard.
 */
export async function getReviewQueue(
  deps: ReviewDeps,
  args: ListCandidatesArgs = {},
): Promise<CandidateChunk[]> {
  return listCandidates(deps.prisma, { ...args, unreviewed_only: true });
}
