/**
 * Cohort tracking + drop-off correlation.
 *
 * Cohorts are bucketed by signup week (Monday 00:00 UTC). Metrics:
 *   - % connected source by D2
 *   - % first lead by D7
 *   - % paid upgrade by D14
 *   - % activated by D14
 *   - median time-to-first-lead
 *
 * Drop-off correlation: per step, compute conversion rate AND conditional
 * D30 retention, take the largest Δ retention as "where the leverage is."
 *
 * Doc 06a §4 + §5.
 */

import {
  ACTIVATION_STEPS,
  ActivationStep,
  CohortDropOffStep,
  CohortLeakReport,
  CohortMetrics,
  LifecycleUserState,
} from "./types.js";

/* ===== Cohort store ==================================================== */

export interface CohortQueryStore {
  /** Returns every lifecycle_user_state row whose signed_up_at falls in
   *  [from, to) — used for cohort-week analytics. */
  loadCohortRows(args: { from: string; to: string }): Promise<LifecycleUserState[]>;
  /** Returns the fraction of `user_ids` with any session activity in
   *  [from, to). Used for D30 retention. */
  retentionRate(args: {
    user_ids: string[];
    from: string;
    to: string;
  }): Promise<number>;
  /** Returns the fraction of `user_ids` that have `subscription_upgraded`
   *  from free→paid by `by`. */
  paidUpgradeRate(args: { user_ids: string[]; by: string }): Promise<number>;
}

/* ===== Cohort window helpers ========================================== */

/** Returns the Monday 00:00 UTC of the week containing `d`. */
export function cohortWeekStart(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - mondayOffset);
  return utc;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/* ===== Metric computation ============================================ */

export async function computeCohortMetrics(args: {
  cohort_week_start: Date;
  store: CohortQueryStore;
}): Promise<CohortMetrics> {
  const from = args.cohort_week_start.toISOString();
  const to = addDays(args.cohort_week_start, 7).toISOString();
  const rows = await args.store.loadCohortRows({ from, to });

  const signups = rows.length;
  if (signups === 0) {
    return {
      cohort_week: from.slice(0, 10),
      signups: 0,
      pct_connected_source_by_d2: 0,
      pct_first_lead_by_d7: 0,
      pct_paid_upgrade_by_d14: 0,
      pct_activated_by_d14: 0,
      median_time_to_first_lead_days: null,
    };
  }

  const withinHours = (start: string, end: string | null, hours: number): boolean => {
    if (!end) return false;
    return Date.parse(end) - Date.parse(start) <= hours * 3_600_000;
  };

  const sourceCount = rows.filter((r) =>
    withinHours(r.signed_up_at, r.source_connected_at, 48),
  ).length;
  const leadCount = rows.filter((r) =>
    withinHours(r.signed_up_at, r.first_lead_at, 168),
  ).length;
  const activatedCount = rows.filter((r) =>
    withinHours(r.signed_up_at, r.activated_at, 14 * 24),
  ).length;

  const byD14 = addDays(args.cohort_week_start, 14).toISOString();
  const paidUpgradeRate = await args.store.paidUpgradeRate({
    user_ids: rows.map((r) => r.user_id),
    by: byD14,
  });

  const ttflDays = rows
    .filter((r) => r.first_lead_at)
    .map(
      (r) =>
        (Date.parse(r.first_lead_at!) - Date.parse(r.signed_up_at)) /
        86_400_000,
    )
    .sort((a, b) => a - b);
  const medianTtfl = ttflDays.length === 0
    ? null
    : ttflDays[Math.floor(ttflDays.length / 2)] ?? null;

  return {
    cohort_week: from.slice(0, 10),
    signups,
    pct_connected_source_by_d2: pct(sourceCount, signups),
    pct_first_lead_by_d7: pct(leadCount, signups),
    pct_paid_upgrade_by_d14: paidUpgradeRate,
    pct_activated_by_d14: pct(activatedCount, signups),
    median_time_to_first_lead_days: medianTtfl,
  };
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 10_000) / 100; // 2 decimals
}

/* ===== Drop-off + Δ retention ======================================== */

