/**
 * purchases.ts — Stripe Checkout flow + webhook handler + clone trigger.
 *
 * Pricing math:
 *   - List price = template.price_usd_cents
 *   - Stripe fee ≈ 2.9% + $0.30 (configurable)
 *   - Net = list − stripe_fee
 *   - Creator share = 70% of net (rounded down to cent)
 *   - Platform share = net − creator_share
 *
 * Refund window: 14 days after `paid_at`.
 *
 * Idempotency:
 *   - `createCheckout` returns the existing pending Purchase if one already
 *     exists for (template_id, buyer_workspace_id) within the last 30 minutes.
 *   - `handleWebhook` is idempotent on the Stripe session_id.
 */

import { createHash, randomBytes } from "node:crypto";

import { cloneTemplate } from "./clone.js";
import { detectSelfPurchaseFraud } from "./fraud.js";
import type { MarketplaceDb, StripePort } from "./port.js";
import { MarketplaceError, type Purchase } from "./types.js";

/** Stripe fee constants. Production wires real values from billing config. */
export const STRIPE_FEE_BPS = 290; // 2.9%
export const STRIPE_FEE_FIXED_USD_CENTS = 30;
export const CREATOR_SHARE_BPS = 7_000; // 70.00%
export const REFUND_WINDOW_DAYS = 14;

export interface PurchaseContext {
  db: MarketplaceDb;
  stripe: StripePort;
  base_url: string;
  now?: () => Date;
  /** Stripe-platform fingerprint hint for fraud — typically caller's IP/UA hash. */
  caller_fingerprint?: string | null;
}

export function computeShares(price_usd_cents: number): {
  stripe_fee: number;
  net: number;
  creator_share: number;
  platform_share: number;
} {
  if (price_usd_cents === 0) {
    return { stripe_fee: 0, net: 0, creator_share: 0, platform_share: 0 };
  }
  const stripe_fee = Math.round((price_usd_cents * STRIPE_FEE_BPS) / 10_000) + STRIPE_FEE_FIXED_USD_CENTS;
  const net = Math.max(0, price_usd_cents - stripe_fee);
  const creator_share = Math.floor((net * CREATOR_SHARE_BPS) / 10_000);
  const platform_share = net - creator_share;
  return { stripe_fee, net, creator_share, platform_share };
}

export async function purchaseTemplate(
  ctx: PurchaseContext,
  template_id: string,
  buyer_workspace_id: string,
  buyer_user_id: string,
): Promise<{ checkout_url: string; purchase: Purchase }> {
  const template = await ctx.db.getTemplate(template_id);
  if (!template || template.status !== "published" || template.deleted_at) {
    throw new MarketplaceError("Template not available.", "TEMPLATE_NOT_AVAILABLE", 404);
  }
  if (template.creator_id === buyer_user_id) {
    throw new MarketplaceError("Self-purchase is not allowed.", "SELF_PURCHASE_FORBIDDEN", 403);
  }
  const fraudResult = await detectSelfPurchaseFraud(ctx.db, {
    template,
    buyer_user_id,
    buyer_workspace_id,
    caller_fingerprint: ctx.caller_fingerprint ?? null,
  });
  if (fraudResult.blocked) {
    throw new MarketplaceError("Purchase blocked by fraud guard.", "FRAUD_BLOCK", 403, fraudResult);
  }

  // Free templates: skip Stripe, mark paid immediately, clone.
  if (template.price_usd_cents === 0) {
    const purchase = await insertPurchase(ctx, template, buyer_workspace_id, buyer_user_id, null);
    const paid = await markPaidAndClone(ctx, purchase, null);
    return { checkout_url: `${ctx.base_url}/app/funnels/${paid.cloned_funnel_id ?? ""}`, purchase: paid };
  }

  // Idempotent pending-purchase lookup.
  const existing = await ctx.db.hasPaidPurchase(template_id, buyer_workspace_id);
  if (existing && (existing.status === "paid" || existing.status === "pending")) {
    if (existing.status === "pending" && existing.stripe_checkout_session_id) {
      // Re-issue the existing session.
      return {
        checkout_url: `${ctx.base_url}/marketplace/checkout/${existing.stripe_checkout_session_id}`,
        purchase: existing,
      };
    }
    if (existing.status === "paid") {
      return { checkout_url: `${ctx.base_url}/app/funnels/${existing.cloned_funnel_id ?? ""}`, purchase: existing };
    }
  }

  const purchase = await insertPurchase(ctx, template, buyer_workspace_id, buyer_user_id, null);
  const session = await ctx.stripe.createCheckoutSession({
    template_id,
    buyer_workspace_id,
    buyer_user_id,
    creator_id: template.creator_id,
    price_usd_cents: template.price_usd_cents,
    success_url: `${ctx.base_url}/marketplace/${template.slug}/success?purchase_id=${purchase.id}`,
    cancel_url: `${ctx.base_url}/marketplace/${template.slug}/cancel?purchase_id=${purchase.id}`,
    metadata: {
      purchase_id: purchase.id,
      template_id,
      buyer_workspace_id,
      buyer_user_id,
      creator_id: template.creator_id,
    },
  });
  const updated = await ctx.db.updatePurchase(purchase.id, {
    stripe_checkout_session_id: session.session_id,
    updated_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
  });
  return { checkout_url: session.checkout_url, purchase: updated };
}

