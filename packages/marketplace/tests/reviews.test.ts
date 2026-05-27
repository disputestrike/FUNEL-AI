import { describe, expect, it } from "vitest";

import { flagReview, replyToReview, submitReview } from "../src/reviews.js";
import { handleStripeWebhook, purchaseTemplate } from "../src/purchases.js";
import { publishTemplate } from "../src/templates.js";
import type { StripePort } from "../src/port.js";
import { makeFunnel, makeInMemoryDb } from "./inMemoryDb.js";

function fakeStripe(): StripePort {
  let id = 0;
  return {
    async createCheckoutSession() {
      id++;
      return { session_id: `cs_${id}`, checkout_url: "https://x" };
    },
    async retrieveSessionFromWebhook(rawBody) {
      const p = JSON.parse(rawBody) as { session_id: string };
      return {
        session_id: p.session_id,
        payment_intent_id: `pi_${p.session_id}`,
        charge_id: `ch_${p.session_id}`,
        amount_total_usd_cents: 0,
        application_fee_amount_usd_cents: 0,
        metadata: {},
        livemode: false,
      };
    },
    async refundCharge() {
      return { refund_id: "x" };
    },
    async payoutToConnectedAccount() {
      return { transfer_id: "x" };
    },
  };
}

async function seed(): Promise<{
  db: ReturnType<typeof makeInMemoryDb>;
  templateId: string;
  buyerId: string;
  creatorId: string;
}> {
  const funnel = makeFunnel();
  const db = makeInMemoryDb({ funnels: [funnel] });
  const stripe = fakeStripe();
  const { template } = await publishTemplate(
    { db },
    {
      funnel_id: funnel.id,
      creator_id: funnel.created_by,
      price_usd_cents: 2_900,
      category: "real_estate",
      secondary_categories: [],
      title: "Reviews Test Funnel",
      description: "A long-enough description for the reviews test seed funnel template here.",
      tags: ["t1"],
    },
  );
  await db.updateTemplate(template.id, { status: "published", published_at: new Date().toISOString() });
  const t0 = new Date("2026-04-01T00:00:00Z").getTime();
  const ctxBuy = { db, stripe, base_url: "https://x", now: () => new Date(t0) };
  const { purchase } = await purchaseTemplate(ctxBuy, template.id, "wsp_buyer_rv", "usr_buyer_rv");
  await handleStripeWebhook(
    ctxBuy,
    JSON.stringify({ session_id: purchase.stripe_checkout_session_id }),
    "sig",
  );
  return { db, templateId: template.id, buyerId: "usr_buyer_rv", creatorId: funnel.created_by };
}

describe("submitReview", () => {
  it("requires a 7-day waiting period after purchase", async () => {
    const { db, templateId, buyerId } = await seed();
    // Now = same day as purchase → rejected.
    await expect(
      submitReview(
        { db, now: () => new Date("2026-04-02T00:00:00Z") },
        { template_id: templateId, reviewer_user_id: buyerId, stars: 5, comment: "Great template!" },
      ),
    ).rejects.toThrow(/waiting/);

    // 8 days later → allowed.
    const r = await submitReview(
      { db, now: () => new Date("2026-04-09T00:00:00Z") },
      { template_id: templateId, reviewer_user_id: buyerId, stars: 5, comment: "Great template!" },
    );
    expect(r.status).toBe("visible");
    expect(r.stars).toBe(5);
  });

  it("blocks self-review by creator", async () => {
    const { db, templateId, creatorId } = await seed();
    await expect(
      submitReview(
        { db, now: () => new Date("2026-04-10T00:00:00Z") },
        { template_id: templateId, reviewer_user_id: creatorId, stars: 5, comment: "Mine is great" },
      ),
    ).rejects.toThrow(/own template/);
  });

  it("queues profane reviews for moderation", async () => {
    const { db, templateId, buyerId } = await seed();
    const r = await submitReview(
      { db, now: () => new Date("2026-04-09T00:00:00Z") },
      {
        template_id: templateId,
        reviewer_user_id: buyerId,
        stars: 1,
        comment: "this is shit shit shit shit shit shit shit",
      },
    );
    expect(r.status).toBe("pending_moderation");
  });
});

describe("flagReview / replyToReview", () => {
  it("creator can reply once", async () => {
    const { db, templateId, buyerId, creatorId } = await seed();
    const r = await submitReview(
      { db, now: () => new Date("2026-04-09T00:00:00Z") },
      { template_id: templateId, reviewer_user_id: buyerId, stars: 4, comment: "Good template overall" },
    );
    const replied = await replyToReview({ db }, r.id, creatorId, "Thanks!");
    expect(replied.creator_reply).toBe("Thanks!");
    await expect(replyToReview({ db }, r.id, creatorId, "again")).rejects.toThrow(/already/);
  });

  it("flagging 3 times moves review to moderation", async () => {
    const { db, templateId, buyerId } = await seed();
    const r = await submitReview(
      { db, now: () => new Date("2026-04-09T00:00:00Z") },
      { template_id: templateId, reviewer_user_id: buyerId, stars: 2, comment: "ok template idk" },
    );
    await flagReview({ db }, r.id, "usr_a", "spam");
    await flagReview({ db }, r.id, "usr_b", "spam");
    const r2 = await flagReview({ db }, r.id, "usr_c", "spam");
    expect(r2.status).toBe("pending_moderation");
  });
});
