import { describe, expect, it } from "vitest";

import {
  computeShares,
  handleStripeWebhook,
  purchaseTemplate,
  refundPurchase,
  REFUND_WINDOW_DAYS,
} from "../src/purchases.js";
import { publishTemplate } from "../src/templates.js";
import type { StripePort } from "../src/port.js";
import { makeFunnel, makeInMemoryDb, nowSeq } from "./inMemoryDb.js";

function fakeStripe(): StripePort & { lastSession?: unknown; refunded: { charge: string; amount: number }[] } {
  let id = 0;
  const refunded: { charge: string; amount: number }[] = [];
  return {
    refunded,
    async createCheckoutSession(args) {
      id++;
      const session_id = `cs_test_${id}`;
      this.lastSession = { args, session_id };
      return { session_id, checkout_url: `https://stripe/${session_id}` };
    },
    async retrieveSessionFromWebhook(rawBody) {
      const parsed = JSON.parse(rawBody) as {
        session_id: string;
        metadata?: Record<string, string>;
        amount?: number;
      };
      return {
        session_id: parsed.session_id,
        payment_intent_id: `pi_${parsed.session_id}`,
        charge_id: `ch_${parsed.session_id}`,
        amount_total_usd_cents: parsed.amount ?? 2900,
        application_fee_amount_usd_cents: 0,
        metadata: parsed.metadata ?? {},
        livemode: false,
      };
    },
    async refundCharge(args) {
      refunded.push({ charge: args.charge_id, amount: args.amount_usd_cents });
      return { refund_id: `re_${args.charge_id}` };
    },
    async payoutToConnectedAccount() {
      return { transfer_id: "tr_test" };
    },
  };
}

describe("computeShares", () => {
  it("splits 70/30 of net after Stripe fee", () => {
    const shares = computeShares(2_900);
    // fee = 2900 * 2.9% + 30 = 84.1 + 30 = ~114 ; net = 2786 ; creator = 1950 ; platform = 836
    expect(shares.stripe_fee).toBe(114);
    expect(shares.net).toBe(2_786);
    expect(shares.creator_share + shares.platform_share).toBe(shares.net);
    expect(shares.creator_share).toBe(Math.floor((2_786 * 7_000) / 10_000));
  });

  it("free templates produce zeros", () => {
    expect(computeShares(0)).toEqual({ stripe_fee: 0, net: 0, creator_share: 0, platform_share: 0 });
  });
});

describe("purchaseTemplate (paid) + webhook", () => {
  it("creates a pending purchase + Stripe session, then marks paid + clones on webhook", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    await db.upsertPayoutAccount({
      creator_id: funnel.created_by,
      method: "stripe_connect",
      account_ref: "acct_creator",
      country: "US",
      tax_form: "w9",
      tax_form_received_at: new Date().toISOString(),
      lifetime_usd_cents: 0,
      current_year_usd_cents: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const stripe = fakeStripe();

    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 2_900,
        category: "real_estate",
        secondary_categories: [],
        title: "Real Estate Lead Funnel",
        description:
          "Detailed description of a real estate funnel that is sufficiently long for the description rules.",
        tags: ["leads"],
      },
    );
    // Manually mark approved + published (content-ops simulation)
    await db.updateTemplate(template.id, {
      status: "published",
      published_at: new Date().toISOString(),
    });

    const ctx = { db, stripe, base_url: "https://app.test", now: nowSeq() };
    const { purchase } = await purchaseTemplate(ctx, template.id, "wsp_buyer", "usr_buyer");
    expect(purchase.status).toBe("pending");
    expect(purchase.stripe_checkout_session_id).toBe("cs_test_1");

    const webhookBody = JSON.stringify({
      session_id: purchase.stripe_checkout_session_id,
      metadata: { purchase_id: purchase.id },
      amount: 2_900,
    });
    const result = await handleStripeWebhook(ctx, webhookBody, "sig_dummy");
    expect(result.status).toBe("processed");
    expect(result.purchase?.status).toBe("paid");
    expect(result.purchase?.cloned_funnel_id).toBe("fnl_clone_1");

    // Replaying the webhook is a no-op.
    const replay = await handleStripeWebhook(ctx, webhookBody, "sig_dummy");
    expect(replay.status).toBe("duplicate");
  });

  it("blocks self-purchase (creator buying own template)", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    const stripe = fakeStripe();
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 2_900,
        category: "real_estate",
        secondary_categories: [],
        title: "Self-Purchase Test",
        description: "Detailed description that satisfies the minimum length validation rules.",
        tags: ["t1"],
      },
    );
    await db.updateTemplate(template.id, {
      status: "published",
      published_at: new Date().toISOString(),
    });
    await expect(
      purchaseTemplate(
        { db, stripe, base_url: "https://app.test" },
        template.id,
        "wsp_creator",
        funnel.created_by,
      ),
    ).rejects.toThrow(/Self-purchase/);
  });
});

