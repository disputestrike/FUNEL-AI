import { describe, expect, it } from "vitest";

import {
  BRONZE_THRESHOLD_USD_CENTS,
  publishTemplate,
  unpublishTemplate,
  updateTemplate,
} from "../src/templates.js";
import { makeFunnel, makeInMemoryDb, nowSeq } from "./inMemoryDb.js";

describe("publishTemplate", () => {
  it("publishes a paid template once Bronze gate is met", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    const ctx = { db, now: nowSeq() };
    const { template, version } = await publishTemplate(ctx, {
      funnel_id: funnel.id,
      creator_id: funnel.created_by,
      price_usd_cents: 2900,
      category: "real_estate",
      secondary_categories: [],
      title: "Real Estate Lead Funnel",
      description:
        "A high-converting real estate lead generation funnel including landing, optin, and follow-up sequences.",
      tags: ["leads", "realestate"],
    });
    expect(template.status).toBe("in_review");
    expect(template.bronze_qualified).toBe(true);
    expect(version.passed_automated_checks).toBe(true);
    expect(version.template_id).toBe(template.id);
  });

  it("blocks paid templates if Bronze revenue is not met", async () => {
    const funnel = makeFunnel({ lifetime_revenue_usd_cents: BRONZE_THRESHOLD_USD_CENTS - 1 });
    const db = makeInMemoryDb({ funnels: [funnel] });
    await expect(
      publishTemplate(
        { db, now: nowSeq() },
        {
          funnel_id: funnel.id,
          creator_id: funnel.created_by,
          price_usd_cents: 900,
          category: "real_estate",
          secondary_categories: [],
          title: "Real Estate Lead Funnel",
          description:
            "Has lots of detail to satisfy the length requirement of the description field — at least 40 chars.",
          tags: ["leads"],
        },
      ),
    ).rejects.toThrow(/Bronze/);
  });

  it("allows free templates regardless of Bronze", async () => {
    const funnel = makeFunnel({ lifetime_revenue_usd_cents: 0 });
    const db = makeInMemoryDb({ funnels: [funnel] });
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 0,
        category: "coaching",
        secondary_categories: [],
        title: "Free Coaching Optin",
        description:
          "Free template for coaches. Has enough copy to satisfy QA and description min length.",
        tags: ["coaching"],
      },
    );
    expect(template.status).toBe("published");
    expect(template.published_at).not.toBeNull();
  });

  it("scrubs creator integration secrets from the version bundle", async () => {
    const funnel = makeFunnel({
      funnel_blob: {
        pages: [{ id: "p1", title: "Hi" }],
        integration_credentials: { stripe: "sk_live_ABCDEFG1234567890XYZ" },
        stripe_account_id: "acct_creator",
      },
    });
    const db = makeInMemoryDb({ funnels: [funnel] });
    const { version } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 1900,
        category: "real_estate",
        secondary_categories: [],
        title: "Has Secrets",
        description: "This template has secrets which should be scrubbed during the QA pass.",
        tags: ["t1"],
      },
    );
    const json = JSON.stringify(version.funnel_blob);
    expect(json).not.toContain("sk_live_ABCDEFG1234567890XYZ");
    expect(json).not.toContain("acct_creator");
  });
});

describe("updateTemplate + unpublishTemplate", () => {
  it("updates description but not price-to-paid without Bronze", async () => {
    const funnel = makeFunnel({ lifetime_revenue_usd_cents: 0 });
    const db = makeInMemoryDb({ funnels: [funnel] });
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 0,
        category: "coaching",
        secondary_categories: [],
        title: "Free Optin",
        description: "A reasonable description that is long enough to satisfy the validation rules.",
        tags: ["coaching"],
      },
    );
    const updated = await updateTemplate({ db, now: nowSeq() }, template.id, {
      description: "An even better description that is longer than the minimum required length.",
    });
    expect(updated.description).toContain("better");
    await expect(
      updateTemplate({ db, now: nowSeq() }, template.id, { price_usd_cents: 1900 }),
    ).rejects.toThrow(/Bronze/);
  });

  it("only the creator can unpublish", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 0,
        category: "real_estate",
        secondary_categories: [],
        title: "Real Estate Optin",
        description: "Real estate optin funnel that passes QA and length validation.",
        tags: ["t1"],
      },
    );
    await expect(
      unpublishTemplate({ db, now: nowSeq() }, template.id, "usr_someone_else"),
    ).rejects.toThrow(/creator/);
    const paused = await unpublishTemplate({ db, now: nowSeq() }, template.id, funnel.created_by);
    expect(paused.status).toBe("paused");
  });
});
