import { describe, expect, it } from "vitest";

import {
  CONCIERGE_EMAIL_TEMPLATES,
  buildScoresheet,
  logScoresheet,
  recommendedEscalationLevel,
  renderD5CallScript,
  shouldFounderEmail,
} from "../src/concierge-playbook.js";
import {
  InMemoryConciergeStore,
  InMemoryEmitter,
  InMemoryLifecycleStore,
  makeState,
} from "./_helpers.js";

describe("Concierge — scoresheet", () => {
  it("validates all six dimensions in range", () => {
    const s = buildScoresheet({
      workspace_id: "wsp_a",
      user_id: "usr_a",
      called_by_user_id: "usr_csrep",
      caller_role: "cs_rep",
      scores: {
        hook_clarity: 3,
        offer_market_fit: 4,
        traffic: 1,
        form_friction: 5,
        follow_up_speed: 2,
        ad_copy_alignment: 3,
      },
    });
    expect(s.escalation_level).toBe(1);
    expect(Object.keys(s.scores)).toHaveLength(6);
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      buildScoresheet({
        workspace_id: "wsp_a",
        user_id: "usr_a",
        called_by_user_id: "usr_csrep",
        caller_role: "cs_rep",
        scores: {
          hook_clarity: 9, // bad
          offer_market_fit: 3,
          traffic: 3,
          form_friction: 3,
          follow_up_speed: 3,
          ad_copy_alignment: 3,
        },
      }),
    ).toThrow(/0\.\.5/);
  });

  it("logs scoresheet + emits concierge_scoresheet_logged", async () => {
    const store = new InMemoryConciergeStore();
    const emitter = new InMemoryEmitter();
    const s = buildScoresheet({
      workspace_id: "wsp_a",
      user_id: "usr_a",
      called_by_user_id: "usr_csrep",
      caller_role: "founder",
      scores: {
        hook_clarity: 5,
        offer_market_fit: 5,
        traffic: 5,
        form_friction: 5,
        follow_up_speed: 5,
        ad_copy_alignment: 5,
      },
    });
    await logScoresheet({ scoresheet: s, store, emit: emitter.emit });
    expect(store.scoresheets).toHaveLength(1);
    expect(emitter.byName("concierge_scoresheet_logged")).toHaveLength(1);
  });
});

describe("Concierge — escalation logic", () => {
  it("Scale tier stuck at D5 → founder email gate fires", async () => {
    const store = new InMemoryLifecycleStore();
    const signedUp = "2026-05-01T00:00:00Z";
    await store.save(
      makeState({
        signed_up_at: signedUp,
        plan_tier: "scale",
      }),
    );
    const now = () => new Date("2026-05-07T00:00:00Z");
    const r = await shouldFounderEmail({ user_id: "usr_test", store, now });
    expect(r.should).toBe(true);
  });

  it("free tier at D5 → founder email gate does NOT fire", async () => {
    const store = new InMemoryLifecycleStore();
    await store.save(
      makeState({ signed_up_at: "2026-05-01T00:00:00Z", plan_tier: "free" }),
    );
    const r = await shouldFounderEmail({
      user_id: "usr_test",
      store,
      now: () => new Date("2026-05-07T00:00:00Z"),
    });
    expect(r.should).toBe(false);
    expect(r.reason).toBe("tier_below_threshold");
  });

  it("activated accounts never get a founder email", async () => {
    const store = new InMemoryLifecycleStore();
    await store.save(
      makeState({
        signed_up_at: "2026-05-01T00:00:00Z",
        plan_tier: "scale",
        activated_at: "2026-05-02T00:00:00Z",
      }),
    );
    const r = await shouldFounderEmail({
      user_id: "usr_test",
      store,
      now: () => new Date("2026-05-07T00:00:00Z"),
    });
    expect(r.should).toBe(false);
  });

  it("recommendedEscalationLevel ladder", () => {
    expect(
      recommendedEscalationLevel({ plan_tier: "free", ageHours: 12, activated: false }),
    ).toBe(0);
    expect(
      recommendedEscalationLevel({ plan_tier: "free", ageHours: 60, activated: false }),
    ).toBe(1);
    expect(
      recommendedEscalationLevel({ plan_tier: "free", ageHours: 200, activated: false }),
    ).toBe(2);
    expect(
      recommendedEscalationLevel({
        plan_tier: "agency",
        ageHours: 200,
        activated: false,
      }),
    ).toBe(3);
    expect(
      recommendedEscalationLevel({
        plan_tier: "free",
        ageHours: 24,
        activated: false,
        publicComplaint: true,
      }),
    ).toBe(3);
    expect(
      recommendedEscalationLevel({
        plan_tier: "free",
        ageHours: 24,
        activated: true,
      }),
    ).toBe(0);
  });
});

describe("Concierge — assets", () => {
  it("exposes all five named email templates", () => {
    expect(Object.keys(CONCIERGE_EMAIL_TEMPLATES).sort()).toEqual(
      [
        "connect_source_nudge",
        "first_lead_help",
        "paid_upgrade_ask",
        "save_offer",
        "tune_up_offer",
      ].sort(),
    );
  });

  it("renderD5CallScript chooses founder script for Scale/Agency", () => {
    const a = renderD5CallScript({
      first_name: "Pat",
      cs_rep_name: "Jamie",
      founder_first_name: "Ben",
      plan_tier: "agency",
    });
    expect(a.variant).toBe("founder");
    expect(a.body).toContain("Ben");

    const b = renderD5CallScript({
      first_name: "Pat",
      cs_rep_name: "Jamie",
      founder_first_name: "Ben",
      plan_tier: "free",
    });
    expect(b.variant).toBe("cs_rep");
    expect(b.body).toContain("Jamie");
  });
});