export async function computeLeakReport(args: {
  cohort_week_start: Date;
  store: CohortQueryStore;
  /** Trailing 4-week baseline for the worsened flag. */
  baseline: CohortMetrics[];
}): Promise<CohortLeakReport> {
  const from = args.cohort_week_start.toISOString();
  const to = addDays(args.cohort_week_start, 7).toISOString();
  const rows = await args.store.loadCohortRows({ from, to });

  // Reachers per step.
  const reached: Record<ActivationStep, LifecycleUserState[]> = {
    signed_up: rows,
    first_funnel_generated: rows.filter((r) => r.funnel_created_at),
    traffic_source_connected: rows.filter((r) => r.source_connected_at),
    first_lead_captured: rows.filter((r) => r.first_lead_at),
    first_followup_completed: rows.filter((r) => r.first_followup_at),
  };

  const d30From = addDays(args.cohort_week_start, 29).toISOString();
  const d30To = addDays(args.cohort_week_start, 31).toISOString();
  const conditionalRetention: Partial<Record<ActivationStep, number>> = {};
  for (const step of ACTIVATION_STEPS) {
    const ids = reached[step].map((r) => r.user_id);
    if (ids.length === 0) {
      conditionalRetention[step] = 0;
      continue;
    }
    conditionalRetention[step] = await args.store.retentionRate({
      user_ids: ids,
      from: d30From,
      to: d30To,
    });
  }

  const total = rows.length || 1;
  const steps: CohortDropOffStep[] = ACTIVATION_STEPS.map((step, i) => {
    const completion = reached[step].length / total;
    const prior = i === 0 ? null : ACTIVATION_STEPS[i - 1]!;
    const delta = prior
      ? (conditionalRetention[step] ?? 0) - (conditionalRetention[prior] ?? 0)
      : 0;
    return {
      step,
      completion_rate: completion,
      conditional_d30_retention: conditionalRetention[step] ?? 0,
      delta_retention_vs_prior_step: delta,
    };
  });

  // Biggest drop = largest reduction in completion vs. prior step.
  let biggestDrop: ActivationStep = "signed_up";
  let worstDrop = 0;
  for (let i = 1; i < steps.length; i++) {
    const cur = steps[i]!;
    const prev = steps[i - 1]!;
    const drop = prev.completion_rate - cur.completion_rate;
    if (drop > worstDrop) {
      worstDrop = drop;
      biggestDrop = cur.step;
    }
  }

  // Biggest Δ retention = largest absolute value of delta_retention_vs_prior_step.
  let biggestDelta: ActivationStep = "signed_up";
  let worstDelta = 0;
  for (const s of steps) {
    if (Math.abs(s.delta_retention_vs_prior_step) > Math.abs(worstDelta)) {
      worstDelta = s.delta_retention_vs_prior_step;
      biggestDelta = s.step;
    }
  }

  // Worsened vs. baseline?
  const baselineAvgActivation =
    args.baseline.length > 0
      ? args.baseline.reduce((a, c) => a + c.pct_activated_by_d14, 0) /
        args.baseline.length
      : null;
  const thisWeek = await computeCohortMetrics({
    cohort_week_start: args.cohort_week_start,
    store: args.store,
  });
  const worsened =
    baselineAvgActivation !== null &&
    thisWeek.pct_activated_by_d14 < baselineAvgActivation - 5;

  return {
    cohort_week: from.slice(0, 10),
    steps,
    biggest_drop_step: biggestDrop,
    biggest_delta_retention_step: biggestDelta,
    worsened_vs_baseline: worsened,
  };
}

/* ===== Cohort comparison ============================================= */

export interface CohortComparison {
  cohort_a: CohortMetrics;
  cohort_b: CohortMetrics;
  deltas: {
    pct_connected_source_by_d2: number;
    pct_first_lead_by_d7: number;
    pct_paid_upgrade_by_d14: number;
    pct_activated_by_d14: number;
  };
}

export function compareCohorts(a: CohortMetrics, b: CohortMetrics): CohortComparison {
  return {
    cohort_a: a,
    cohort_b: b,
    deltas: {
      pct_connected_source_by_d2:
        b.pct_connected_source_by_d2 - a.pct_connected_source_by_d2,
      pct_first_lead_by_d7: b.pct_first_lead_by_d7 - a.pct_first_lead_by_d7,
      pct_paid_upgrade_by_d14:
        b.pct_paid_upgrade_by_d14 - a.pct_paid_upgrade_by_d14,
      pct_activated_by_d14:
        b.pct_activated_by_d14 - a.pct_activated_by_d14,
    },
  };
}
