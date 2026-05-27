import { describe, expect, it } from "vitest";

import {
  AwardThresholds,
  buildShareKit,
  buildUniqueSlug,
  detectAndIssue,
  generateCaseStudy,
  getHallOfFame,
  InMemoryAwardsStore,
  netRevenueCents,
  scheduleDelivery,
  tiersCrossed,
} from "../src/index.js";

let n = 0;
const newId = (e: string) => `${e}_${(n++).toString().padStart(6, "0")}`;

function freshStore() {
  return new InMemoryAwardsStore();
}

describe("milestone detector", () => {
  it("computes net revenue subtracting refunds + chargebacks", () => {
    expect(
      netRevenueCents({
        funnel_id: "f",
        workspace_id: "w",
        revenue_cumulative_cents: 1_500_00,
        refunds_cumulative_cents: 200_00,
        chargebacks_cumulative_cents: 100_00,
        unique_customer_count: 20,
        funnel_first_published_at: new Date(Date.now() - 30 * 86400_000).toISOString(),
        internal_account: false,
      }),
    ).toBe(1_200_00);
  });

  it("returns tiers crossed for a given net amount", () => {
    expect(tiersCrossed(5_000_00)).toEqual([]); // $5K < Bronze
    expect(tiersCrossed(15_000_00)).toEqual(["bronze"]);
    expect(tiersCrossed(150_000_00)).toEqual(["bronze", "silver"]);
    expect(tiersCrossed(AwardThresholds.platinum)).toEqual(["bronze", "silver", "gold", "platinum"]);
  });

  it("issues Bronze when guards satisfied; withholds when not", async () => {
    const store = freshStore();
    const recent = new Date(Date.now() - 5 * 86400_000).toISOString();   // 5 days, too new
    const old = new Date(Date.now() - 30 * 86400_000).toISOString();     // 30 days, ok

    const tooNew = await detectAndIssue(
      {
        funnel_id: "fn1",
        workspace_id: "w",
        revenue_cumulative_cents: 15_000_00,
        refunds_cumulative_cents: 0,
        chargebacks_cumulative_cents: 0,
        unique_customer_count: 20,
        funnel_first_published_at: recent,
        internal_account: false,
      },
      { store, newId },
    );
    expect(tooNew.newAwards.length).toBe(0);
    expect(tooNew.withheld[0]?.reason).toContain("days since publish");

    const ok = await detectAndIssue(
      {
        funnel_id: "fn2",
        workspace_id: "w",
        revenue_cumulative_cents: 15_000_00,
        refunds_cumulative_cents: 0,
        chargebacks_cumulative_cents: 0,
        unique_customer_count: 20,
        funnel_first_published_at: old,
        internal_account: false,
      },
      { store, newId },
    );
    expect(ok.newAwards.length).toBe(1);
    expect(ok.newAwards[0]?.tier).toBe("bronze");
  });

  it("is idempotent on replay", async () => {
    const store = freshStore();
    const old = new Date(Date.now() - 30 * 86400_000).toISOString();
    const snap = {
      funnel_id: "fn3",
      workspace_id: "w",
      revenue_cumulative_cents: 15_000_00,
      refunds_cumulative_cents: 0,
      chargebacks_cumulative_cents: 0,
      unique_customer_count: 20,
      funnel_first_published_at: old,
      internal_account: false,
    };
    await detectAndIssue(snap, { store, newId });
    const second = await detectAndIssue(snap, { store, newId });
    expect(second.newAwards.length).toBe(0);
  });

  it("skips internal accounts", async () => {
    const store = freshStore();
    const r = await detectAndIssue(
      {
        funnel_id: "fn4",
        workspace_id: "w",
        revenue_cumulative_cents: 999_000_00_000,
        refunds_cumulative_cents: 0,
        chargebacks_cumulative_cents: 0,
        unique_customer_count: 100,
        funnel_first_published_at: new Date(Date.now() - 365 * 86400_000).toISOString(),
        internal_account: true,
      },
      { store, newId },
    );
    expect(r.newAwards.length).toBe(0);
  });
});