describe("refundPurchase", () => {
  it("refunds within the 14-day window and clamps amount", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    await db.upsertPayoutAccount({
      creator_id: funnel.created_by,
      method: "stripe_connect",
      account_ref: "acct_creator",
      country: "US",
      tax_form: "w9",
      tax_form_received_at: new Date().toISOString(),
      lifetime_usd_cents: 0,
      current_year_usd_cents: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const stripe = fakeStripe();
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 9_900,
        category: "real_estate",
        secondary_categories: [],
        title: "Refund Test Funnel",
        description: "Refund test funnel description that is long enough to satisfy validation.",
        tags: ["leads"],
      },
    );
    await db.updateTemplate(template.id, { status: "published", published_at: new Date().toISOString() });
    const ctx = { db, stripe, base_url: "https://app.test", now: nowSeq() };
    const { purchase } = await purchaseTemplate(ctx, template.id, "wsp_buyer", "usr_buyer");
    await handleStripeWebhook(
      ctx,
      JSON.stringify({ session_id: purchase.stripe_checkout_session_id, amount: 9_900 }),
      "sig",
    );

    const refunded = await refundPurchase(ctx, {
      purchase_id: purchase.id,
      amount_usd_cents: 5_000,
      reason: "customer_request",
      actor_user_id: "usr_buyer",
    });
    expect(refunded.status).toBe("partially_refunded");
    expect(refunded.refund_amount_usd_cents).toBe(5_000);
    expect(stripe.refunded.length).toBe(1);

    // Refund the rest → fully refunded.
    const fully = await refundPurchase(ctx, {
      purchase_id: purchase.id,
      amount_usd_cents: 4_900,
      reason: "customer_request",
      actor_user_id: "usr_buyer",
    });
    expect(fully.status).toBe("refunded");
  });

  it("blocks refunds after window expiry", async () => {
    const funnel = makeFunnel();
    const db = makeInMemoryDb({ funnels: [funnel] });
    const stripe = fakeStripe();
    const { template } = await publishTemplate(
      { db, now: nowSeq() },
      {
        funnel_id: funnel.id,
        creator_id: funnel.created_by,
        price_usd_cents: 2_900,
        category: "real_estate",
        secondary_categories: [],
        title: "Expired Refund Test",
        description: "Test refund expiry. Description must be at least 40 chars in length.",
        tags: ["t1"],
      },
    );
    await db.updateTemplate(template.id, { status: "published", published_at: new Date().toISOString() });
    const t0 = new Date("2026-05-26T12:00:00Z").getTime();
    const ctxBuy = { db, stripe, base_url: "https://app.test", now: () => new Date(t0) };
    const { purchase } = await purchaseTemplate(ctxBuy, template.id, "wsp_buyer", "usr_buyer");
    await handleStripeWebhook(
      ctxBuy,
      JSON.stringify({ session_id: purchase.stripe_checkout_session_id, amount: 2_900 }),
      "sig",
    );
    // Jump past the window.
    const tLate = t0 + (REFUND_WINDOW_DAYS + 2) * 86_400_000;
    await expect(
      refundPurchase(
        { db, stripe, base_url: "https://app.test", now: () => new Date(tLate) },
        { purchase_id: purchase.id, reason: "x", actor_user_id: "usr_buyer" },
      ),
    ).rejects.toThrow(/expired/);
  });
});
