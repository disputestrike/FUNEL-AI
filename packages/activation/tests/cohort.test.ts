import { describe, expect, it } from "vitest";

import {
  cohortWeekStart,
  compareCohorts,
  computeCohortMetrics,
  computeLeakReport,
} from "../src/cohort.js";
import { InMemoryCohortStore, makeState } from "./_helpers.js";

describe("Cohort — week bucketing", () => {
  it("cohortWeekStart snaps to Monday UTC", () => {
    const sunday = new Date("2026-05-03T12:00:00Z"); // Sunday
    const monday = cohortWeekStart(sunday);
    expect(monday.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });
});

describe("Cohort — metric computation", () => {
  it("computes pct_* and median TTFL correctly for a small cohort", async () => {
    const store = new InMemoryCohortStore();
    const monday = new Date("2026-05-04T00:00:00Z");
    // Three signups Tuesday-of-week; two connected source within 48h; one lead
    // within 7 days; none activated.
    store.rows.push(
      makeState({
        user_id: "u1",
        signed_up_at: "2026-05-05T10:00:00Z",
        source_connected_at: "2026-05-06T10:00:00Z",
        first_lead_at: "2026-05-07T10:00:00Z",
      }),
      makeState({
        user_id: "u2",
        signed_up_at: "2026-05-05T10:00:00Z",
        source_connected_at: "2026-05-06T10:00:00Z",
      }),
      makeState({
        user_id: "u3",
        signed_up_at: "2026-05-05T10:00:00Z",
      }),
    );
    store.paidUsers.add("u1");
    const m = await computeCohortMetrics({
      cohort_week_start: monday,
      store,
    });
    expect(m.signups).toBe(3);
    expect(m.pct_connected_source_by_d2).toBeCloseTo(66.67, 1);
    expect(m.pct_first_lead_by_d7).toBeCloseTo(33.33, 1);
    expect(m.median_time_to_first_lead_days).toBeCloseTo(2, 0);
  });

  it("returns zeros for empty cohort", async () => {
    const store = new InMemoryCohortStore();
    const m = await computeCohortMetrics({
      cohort_week_start: new Date("2026-05-04T00:00:00Z"),
      store,
    });
    expect(m.signups).toBe(0);
    expect(m.median_time_to_first_lead_days).toBeNull();
  });
});

describe("Cohort — leak report", () => {
  it("identifies the biggest drop-off step", async () => {
    const store = new InMemoryCohortStore();
    const monday = new Date("2026-05-04T00:00:00Z");
    // 10 signups, 9 created funnels, only 3 connected source — huge drop
    // between funnel_created and source_connected.
    for (let i = 0; i < 10; i++) {
      store.rows.push(
        makeState({
          user_id: `u${i}`,
          signed_up_at: "2026-05-05T00:00:00Z",
          funnel_created_at: i < 9 ? "2026-05-05T01:00:00Z" : null,
          source_connected_at: i < 3 ? "2026-05-05T02:00:00Z" : null,
          first_lead_at: i < 2 ? "2026-05-06T00:00:00Z" : null,
          first_followup_at: i < 1 ? "2026-05-07T00:00:00Z" : null,
        }),
      );
      store.retentionPerUser.set(`u${i}`, i < 5);
    }
    const leak = await computeLeakReport({
      cohort_week_start: monday,
      store,
      baseline: [],
    });
    expect(leak.biggest_drop_step).toBe("traffic_source_connected");
    expect(leak.steps).toHaveLength(5);
  });
});

describe("Cohort — comparison", () => {
  it("computes positive/negative deltas across two cohorts", () => {
    const a = {
      cohort_week: "2026-04-27",
      signups: 100,
      pct_connected_source_by_d2: 50,
      pct_first_lead_by_d7: 40,
      pct_paid_upgrade_by_d14: 10,
      pct_activated_by_d14: 30,
      median_time_to_first_lead_days: 6,
    };
    const b = {
      ...a,
      cohort_week: "2026-05-04",
      pct_activated_by_d14: 45,
      pct_first_lead_by_d7: 35,
    };
    const c = compareCohorts(a, b);
    expect(c.deltas.pct_activated_by_d14).toBe(15);
    expect(c.deltas.pct_first_lead_by_d7).toBe(-5);
  });
});