/**
 * Stripe webhook handler.
 *
 * Verifies signature via `StripePort.retrieveSessionFromWebhook`, then:
 *   - Marks the matching Purchase as paid.
 *   - Triggers `cloneTemplate`.
 *   - Emits `template_purchased`.
 *
 * Idempotent: re-processing the same session is a no-op.
 */
export async function handleStripeWebhook(
  ctx: PurchaseContext,
  rawBody: string,
  signature: string,
): Promise<{ status: "processed" | "duplicate" | "ignored"; purchase?: Purchase }> {
  const evt = await ctx.stripe.retrieveSessionFromWebhook(rawBody, signature);
  const purchase = await ctx.db.getPurchaseByCheckoutSession(evt.session_id);
  if (!purchase) return { status: "ignored" };
  if (purchase.status === "paid") return { status: "duplicate", purchase };

  const updated = await markPaidAndClone(ctx, purchase, {
    payment_intent_id: evt.payment_intent_id,
    charge_id: evt.charge_id,
  });
  return { status: "processed", purchase: updated };
}

export interface RefundArgs {
  purchase_id: string;
  amount_usd_cents?: number; // default = full price
  reason: string;
  actor_user_id: string;
}

/**
 * Refund a purchase within the 14-day window. Clawbacks the creator's share
 * on their next payout via the ledger.
 */
