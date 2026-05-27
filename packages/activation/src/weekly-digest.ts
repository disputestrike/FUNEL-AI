/**
 * Monday weekly digest — Slack blocks for #cs-leadership + #product-leadership.
 *
 * Aggregates:
 *   - last week's cohort progress
 *   - biggest drop-off step (auto-flag)
 *   - workspaces stalled requiring concierge
 *   - 4-week rolling activation-rate trend
 *
 * Returns a payload the calling job can POST to chat.postMessage; we don't
 * own Slack credentials here.
 *
 * Doc 06a §4 (Slack digest) + §5 (auto-flag).
 */

import {
  CohortLeakReport,
  CohortMetrics,
  LifecycleUserState,
  PlanTier,
  SlackBlock,
  WeeklyDigestPayload,
} from "./types.js";
import {
  CohortQueryStore,
  addDays,
  cohortWeekStart,
  computeCohortMetrics,
  computeLeakReport,
} from "./cohort.js";

export interface StalledWorkspaceQuery {
  /** Returns lifecycle states for in-progress users older than `min_age_days`
   *  who are NOT activated. */
  findStalled(args: { now: Date; min_age_days: number }): Promise<LifecycleUserState[]>;
}

export async function buildWeeklyDigest(args: {
  for_week_starting?: Date;
  cohort_store: CohortQueryStore;
  stalled: StalledWorkspaceQuery;
  now?: () => Date;
}): Promise<WeeklyDigestPayload> {
  const now = (args.now ?? (() => new Date()))();
  const thisMonday = args.for_week_starting ?? cohortWeekStart(now);
  const lastWeek = addDays(thisMonday, -7);

  // Compute the last completed cohort's metrics.
  const cohort = await computeCohortMetrics({
    cohort_week_start: lastWeek,
    store: args.cohort_store,
  });

  // Trailing 4-week baseline for leak detection.
  const baselineMetrics: CohortMetrics[] = [];
  for (let i = 2; i <= 5; i++) {
    baselineMetrics.push(
      await computeCohortMetrics({
        cohort_week_start: addDays(thisMonday, -7 * i),
        store: args.cohort_store,
      }),
    );
  }
  const leak = await computeLeakReport({
    cohort_week_start: lastWeek,
    store: args.cohort_store,
    baseline: baselineMetrics,
  });

  // Stalled workspaces — anything 5+ days old that hasn't activated.
  const stalledRows = await args.stalled.findStalled({ now, min_age_days: 5 });
  const stalled = stalledRows.map((s) => ({
    workspace_id: s.workspace_id,
    user_id: s.user_id,
    plan_tier: s.plan_tier,
    days_since_signup: Math.floor(
      (now.getTime() - Date.parse(s.signed_up_at)) / 86_400_000,
    ),
    biggest_gap: biggestGap(s),
  }));
  // Sort: highest-tier first, then oldest first.
  stalled.sort((a, b) => {
    const tierOrder: Record<PlanTier, number> = {
      agency: 0,
      scale: 1,
      pro: 2,
      pro_boost: 3,
      free: 4,
    };
    const td = tierOrder[a.plan_tier] - tierOrder[b.plan_tier];
    if (td !== 0) return td;
    return b.days_since_signup - a.days_since_signup;
  });

  const trend = [cohort, ...baselineMetrics.slice(0, 3)]
    .map((c) => ({
      week: c.cohort_week,
      rate: c.pct_activated_by_d14,
    }))
    .reverse();

  const blocks = renderSlackBlocks({
    cohort,
    leak,
    stalledCount: stalled.length,
    stalledHighlights: stalled.slice(0, 5),
    trend,
  });

  return {
    for_week_starting: lastWeek.toISOString().slice(0, 10),
    cohort,
    leak_report: leak,
    workspaces_stalled: stalled,
    activation_rate_trend_4w: trend,
    slack_blocks: blocks,
  };
}

/* ===== Slack block renderer =========================================== */

function renderSlackBlocks(args: {
  cohort: CohortMetrics;
  leak: CohortLeakReport;
  stalledCount: number;
  stalledHighlights: Array<{
    workspace_id: string;
    user_id: string;
    plan_tier: PlanTier;
    days_since_signup: number;
  }>;
  trend: Array<{ week: string; rate: number }>;
}): SlackBlock[] {
  const c = args.cohort;
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Activation Weekly — cohort starting ${c.cohort_week}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Signups:* ${c.signups}`,
          `*Connected source by D2:* ${c.pct_connected_source_by_d2}%`,
          `*First lead by D7:* ${c.pct_first_lead_by_d7}%`,
          `*Activated by D14:* ${c.pct_activated_by_d14}%`,
          `*Paid upgrade by D14:* ${c.pct_paid_upgrade_by_d14}%`,
          `*Median time-to-first-lead:* ${
            c.median_time_to_first_lead_days?.toFixed(1) ?? "n/a"
          } days`,
        ].join("\n"),
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Biggest drop-off step:* \`${args.leak.biggest_drop_step}\`\n` +
          `*Largest Δ retention step:* \`${args.leak.biggest_delta_retention_step}\`\n` +
          (args.leak.worsened_vs_baseline
            ? `:rotating_light: Activation rate worsened > 5pp vs trailing-4w baseline.`
            : `Activation rate within baseline range.`),
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Workspaces stalled, awaiting concierge:* ${args.stalledCount}`,
      },
    },
  ];

  if (args.stalledHighlights.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: args.stalledHighlights
          .map(
            (s) =>
              `• \`${s.workspace_id}\` — ${s.plan_tier} — day ${s.days_since_signup}`,
          )
          .join("\n"),
      },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*4-week activation-rate trend:*`,
          ...args.trend.map((t) => `• ${t.week}: ${t.rate}%`),
        ].join("\n"),
      },
    },
  );

  return blocks;
}

function biggestGap(s: LifecycleUserState): import("./types.js").ActivationStep {
  if (!s.funnel_created_at) return "first_funnel_generated";
  if (!s.source_connected_at) return "traffic_source_connected";
  if (!s.first_lead_at) return "first_lead_captured";
  return "first_followup_completed";
}
