import { describe, expect, it } from "vitest";

import {
  evaluateStallChurn,
  handleEvent,
  isInterventionEligible,
} from "../src/lifecycle-orchestrator.js";
import { INTERVENTION_KINDS } from "../src/types.js";
import {
  InMemoryAwards,
  InMemoryEmitter,
  InMemoryLifecycleStore,
  InMemoryReferrals,
  InMemoryScheduler,
  makeState,
} from "./_helpers.js";

function harness(now = new Date("2026-05-01T00:00:00Z")) {
  const store = new InMemoryLifecycleStore();
  const scheduler = new InMemoryScheduler();
  const emitter = new InMemoryEmitter();
  const awards = new InMemoryAwards();
  const referrals = new InMemoryReferrals();
  return {
    store,
    scheduler,
    emitter,
    awards,
    referrals,
    deps: {
      store,
      scheduler,
      emit: emitter.emit,
      awards,
      referrals,
      now: () => now,
    },
  };
}

describe("Lifecycle Orchestrator", () => {
  it("user_signed_up creates state row + schedules the full 10-trigger battery", async () => {
    const h = harness();
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: "real_estate",
        plan_tier: "free",
      },
      h.deps,
    );
    expect(h.store.states.get("usr_a")?.current_state).toBe("pre_active");
    expect(h.scheduler.scheduled).toHaveLength(INTERVENTION_KINDS.length);
    // Re-emit the same signup → scheduler is idempotent on dedupe_key.
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: "real_estate",
        plan_tier: "free",
      },
      h.deps,
    );
    expect(h.scheduler.scheduled).toHaveLength(INTERVENTION_KINDS.length);
  });

  it("traffic_source_connected cancels D1+D2 nudges", async () => {
    const h = harness();
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: null,
        plan_tier: "free",
      },
      h.deps,
    );
    await handleEvent(
      {
        name: "traffic_source_connected",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T02:00:00Z",
        source_type: "meta",
      },
      h.deps,
    );
    const cancelled = h.scheduler.cancelled.map((c) => c.kind);
    expect(cancelled).toContain("d1_connect_source");
    expect(cancelled).toContain("d2_no_source");
  });

  it("subscription_canceled transitions to churned and cancels every job", async () => {
    const h = harness();
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: null,
        plan_tier: "free",
      },
      h.deps,
    );
    await handleEvent(
      {
        name: "subscription_canceled",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-02T00:00:00Z",
      },
      h.deps,
    );
    expect(h.store.states.get("usr_a")?.current_state).toBe("churned");
    expect(h.scheduler.cancelled.some((c) => c.kind === "ALL")).toBe(true);
  });

  it("downgrade restarts the Day-0 sequence", async () => {
    const h = harness();
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: "fitness",
        plan_tier: "pro",
      },
      h.deps,
    );
    h.scheduler.scheduled = []; // wipe Day-0 battery
    await handleEvent(
      {
        name: "subscription_downgraded",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-10T00:00:00Z",
        from_plan: "pro",
        to_plan: "free",
      },
      h.deps,
    );
    expect(h.scheduler.scheduled.length).toBe(INTERVENTION_KINDS.length);
    expect(h.store.states.get("usr_a")?.plan_tier).toBe("free");
  });

  it("evaluateStallChurn → stalled at D7 no lead, churned at D14+ dormant", async () => {
    const now = new Date("2026-05-15T00:00:00Z");
    const h = harness(now);
    await h.store.save(
      makeState({
        user_id: "usr_stalled",
        workspace_id: "wsp_a",
        signed_up_at: "2026-05-07T00:00:00Z", // 8 days ago
        last_action_at: "2026-05-07T00:00:00Z",
        current_state: "in_progress",
      }),
    );
    await evaluateStallChurn("usr_stalled", h.deps);
    expect(h.store.states.get("usr_stalled")?.current_state).toBe("stalled");

    await h.store.save(
      makeState({
        user_id: "usr_churn",
        workspace_id: "wsp_a",
        signed_up_at: "2026-04-15T00:00:00Z", // 30 days ago
        last_action_at: "2026-04-20T00:00:00Z", // 25 days dormant
        current_state: "in_progress",
      }),
    );
    await evaluateStallChurn("usr_churn", h.deps);
    expect(h.store.states.get("usr_churn")?.current_state).toBe("churned");
  });

  it("isInterventionEligible: opt-out / suspended / churned all reject", async () => {
    expect(
      isInterventionEligible(makeState({ coaching_opt_out: true })),
    ).toEqual({ ok: false, reason: "coaching_opt_out" });
    expect(
      isInterventionEligible(makeState({ workspace_suspended: true })),
    ).toEqual({ ok: false, reason: "workspace_suspended" });
    expect(
      isInterventionEligible(makeState({ current_state: "churned" })),
    ).toEqual({ ok: false, reason: "churned" });
    expect(isInterventionEligible(makeState())).toEqual({
      ok: true,
      reason: null,
    });
  });
});
