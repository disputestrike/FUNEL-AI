import { describe, expect, it } from "vitest";

import {
  fireD0Welcome,
  fireD14Exit,
  fireD14PaidAsk,
  fireD1ConnectSource,
  fireD2NoSource,
  fireD3NoLead,
  fireD4Community,
  fireD5Concierge,
  fireD7Activated,
  fireD7NotActivated,
  onD2YesReply,
} from "../src/triggers/index.js";
import {
  InMemoryAwards,
  InMemoryReferrals,
  makeState,
  makeTriggerDeps,
} from "./_helpers.js";

describe("Day 0 — Welcome", () => {
  it("sends Resend email + enqueues in-app takeover", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain("welcome_d0");
    expect(deps._notifications.messages.map((m) => m.template_id)).toContain(
      "welcome_takeover_d0",
    );
  });

  it("rerun does NOT double-send (dedupe via intervention_history)", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent.filter((e) => e.template_id === "welcome_d0")).toHaveLength(1);
  });

  it("Scale tier triggers #cs-vip Slack ping", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ plan_tier: "scale" }));
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      variables: { first_name: "Pat" },
    });
    expect(deps._slack.posts.find((p) => p.channel === "#cs-vip")).toBeTruthy();
  });

  it("respects email opt-out", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ email_opt_out: true }));
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent).toHaveLength(0);
  });

  it("skips suspended workspaces", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ workspace_suspended: true }));
    await fireD0Welcome({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent).toHaveLength(0);
  });
});

describe("Day 1 — Connect source", () => {
  it("fires email + tooltip when no source connected", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD1ConnectSource({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "source_reminder_d1",
    );
    expect(deps._notifications.messages.map((m) => m.template_id)).toContain(
      "connect_source_tooltip",
    );
  });

  it("suppresses when source already connected", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(
      makeState({ source_connected_at: "2026-05-01T01:00:00Z" }),
    );
    await fireD1ConnectSource({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent).toHaveLength(0);
  });
});

describe("Day 2 — No source", () => {
  it("sends SignalWire SMS when SMS opt-out is false", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD2NoSource({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      first_name: "Pat",
    });
    expect(deps._sms.sent).toHaveLength(1);
    expect(deps._sms.sent[0]?.body).toContain("Pat");
  });

  it("falls back to email when revtry_sms_opt_out is set", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ revtry_sms_opt_out: true }));
    await fireD2NoSource({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._sms.sent).toHaveLength(0);
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "source_reminder_d1",
    );
  });

  it("onD2YesReply triggers a RevTry callback within 5 min", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    deps._revtry.yesReplies.add("usr_test");
    const r = await onD2YesReply({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(r.called).toBe(true);
    expect(deps._revtry.calls[deps._revtry.calls.length - 1]?.purpose).toBe(
      "oauth_screenshare",
    );
  });
});

describe("Day 3 — No lead", () => {
  it("sends founder personal email", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD3NoLead({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      founder_first_name: "Ben",
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain("founder_d3");
  });

  it("suppresses if lead already captured", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(
      makeState({ first_lead_at: "2026-05-01T00:00:00Z" }),
    );
    await fireD3NoLead({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent).toHaveLength(0);
  });
});

describe("Day 4 — Community", () => {
  it("sends industry-specific email + banner", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ industry: "coaching" }));
    await fireD4Community({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent[0]?.vars.community_link).toContain("coaching");
  });
});

describe("Day 5 — Concierge", () => {
  it("creates concierge_call task for free tier", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD5Concierge({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._cs.tasks[0]?.kind).toBe("concierge_call");
    expect(deps._email.sent).toHaveLength(0); // no founder email for free tier
  });

  it("Scale tier escalates to founder personal task + email", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ plan_tier: "scale" }));
    await fireD5Concierge({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._cs.tasks[0]?.kind).toBe("founder_personal");
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "founder_concierge_d5",
    );
  });

  it("Agency tier also escalates to founder", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ plan_tier: "agency" }));
    await fireD5Concierge({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._cs.tasks[0]?.kind).toBe("founder_personal");
  });
});