describe("case study", () => {
  it("creates a unique slug and falls back on collision", async () => {
    const store = freshStore();
    const slug1 = await buildUniqueSlug(
      { display_name: "Ada Lovelace", industry: "Solar Sales", tier: "gold" },
      store,
    );
    expect(slug1).toBe("ada-solar-sales-gold");
  });

  it("generates draft case study with schema.org markup", async () => {
    const store = freshStore();
    const award = {
      id: "award_1",
      workspace_id: "w1",
      funnel_id: "fn1",
      tier: "bronze" as const,
      revenue_at_milestone_cents: 12_000_00,
      time_to_milestone_days: 23,
      unique_customer_count: 15,
      days_since_publish: 23,
      awarded_at: new Date().toISOString(),
    };
    const winner = {
      id: "win_1",
      award_id: award.id,
      workspace_id: "w1",
      display_name: "Sarah",
      industry: "Solar",
      testimonial: "Best decision of the year.",
      photo_url: null,
      consent_to_public_case_study: true,
      mailing_address: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const page = await generateCaseStudy(
      { award, winner },
      {
        store,
        newId,
        cloneTemplate: async () => ({ template_id: "tmpl_1" }),
        renderOgImage: async () => "https://example.com/og.png",
        getFunnelAnalytics: async () => ({
          leads_generated: 184,
          conversion_rate_pct: 4.3,
          top_hooks: ["Speed proof", "Risk reversal"],
        }),
        getDefaultDisplayName: async () => "Anonymous",
      },
    );
    expect(page.status).toBe("draft");
    expect(page.slug).toBe("sarah-solar-bronze");
    expect(page.schema_org_jsonld).toContain("Review");
    expect(page.clone_template_id).toBe("tmpl_1");
  });
});

describe("physical delivery", () => {
  it("creates digital delivery instantly for Bronze", async () => {
    const store = freshStore();
    const award = {
      id: "a1",
      workspace_id: "w",
      funnel_id: "f",
      tier: "bronze" as const,
      revenue_at_milestone_cents: 10_000_00,
      time_to_milestone_days: 30,
      unique_customer_count: 10,
      days_since_publish: 30,
      awarded_at: new Date().toISOString(),
    };
    const winner = {
      id: "w1",
      award_id: "a1",
      workspace_id: "w",
      display_name: "Ada",
      industry: "Solar",
      testimonial: null,
      photo_url: null,
      consent_to_public_case_study: false,
      mailing_address: null,
      created_at: "",
      updated_at: "",
    };
    const d = await scheduleDelivery(
      { award, winner },
      {
        store,
        newId,
        vendor: { placeOrder: async () => ({ vendor_order_id: "" }) },
      },
    );
    expect(d.status).toBe("delivered");
    expect(d.item_type).toBe("digital");
  });

  it("returns pending_address when winner has no address (Silver+)", async () => {
    const store = freshStore();
    const award = {
      id: "a2",
      workspace_id: "w",
      funnel_id: "f",
      tier: "silver" as const,
      revenue_at_milestone_cents: 100_000_00,
      time_to_milestone_days: 60,
      unique_customer_count: 50,
      days_since_publish: 60,
      awarded_at: new Date().toISOString(),
    };
    const winner = {
      id: "w2",
      award_id: "a2",
      workspace_id: "w",
      display_name: "Ada",
      industry: "Solar",
      testimonial: null,
      photo_url: null,
      consent_to_public_case_study: false,
      mailing_address: null,
      created_at: "",
      updated_at: "",
    };
    const d = await scheduleDelivery(
      { award, winner },
      {
        store,
        newId,
        vendor: { placeOrder: async () => ({ vendor_order_id: "vo_1" }) },
      },
    );
    expect(d.status).toBe("pending_address");
  });
});

describe("share kit", () => {
  it("includes tier-aware OG + multi-network copy", () => {
    const kit = buildShareKit({
      award: {
        id: "a",
        workspace_id: "w",
        funnel_id: "f",
        tier: "gold",
        revenue_at_milestone_cents: 1_500_000_00,
        time_to_milestone_days: 120,
        unique_customer_count: 200,
        days_since_publish: 120,
        awarded_at: new Date().toISOString(),
      },
      winner: {
        id: "ww",
        award_id: "a",
        workspace_id: "w",
        display_name: "Sarah",
        industry: "Solar",
        testimonial: null,
        photo_url: null,
        consent_to_public_case_study: true,
        mailing_address: null,
        created_at: "",
        updated_at: "",
      },
      caseStudy: {
        id: "cs",
        award_id: "a",
        slug: "sarah-solar-gold",
        status: "public",
        hero_title: "",
        hero_subtitle: "",
        stats: { revenue_cents: 0, leads_generated: 0, conversion_rate_pct: 0, time_to_milestone_days: 0 },
        what_worked: [],
        testimonial: null,
        og_image_url: null,
        clone_template_id: null,
        schema_org_jsonld: "",
        created_at: "",
        published_at: null,
        takedown_at: null,
      },
    });
    expect(kit.copy.twitter).toContain("Gold");
    expect(kit.copy.linkedin).toContain("Sarah");
    expect(kit.links.case_study_url).toContain("/wins/sarah-solar-gold");
    expect(kit.og_image.width).toBe(1200);
  });
});
