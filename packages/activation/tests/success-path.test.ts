import { describe, expect, it } from "vitest";

import {
  getStatus,
  markStep,
} from "../src/success-path.js";
import {
  InMemoryAwards,
  InMemoryEmitter,
  InMemoryLifecycleStore,
  InMemoryReferrals,
  makeState,
} from "./_helpers.js";

describe("Success Path — getStatus", () => {
  it("returns null for unknown user", async () => {
    const store = new InMemoryLifecycleStore();
    const r = await getStatus({
      workspace_id: "wsp_test",
      user_id: "usr_missing",
      store,
    });
    expect(r).toBeNull();
  });

  it("computes 1/5 (20%) on a brand-new user", async () => {
    const store = new InMemoryLifecycleStore();
    await store.save(makeState());
    const status = await getStatus({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      store,
    });
    expect(status).toMatchObject({
      progress_percent: 20,
      current_step: "first_funnel_generated",
      completed_steps: ["signed_up"],
      is_activated: false,
    });
  });

  it("estimated_hours_to_next_step uses cohort median when available", async () => {
    const store = new InMemoryLifecycleStore();
    await store.save(makeState());
    store.medians.push({
      from: "signed_up",
      to: "first_funnel_generated",
      industry: "real_estate",
      hours: 4.2,
    });
    const status = await getStatus({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      store,
    });
    expect(status?.estimated_hours_to_next_step).toBe(4.2);
  });

  it("returns is_activated=true after all 5 steps", async () => {
    const store = new InMemoryLifecycleStore();
    const t = new Date("2026-05-01T00:00:00Z").toISOString();
    await store.save(
      makeState({
        funnel_created_at: t,
        source_connected_at: t,
        first_lead_at: t,
        first_followup_at: t,
        activated_at: t,
      }),
    );
    const status = await getStatus({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      store,
    });
    expect(status?.is_activated).toBe(true);
    expect(status?.progress_percent).toBe(100);
  });

  it("refuses cross-workspace reads", async () => {
    const store = new InMemoryLifecycleStore();
    await store.save(makeState());
    const r = await getStatus({
      workspace_id: "wsp_other",
      user_id: "usr_test",
      store,
    });
    expect(r).toBeNull();
  });
});

describe("Success Path — markStep idempotency + activation", () => {
  function ctx() {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    const awards = new InMemoryAwards();
    const referrals = new InMemoryReferrals();
    return { store, emitter, awards, referrals };
  }

  it("first mark fires activation_step_completed; second mark is a no-op", async () => {
    const { store, emitter, awards, referrals } = ctx();
    await store.save(makeState());
    const a = await markStep({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      step: "first_funnel_generated",
      store,
      emit: emitter.emit,
      awards,
      referrals,
    });
    expect(a.was_new).toBe(true);
    const b = await markStep({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      step: "first_funnel_generated",
      store,
      emit: emitter.emit,
      awards,
      referrals,
    });
    expect(b.was_new).toBe(false);
    expect(emitter.byName("activation_step_completed")).toHaveLength(1);
  });

  it("completing the 5th step emits `activated` + mints Bronze + asks for referral", async () => {
    const { store, emitter, awards, referrals } = ctx();
    const t = "2026-05-01T00:00:00Z";
    await store.save(
      makeState({
        funnel_created_at: t,
        source_connected_at: t,
        first_lead_at: t,
      }),
    );
    const r = await markStep({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      step: "first_followup_completed",
      store,
      emit: emitter.emit,
      awards,
      referrals,
    });
    expect(r.activated_now).toBe(true);
    expect(r.award?.level).toBe("bronze");
    expect(r.referral_campaign_id).toBe("ref_usr_test");
    expect(emitter.byName("activated")).toHaveLength(1);
    expect(awards.minted).toHaveLength(1);
    expect(referrals.asks).toHaveLength(1);
  });

  it("re-marking the 5th step does NOT re-mint Bronze or re-ask referral", async () => {
    const { store, emitter, awards, referrals } = ctx();
    const t = "2026-05-01T00:00:00Z";
    await store.save(
      makeState({
        funnel_created_at: t,
        source_connected_at: t,
        first_lead_at: t,
        first_followup_at: t,
        activated_at: t,
      }),
    );
    const r = await markStep({
      workspace_id: "wsp_test",
      user_id: "usr_test",
      step: "first_followup_completed",
      store,
      emit: emitter.emit,
      awards,
      referrals,
    });
    expect(r.was_new).toBe(false);
    expect(emitter.byName("activated")).toHaveLength(0);
  });

  it("throws on cross-workspace markStep", async () => {
    const { store, emitter, awards, referrals } = ctx();
    await store.save(makeState());
    await expect(
      markStep({
        workspace_id: "wsp_other",
        user_id: "usr_test",
        step: "first_funnel_generated",
        store,
        emit: emitter.emit,
        awards,
        referrals,
      }),
    ).rejects.toThrow(/workspace mismatch/);
  });
});