describe("Day 7 — Activated", () => {
  it("mints Bronze + asks referral + sends milestone email", async () => {
    const deps = makeTriggerDeps();
    const awards = new InMemoryAwards();
    const referrals = new InMemoryReferrals();
    await deps._store.save(
      makeState({ activated_at: "2026-05-06T00:00:00Z" }),
    );
    await fireD7Activated({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      awards,
      referrals,
    });
    expect(awards.minted).toHaveLength(1);
    expect(referrals.asks).toHaveLength(1);
    expect(deps._email.sent[0]?.template_id).toBe("awards_bronze_milestone");
  });

  it("suppresses when user is not activated", async () => {
    const deps = makeTriggerDeps();
    const awards = new InMemoryAwards();
    const referrals = new InMemoryReferrals();
    await deps._store.save(makeState());
    await fireD7Activated({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      awards,
      referrals,
    });
    expect(deps._email.sent).toHaveLength(0);
  });
});

describe("Day 7 — Not activated (save offer)", () => {
  it("extends Pro Boost + sends save email", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState({ plan_tier: "pro_boost" }));
    await fireD7NotActivated({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._store.states.get("usr_test")?.pro_boost_extended_at).toBeTruthy();
    expect(deps._email.sent.map((e) => e.template_id)).toContain("save_offer_d7");
  });

  it("does not double-extend Pro Boost", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(
      makeState({
        pro_boost_extended_at: "2026-05-08T00:00:00Z",
        pro_boost_extends_until: "2026-05-15T00:00:00Z",
      }),
    );
    await fireD7NotActivated({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._store.states.get("usr_test")?.pro_boost_extends_until).toBe(
      "2026-05-15T00:00:00Z",
    );
    // The save email STILL goes out — extension is already in effect.
    expect(deps._email.sent.map((e) => e.template_id)).toContain("save_offer_d7");
  });
});

describe("Day 14 — Paid upgrade ask", () => {
  it("sends upgrade email + in-app modal for activated free user", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(
      makeState({
        plan_tier: "free",
        activated_at: "2026-05-08T00:00:00Z",
        first_lead_at: "2026-05-05T00:00:00Z",
      }),
    );
    await fireD14PaidAsk({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "upgrade_ask_d14",
    );
    expect(deps._notifications.messages.map((m) => m.template_id)).toContain(
      "upgrade_ask_d14",
    );
  });

  it("switches to cross-sell for paid users", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(
      makeState({
        plan_tier: "pro",
        activated_at: "2026-05-08T00:00:00Z",
      }),
    );
    await fireD14PaidAsk({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "crosssell_revtry_silver",
    );
  });

  it("suppresses if user not activated", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD14PaidAsk({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._email.sent).toHaveLength(0);
  });
});

describe("Day 14 — Exit", () => {
  it("recent login → exit survey email", async () => {
    const deps = makeTriggerDeps();
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await deps._store.save(
      makeState({ signed_up_at: "2026-05-01T00:00:00Z", last_action_at: recent }),
    );
    await fireD14Exit({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      last_login_at: recent,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain("exit_survey_d14");
  });

  it("dormant 7+ days → reengagement pause", async () => {
    const deps = makeTriggerDeps();
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await deps._store.save(
      makeState({ signed_up_at: old, last_action_at: old }),
    );
    await fireD14Exit({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
      last_login_at: old,
    });
    expect(deps._email.sent.map((e) => e.template_id)).toContain(
      "reengagement_pause_d14",
    );
  });

  it("always creates final_outreach CS task", async () => {
    const deps = makeTriggerDeps();
    await deps._store.save(makeState());
    await fireD14Exit({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      deps,
    });
    expect(deps._cs.tasks[0]?.kind).toBe("final_outreach");
    expect(deps._cs.tasks[0]?.assignee_role).toBe("cs_lead");
  });
});
