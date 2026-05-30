/**
 * Creator payouts.
 *
 * Cadence: monthly batch on the 5th business day of the following month.
 * Min payout: $25.
 * Methods: Stripe Connect (preferred for US/EU) and PayPal Payouts (fallback).
 *
 * Tax compliance:
 *   - Lifetime gross â‰¥ $600 â†’ require W-9 (US) or W-8BEN/W-8BEN-E (non-US).
 *   - 1099-NEC issued in January for prior calendar year (handled by tax-svc).
 *
 * Clawbacks:
 *   - Refunds reverse the creator's share. If the next payout balance is
 *     positive, the clawback is deducted. If it would go negative, the
 *     balance carries forward as `clawback_usd_cents` until further sales.
 */

import { randomBytes } from "node:crypto";

import type { MarketplaceDb, PayPalPort, StripePort } from "./port.js";
import {
  MarketplaceError,
  type CreatorPayout,
  type CreatorPayoutAccount,
  type PayoutMethod,
  type Purchase,
} from "./types.js";

export const MIN_PAYOUT_USD_CENTS = 25_00;
export const TAX_FORM_THRESHOLD_USD_CENTS = 600_00;

export interface PayoutContext {
  db: MarketplaceDb;
  stripe: StripePort;
  paypal: PayPalPort;
  now?: () => Date;
}

export async function upsertPayoutAccount(
  ctx: PayoutContext,
  acct: Omit<CreatorPayoutAccount, "created_at" | "updated_at" | "lifetime_usd_cents" | "current_year_usd_cents"> & {
    lifetime_usd_cents?: number;
    current_year_usd_cents?: number;
  },
): Promise<CreatorPayoutAccount> {
  const nowIso = (ctx.now ? ctx.now() : new Date()).toISOString();
  const existing = await ctx.db.getPayoutAccount(acct.creator_id);
  const next: CreatorPayoutAccount = {
    ...acct,
    lifetime_usd_cents: existing?.lifetime_usd_cents ?? acct.lifetime_usd_cents ?? 0,
    current_year_usd_cents: existing?.current_year_usd_cents ?? acct.current_year_usd_cents ?? 0,
    created_at: existing?.created_at ?? nowIso,
    updated_at: nowIso,
  };
  return ctx.db.upsertPayoutAccount(next);
}

/**
 * Build a payout for a single creator over a period. Idempotency: callers
 * pre-aggregate by (creator_id, period_start..period_end) and only call us
 * once per (creator, period).
 */
