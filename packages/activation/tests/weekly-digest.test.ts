import { describe, expect, it } from "vitest";

import { buildWeeklyDigest } from "../src/weekly-digest.js";
import { InMemoryCohortStore, makeState } from "./_helpers.js";

describe("Weekly Digest", () => {
  it("aggregates the last completed cohort + emits Slack blocks", async () => {
    const store = new InMemoryCohortStore();
    // Cohort: week starting 2026-05-04 (Mon). Now = 2026-05-12.
    for (let i = 0; i < 8; i++) {
      store.rows.push(
        makeState({
          user_id: `u${i}`,
          signed_up_at: "2026-05-05T00:00:00Z",
          funnel_created_at: i < 7 ? "2026-05-05T01:00:00Z" : null,
          source_connected_at: i < 5 ? "2026-05-05T02:00:00Z" : null,
          first_lead_at: i < 3 ? "2026-05-06T00:00:00Z" : null,
          activated_at: i < 2 ? "2026-05-08T00:00:00Z" : null,
          current_state: i < 2 ? "activated" : "in_progress",
        }),
      );
    }
    // Plant a couple of stalled rows in this same cohort.
    const digest = await buildWeeklyDigest({
      cohort_store: store,
      stalled: store,
      now: () => new Date("2026-05-12T09:00:00Z"),
    });
    expect(digest.cohort.signups).toBe(8);
    expect(digest.slack_blocks.length).toBeGreaterThan(0);
    expect(
      digest.slack_blocks.some(
        (b) =>
          typeof b.text === "object" &&
          b.text !== null &&
          (b.text as { text?: string }).text?.includes("Workspaces stalled"),
      ),
    ).toBe(true);
    // High-tier stalled accounts come first in workspaces_stalled.
    expect(Array.isArray(digest.workspaces_stalled)).toBe(true);
  });

  it("sorts stalled workspaces with highest tier first", async () => {
    const store = new InMemoryCohortStore();
    store.rows.push(
      makeState({
        user_id: "u_free",
        plan_tier: "free",
        signed_up_at: "2026-05-04T00:00:00Z",
      }),
      makeState({
        user_id: "u_scale",
        plan_tier: "scale",
        signed_up_at: "2026-05-04T00:00:00Z",
      }),
      makeState({
        user_id: "u_agency",
        plan_tier: "agency",
        signed_up_at: "2026-05-04T00:00:00Z",
      }),
    );
    const digest = await buildWeeklyDigest({
      cohort_store: store,
      stalled: store,
      now: () => new Date("2026-05-12T00:00:00Z"),
    });
    expect(digest.workspaces_stalled[0]?.plan_tier).toBe("agency");
    expect(digest.workspaces_stalled[1]?.plan_tier).toBe("scale");
    expect(digest.workspaces_stalled[2]?.plan_tier).toBe("free");
  });
});
