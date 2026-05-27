/**
 * Cohort leaderboards (Doc 16 §7.3).
 *
 *   - Most leads generated this cohort
 *   - Highest CR funnel
 *   - Fastest to first $1K
 *
 * The dashboards are real-time (refreshed every 60s in prod) by re-running
 * the aggregations from `Submission` + the participant table. For lean
 * scenarios we expose a single `buildCohortDashboard` that returns the full
 * leaderboard payload.
 */

import { CURRICULUM } from "./curriculum.js";
import type { ChallengeStore } from "./store.js";
import type { Cohort, DayProgress, Participant } from "./types.js";

export interface CohortDashboard {
  cohort: Cohort;
  total_enrolled: number;
  days_progress: DayProgress[];
  leaderboards: {
    most_leads: Array<{ participant_id: string; display: string; leads: number }>;
    highest_cr: Array<{ participant_id: string; display: string; cr_pct: number }>;
    fastest_to_1k: Array<{ participant_id: string; display: string; hours: number }>;
  };
}

export interface LeaderboardDeps {
  store: ChallengeStore;
  /** Resolve a participant → leads + revenue for ranking. */
  getParticipantFunnelStats: (participant_id: string) => Promise<{
    leads: number;
    cr_pct: number;
    revenue_cents: number;
    first_1k_at: string | null;
  }>;
}

/** Build the live cohort dashboard payload. */
export async function buildCohortDashboard(
  cohort_id: string,
  deps: LeaderboardDeps,
): Promise<CohortDashboard | null> {
  const cohort = await deps.store.getCohortById(cohort_id);
  if (!cohort) return null;
  const participants = await deps.store.listCohortParticipants(cohort_id);

  // Day-progress aggregation.
  const days_progress: DayProgress[] = [];
  for (const dc of CURRICULUM) {
    const completed = participants.filter((p) => p.days_completed.includes(dc.day)).length;
    const pct = participants.length === 0 ? 0 : (completed / participants.length) * 100;
    days_progress.push({
      cohort_id,
      day: dc.day,
      completed_count: completed,
      completion_pct: pct,
      cohort_aggregate: {
        funnels_shipped: cohort.funnels_shipped_count,
        leads_generated: cohort.leads_generated_count,
      },
    });
  }

  // Per-participant stats for leaderboards.
  type Row = { participant_id: string; display: string; leads: number; cr_pct: number; first_1k_at: string | null };
  const rows: Row[] = [];
  for (const p of participants) {
    try {
      const stats = await deps.getParticipantFunnelStats(p.id);
      rows.push({
        participant_id: p.id,
        display: p.email.split("@")[0] ?? "anon",
        leads: stats.leads,
        cr_pct: stats.cr_pct,
        first_1k_at: stats.first_1k_at,
      });
    } catch {
      /* continue */
    }
  }

  const enrollAt = new Date(cohort.day1_at).valueOf();
  const fastest_to_1k = rows
    .filter((r) => r.first_1k_at)
    .map((r) => ({
      participant_id: r.participant_id,
      display: r.display,
      hours: ((new Date(r.first_1k_at!).valueOf() - enrollAt) / 3600_000) | 0,
    }))
    .sort((a, b) => a.hours - b.hours)
    .slice(0, 25);

  return {
    cohort,
    total_enrolled: participants.length,
    days_progress,
    leaderboards: {
      most_leads: [...rows]
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 25)
        .map((r) => ({ participant_id: r.participant_id, display: r.display, leads: r.leads })),
      highest_cr: [...rows]
        .filter((r) => r.leads >= 10)        // only score CR with ≥10 leads to suppress noise
        .sort((a, b) => b.cr_pct - a.cr_pct)
        .slice(0, 25)
        .map((r) => ({ participant_id: r.participant_id, display: r.display, cr_pct: r.cr_pct })),
      fastest_to_1k,
    },
  };
}

/** Public-facing aggregate (excludes PII). */
export interface PublicCohortStats {
  cohort_number: number;
  total_enrolled: number;
  funnels_shipped: number;
  leads_generated: number;
  paid_conversions: number;
  days_progress_pct: number[]; // length-7 array, percentages
}

export function publicStats(cohort: Cohort, days: DayProgress[]): PublicCohortStats {
  return {
    cohort_number: cohort.cohort_number,
    total_enrolled: cohort.enrolled_count,
    funnels_shipped: cohort.funnels_shipped_count,
    leads_generated: cohort.leads_generated_count,
    paid_conversions: cohort.paid_conversion_count,
    days_progress_pct: [1, 2, 3, 4, 5, 6, 7].map(
      (d) => days.find((p) => p.day === d)?.completion_pct ?? 0,
    ),
  };
}
