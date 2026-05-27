/**
 * Cohort lifecycle cron.
 *
 *   - On the 1st of every month at 00:30 UTC:
 *       a) Flip the prior month's cohort `running → completed`.
 *       b) Create the next-month cohort as `scheduled` (enrollment open).
 *       c) Flip the just-scheduled cohort to `running` on its day1_at.
 *
 * The cron is run by `apps/workers`; this module exposes pure functions so
 * the unit tests can poke each transition.
 */

import { CURRICULUM } from "./curriculum.js";
import type { ChallengeStore } from "./store.js";
import type { Cohort } from "./types.js";

export interface CronDeps {
  store: ChallengeStore;
  newId: (entity: "request") => string;
  clock?: { now(): number; iso(): string };
  emit?: (name: "cohort_created" | "cohort_started" | "cohort_completed", payload: Record<string, unknown>) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/**
 * Create a cohort for a target month. Cohort runs from `day1At` (1st day of
 * the calendar month at 14:00 UTC) → `day1At + 6 days` final-stream window.
 */
export async function createCohortForMonth(
  args: { challenge_id: string; year: number; month: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; cohort_number: number },
  deps: CronDeps,
): Promise<Cohort> {
  const day1 = new Date(Date.UTC(args.year, args.month, 1, 14, 0, 0, 0));
  const day7 = new Date(day1.valueOf() + 6 * 24 * 3600 * 1000);
  const finalStream = new Date(day7.valueOf() + 5 * 3600 * 1000); // ~7pm UTC on Day 7
  const enrollOpens = new Date(day1.valueOf() - 21 * 24 * 3600 * 1000); // open ~3 weeks before
  const enrollCloses = new Date(day1.valueOf() + 24 * 3600 * 1000);     // close end of Day 1

  const monthName = day1.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const cohort: Cohort = {
    id: deps.newId("request"),
    challenge_id: args.challenge_id,
    cohort_number: args.cohort_number,
    name: `${monthName} cohort`,
    enrollment_opens_at: enrollOpens.toISOString(),
    enrollment_closes_at: enrollCloses.toISOString(),
    day1_at: day1.toISOString(),
    day7_at: day7.toISOString(),
    final_stream_at: finalStream.toISOString(),
    status: "scheduled",
    enrolled_count: 0,
    funnels_shipped_count: 0,
    leads_generated_count: 0,
    paid_conversion_count: 0,
    created_at: (deps.clock ?? defaultClock).iso(),
  };
  const inserted = await deps.store.insertCohort(cohort);
  if (deps.emit) {
    await deps.emit("cohort_created", { cohort_id: inserted.id, name: inserted.name });
  }
  return inserted;
}

/** Flip the current scheduled cohort to running (called on Day 1 at 14:00 UTC). */
export async function startCohort(cohort_id: string, deps: CronDeps): Promise<Cohort> {
  const c = await deps.store.updateCohortStatus(cohort_id, "running");
  if (deps.emit) await deps.emit("cohort_started", { cohort_id, name: c.name });
  return c;
}

/** Flip the cohort to completed (called after final stream ends). */
export async function completeCohort(cohort_id: string, deps: CronDeps): Promise<Cohort> {
  const c = await deps.store.updateCohortStatus(cohort_id, "completed");
  if (deps.emit) {
    await deps.emit("cohort_completed", {
      cohort_id,
      enrolled: c.enrolled_count,
      funnels_shipped: c.funnels_shipped_count,
      leads_generated: c.leads_generated_count,
      paid_conversions: c.paid_conversion_count,
    });
  }
  return c;
}

/** Sanity helper for tests. */
export function curriculumDayCount(): number {
  return CURRICULUM.length;
}