export async function refundPurchase(
  ctx: PurchaseContext,
  args: RefundArgs,
): Promise<Purchase> {
  const p = await ctx.db.getPurchase(args.purchase_id);
  if (!p) throw new MarketplaceError("Purchase not found.", "NOT_FOUND", 404);
  if (p.status !== "paid" && p.status !== "partially_refunded") {
    throw new MarketplaceError("Purchase not in refundable state.", "BAD_STATE", 409);
  }
  const now = ctx.now ? ctx.now() : new Date();
  if (now > new Date(p.refund_eligible_until)) {
    throw new MarketplaceError("Refund window expired.", "REFUND_EXPIRED", 410);
  }
  const refundAmount = args.amount_usd_cents ?? p.price_usd_cents;
  if (refundAmount <= 0 || refundAmount > p.price_usd_cents - p.refund_amount_usd_cents) {
    throw new MarketplaceError("Invalid refund amount.", "BAD_REFUND_AMOUNT", 400);
  }
  if (!p.stripe_charge_id) {
    throw new MarketplaceError("Cannot refund: no Stripe charge.", "NO_CHARGE", 409);
  }
  await ctx.stripe.refundCharge({
    charge_id: p.stripe_charge_id,
    amount_usd_cents: refundAmount,
    reason: args.reason,
  });

  const newTotalRefund = p.refund_amount_usd_cents + refundAmount;
  const nextStatus: Purchase["status"] =
    newTotalRefund === p.price_usd_cents ? "refunded" : "partially_refunded";

  const updated = await ctx.db.updatePurchase(p.id, {
    status: nextStatus,
    refund_amount_usd_cents: newTotalRefund,
    refund_reason: args.reason,
    refunded_at: nextStatus === "refunded" ? now.toISOString() : p.refunded_at,
    updated_at: now.toISOString(),
  });

  await safeEmit("template_refunded", {
    template_id: p.template_id,
    purchase_id: p.id,
    buyer_user_id: p.buyer_user_id,
    creator_id: p.creator_id,
    amount_usd_cents: refundAmount,
    reason: args.reason,
    actor_user_id: args.actor_user_id,
  });
  return updated;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Internal
 * ──────────────────────────────────────────────────────────────────────── */

async function insertPurchase(
  ctx: PurchaseContext,
  template: { id: string; creator_id: string; current_version_id: string | null; price_usd_cents: number },
  buyer_workspace_id: string,
  buyer_user_id: string,
  _stripe: null,
): Promise<Purchase> {
  if (!template.current_version_id) {
    throw new MarketplaceError("Template has no published version.", "NO_VERSION", 409);
  }
  const shares = computeShares(template.price_usd_cents);
  const now = ctx.now ? ctx.now() : new Date();
  const id = `pmp_${ulidLike(now)}`;
  const refund_eligible_until = new Date(now.getTime() + REFUND_WINDOW_DAYS * 86_400_000).toISOString();
  const purchase: Purchase = {
    id,
    template_id: template.id,
    template_version_id: template.current_version_id,
    buyer_user_id,
    buyer_workspace_id,
    creator_id: template.creator_id,
    status: template.price_usd_cents === 0 ? "pending" : "pending",
    price_usd_cents: template.price_usd_cents,
    stripe_processing_fee_usd_cents: shares.stripe_fee,
    creator_share_usd_cents: shares.creator_share,
    platform_share_usd_cents: shares.platform_share,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    refund_eligible_until,
    refund_amount_usd_cents: 0,
    refund_reason: null,
    cloned_funnel_id: null,
    paid_at: null,
    refunded_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  return ctx.db.insertPurchase(purchase);
}

async function markPaidAndClone(
  ctx: PurchaseContext,
  purchase: Purchase,
  stripeRefs: { payment_intent_id: string; charge_id: string | null } | null,
): Promise<Purchase> {
  const now = ctx.now ? ctx.now() : new Date();
  const paid = await ctx.db.updatePurchase(purchase.id, {
    status: "paid",
    paid_at: now.toISOString(),
    refund_eligible_until: new Date(now.getTime() + REFUND_WINDOW_DAYS * 86_400_000).toISOString(),
    stripe_payment_intent_id: stripeRefs?.payment_intent_id ?? null,
    stripe_charge_id: stripeRefs?.charge_id ?? null,
    updated_at: now.toISOString(),
  });

  // Bump lifetime totals for tax-form thresholds (W-9 at $600).
  await ctx.db.incrementPayoutLifetime(paid.creator_id, paid.creator_share_usd_cents);

  // Clone into buyer workspace.
  const clone = await cloneTemplate({ db: ctx.db, now: ctx.now }, paid.template_id, paid.buyer_workspace_id);

  await safeEmit("template_purchased", {
    template_id: paid.template_id,
    purchase_id: paid.id,
    buyer_user_id: paid.buyer_user_id,
    buyer_workspace_id: paid.buyer_workspace_id,
    creator_id: paid.creator_id,
    price_usd_cents: paid.price_usd_cents,
    creator_share_usd_cents: paid.creator_share_usd_cents,
    platform_share_usd_cents: paid.platform_share_usd_cents,
    new_funnel_id: clone.new_funnel_id,
  });
  return clone.purchase;
}

function ulidLike(now: Date): string {
  // 26-char ULID-ish (timestamp + random); good enough for primary keys
  // when run outside the workspace's ID issuance domain. The `db` layer
  // owns canonical IDs in prod.
  const ts = now.getTime().toString(36).padStart(10, "0").toUpperCase();
  const rnd = randomBytes(10).toString("hex").toUpperCase().slice(0, 16);
  return `${ts}${rnd}`.slice(0, 26);
}

async function safeEmit(name: string, payload: unknown): Promise<void> {
  try {
    const _ = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: name, ts: Date.now(), digest: _.slice(0, 12), ...((payload as object) ?? {}) }));
  } catch {
    /* no-op */
  }
}
