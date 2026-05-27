import { describe, expect, it } from "vitest";

import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeUrl,
  hashEmail,
  InMemorySuppressionStore,
  listTemplateIds,
  send,
  shouldThrottle,
  TEMPLATES,
} from "../src/index.js";
import type { Email, SendInput } from "../src/index.js";

class CapturingEmail implements Email {
  public last: SendInput | null = null;
  async send(input: SendInput) {
    this.last = input;
    return { message_id: "mid_test", accepted: true };
  }
}

describe("template registry", () => {
  it("contains exactly 47 templates", () => {
    expect(listTemplateIds().length).toBe(47);
  });

  it("every template can render without crashing", async () => {
    for (const [id, t] of Object.entries(TEMPLATES)) {
      const out = await t.render({
        amount_usd: 1234,
        tier: "bronze",
        time_to_milestone_days: 10,
        funnel_name: "Test",
        lead_name: "Lead",
        plan: "Starter",
        card_last4: "4242",
        first_name: "Ada",
        new_email: "a@b.com",
        old_email: "x@y.com",
        verify_url: "https://x.com",
        reset_url: "https://x.com",
        secure_url: "https://x.com",
        revoke_url: "https://x.com",
        accept_url: "https://x.com",
        team_url: "https://x.com",
        resend_url: "https://x.com",
        billing_url: "https://x.com",
        update_url: "https://x.com",
        invoice_url: "https://x.com",
        receipt_url: "https://x.com",
        funnel_url: "https://x.com",
        view_url: "https://x.com",
        appeal_url: "https://x.com",
        restore_url: "https://x.com",
        data_url: "https://x.com",
        case_study_url: "https://x.com",
        app_url: "https://x.com",
        community_url: "https://x.com",
        challenge_url: "https://x.com",
        cohort_starts_at: "next Monday",
        grader_url: "https://x.com",
        dashboard_url: "https://x.com",
        inbox_url: "https://x.com",
        manage_url: "https://x.com",
        confirm_url: "https://x.com",
        reactivate_url: "https://x.com",
        at: "2026-05-26",
        changed_at: "2026-05-26",
        retry_at: "2026-05-30",
        pause_at: "2026-06-05",
        next_charge_at: "2026-06-26",
        effective_at: "2026-06-26",
        expires_at: "2026-06-26",
        active_through: "2026-06-26",
        purge_after: "2026-08-26",
        trial_ends_at: "2026-06-02",
        paid_at: "2026-05-26",
        from_plan: "Starter",
        to_plan: "Growth",
        role: "admin",
        from_role: "viewer",
        to_role: "admin",
        actor_name: "Ada",
        inviter_name: "Ada",
        workspace_name: "Acme",
        member_name: "Bo",
        removed_by_name: "Ada",
        current_owner_name: "Ada",
        from_user_name: "Ada",
        to_user_name: "Bo",
        factor: "totp",
        reenable_url: "https://x.com",
        location: "Phoenix, AZ",
        device: "MacBook Air",
        ip: "1.2.3.4",
        score: 91,
        winner_variant: "B",
        loser_variant: "A",
        lift_pct: 41,
        leads: 17,
        bookings: 9,
        pipeline_usd: 4200,
        top_funnel_name: "Solar Lead Magnet",
        best_funnel_name: "Solar Lead Magnet",
        best_funnel_lift_pct: 21,
        monthly_usd: 149,
        proration_usd: 87.4,
        amount_owed_usd: 49,
        reason: "test reason",
        description: "weird login",
        endpoint_url: "https://hook.example/x",
        events_subscribed: ["new_lead"],
        prefix: "abc12345",
        created_by_name: "Ada",
        revoked_by_name: "Ada",
        items: [],
        count: 0,
        lead_location: "Phoenix",
        funnel_id: "fnl_1",
      });
      expect(out.html.length).toBeGreaterThan(20);
      expect(out.text.length).toBeGreaterThan(5);
      expect(out.subject.length).toBeGreaterThan(0);
    }
  });
});

describe("send pipeline", () => {
  it("respects the suppression list", async () => {
    const email = new CapturingEmail();
    const sup = new InMemorySuppressionStore();
    await sup.add({
      email_hash: await hashEmail("ada@example.com"),
      reason: "unsubscribe",
      source: "test",
      added_at: new Date().toISOString(),
    });
    const r = await send(
      { to: "ada@example.com", template: "welcome", data: { first_name: "Ada", app_url: "https://x" } },
      { email, suppression: sup },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("suppressed");
    expect(email.last).toBeNull();
  });

  it("rejects unknown templates with audit", async () => {
    const email = new CapturingEmail();
    const sup = new InMemorySuppressionStore();
    const r = await send(
      { to: "ada@example.com", template: "no_such_template", data: {} },
      { email, suppression: sup },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown_template");
  });

  it("sets List-Unsubscribe headers on Send", async () => {
    const email = new CapturingEmail();
    const sup = new InMemorySuppressionStore();
    await send(
      {
        to: "ada@example.com",
        template: "welcome",
        data: { first_name: "Ada", app_url: "https://x" },
        unsubscribe_token: "tok123",
        unsubscribe_category: "marketing",
      },
      { email, suppression: sup },
    );
    expect(email.last?.data["List-Unsubscribe"]).toBeTruthy();
    expect(email.last?.data["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("deliverability", () => {
  it("throttles when bounce > 5%", () => {
    expect(shouldThrottle({ domain: "x.com", bounces_24h: 60, complaints_24h: 0, sends_24h: 1000 })).toBe(true);
    expect(shouldThrottle({ domain: "x.com", bounces_24h: 20, complaints_24h: 0, sends_24h: 1000 })).toBe(false);
  });
});

describe("unsubscribe", () => {
  it("builds RFC 8058 headers", () => {
    const headers = buildListUnsubscribeHeaders("https://x.com/u?t=abc");
    expect(headers["List-Unsubscribe"]).toContain("https://x.com");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
  it("builds an unsubscribe URL", () => {
    const url = buildUnsubscribeUrl(
      { user_id: "usr_1", email: "a@b.com", category: "marketing", expires_at: new Date().toISOString() },
      "signed_token",
    );
    expect(url).toContain("c=marketing");
    expect(url).toContain("t=signed_token");
  });
});