export async function buildPayoutForCreator(
  ctx: PayoutContext,
  creator_id: string,
  period_start: string,
  period_end: string,
): Promise<{ payout: CreatorPayout | null; reason?: string }> {
  const acct = await ctx.db.getPayoutAccount(creator_id);
  if (!acct || !acct.is_active) {
    return { payout: null, reason: "no_active_account" };
  }
  if (
    acct.lifetime_usd_cents >= TAX_FORM_THRESHOLD_USD_CENTS &&
    !acct.tax_form_received_at &&
    acct.tax_form !== "not_required"
  ) {
    return { payout: null, reason: "tax_form_required" };
  }

  const purchases = await ctx.db.listPurchasesForCreator(creator_id, period_start, period_end);
  const { gross, clawback } = aggregateForPayout(purchases);
  const net = gross - clawback;

  if (net < MIN_PAYOUT_USD_CENTS) {
    return { payout: null, reason: "below_minimum" };
  }

  const now = ctx.now ? ctx.now() : new Date();
  const payout: CreatorPayout = {
    id: `crp_${ulidLike(now)}`,
    creator_id,
    period_start,
    period_end,
    gross_usd_cents: gross,
    clawback_usd_cents: clawback,
    net_usd_cents: net,
    method: acct.method,
    status: "pending",
    external_payout_id: null,
    failure_reason: null,
    ledger_entry_ids: purchases.map((p) => p.id),
    sent_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  return { payout: await ctx.db.insertPayout(payout) };
}

export function aggregateForPayout(purchases: Purchase[]): {
  gross: number;
  clawback: number;
} {
  let gross = 0;
  let clawback = 0;
  for (const p of purchases) {
    if (p.status === "paid") {
      gross += p.creator_share_usd_cents;
    } else if (p.status === "refunded" || p.status === "partially_refunded") {
      // Clawback the creator's share proportional to the refund.
      const refundShare = Math.floor(
        (p.refund_amount_usd_cents * p.creator_share_usd_cents) /
          Math.max(1, p.price_usd_cents),
      );
      // If still inside the original purchase's payout (uncertain), we
      // simply count it as a clawback against this period.
      clawback += refundShare;
    }
  }
  return { gross, clawback };
}

/** Execute a built payout (call the external rail). Idempotent. */
export async function executePayout(ctx: PayoutContext, payout: CreatorPayout): Promise<CreatorPayout> {
  if (payout.status === "sent") return payout;
  if (payout.status === "processing") return payout;

  const acct = await ctx.db.getPayoutAccount(payout.creator_id);
  if (!acct) throw new MarketplaceError("Missing payout account.", "NO_ACCOUNT", 409);

  const idempotencyKey = `mkt-payout-${payout.id}`;
  await ctx.db.updatePayout(payout.id, { status: "processing", updated_at: new Date().toISOString() });

  try {
    let external: { external_payout_id: string };
    if (payout.method === "stripe_connect") {
      const r = await ctx.stripe.payoutToConnectedAccount({
        connect_account_id: acct.account_ref,
        amount_usd_cents: payout.net_usd_cents,
        description: `GoFunnelAI marketplace payout ${payout.period_start}â€”${payout.period_end}`,
        idempotency_key: idempotencyKey,
      });
      external = { external_payout_id: r.transfer_id };
    } else {
      const r = await ctx.paypal.sendPayout({
        payout_email: acct.account_ref,
        amount_usd_cents: payout.net_usd_cents,
        description: `GoFunnelAI marketplace payout ${payout.period_start}â€”${payout.period_end}`,
        idempotency_key: idempotencyKey,
      });
      external = { external_payout_id: r.payout_batch_id };
    }
    const updated = await ctx.db.updatePayout(payout.id, {
      status: "sent",
      external_payout_id: external.external_payout_id,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await safeEmit("marketplace_payout_sent", {
      creator_id: payout.creator_id,
      payout_id: payout.id,
      amount_usd_cents: payout.net_usd_cents,
      method: payout.method,
      external_payout_id: external.external_payout_id,
    });
    return updated;
  } catch (err) {
    const updated = await ctx.db.updatePayout(payout.id, {
      status: "failed",
      failure_reason: err instanceof Error ? err.message : String(err),
      updated_at: new Date().toISOString(),
    });
    await safeEmit("marketplace_payout_failed", {
      creator_id: payout.creator_id,
      payout_id: payout.id,
      amount_usd_cents: payout.net_usd_cents,
      method: payout.method,
      reason: updated.failure_reason,
    });
    throw err;
  }
}

/** Top-level monthly cron entry. */
export async function runMonthlyPayoutBatch(
  ctx: PayoutContext,
  creator_ids: string[],
  period_start: string,
  period_end: string,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const creator_id of creator_ids) {
    const built = await buildPayoutForCreator(ctx, creator_id, period_start, period_end);
    if (!built.payout) {
      skipped++;
      continue;
    }
    try {
      await executePayout(ctx, built.payout);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, skipped, failed };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Helpers
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ulidLike(now: Date): string {
  const ts = now.getTime().toString(36).padStart(10, "0").toUpperCase();
  const rnd = randomBytes(10).toString("hex").toUpperCase().slice(0, 16);
  return `${ts}${rnd}`.slice(0, 26);
}

async function safeEmit(name: string, payload: unknown): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: name, ts: Date.now(), ...((payload as object) ?? {}) }));
}

/** Helper for callers to determine if a creator needs to submit a tax form. */
export function needsTaxForm(acct: CreatorPayoutAccount): boolean {
  if (acct.tax_form === "not_required") return false;
  if (acct.tax_form_received_at) return false;
  return acct.lifetime_usd_cents >= TAX_FORM_THRESHOLD_USD_CENTS;
}

/** Determine the preferred payout method for a country. */
export function defaultPayoutMethodForCountry(country: string): PayoutMethod {
  const stripeConnectCountries = new Set([
    "US",
    "GB",
    "CA",
    "AU",
    "NZ",
    "DE",
    "FR",
    "IT",
    "ES",
    "NL",
    "IE",
    "BE",
    "AT",
    "DK",
    "FI",
    "NO",
    "SE",
    "CH",
    "JP",
    "SG",
    "HK",
  ]);
  return stripeConnectCountries.has(country.toUpperCase()) ? "stripe_connect" : "paypal_payouts";
}
