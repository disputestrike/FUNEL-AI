/**
 * Commission accrual.
 *
 * Doc 16 §2.2:
 *   - 40% of subscription MRR for the customer's lifetime
 *   - 40% of voice minute overages
 *   - NOT counted: Pro Boost one-time, refunds, chargebacks, taxes, fees
 *
 * Every successful customer payment that belongs to a workspace with an
 * attributed-affiliate fires `recordCommissionForPayment` exactly once.
 * Idempotency is enforced by (affiliate_id × referral_id × period × type ×
 * source_invoice_id) so webhook replays are safe.
 */

import { COMMISSION_RATE_BPS, VOICE_OVERAGE_RATE_BPS } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { Commission, ConversionInput } from "./types.js";

export interface CommissionDeps {
  store: AffiliateStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
  emit?: (
    name: "affiliate_commission_earned" | "affiliate_commission_clawed_back",
    payload: Record<string, unknown>,
  ) => Promise<void>;
  /** Optional ledger hook — every commission writes a double-entry row. */
  ledger?: (entry: {
    affiliate_id: string;
    commission_id: string;
    amount_cents: number;
    direction: "debit_affiliate_payable" | "credit_revenue_share";
  }) => Promise<{ ledger_entry_id: string }>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/** Compute commission in cents for a base amount (rounded to nearest cent). */
export function computeCommissionCents(base_cents: number, rate_bps: number): number {
  return Math.round((base_cents * rate_bps) / 10_000);
}

/**
 * Record a commission for a paid customer payment. Returns the commission row,
 * or null if no attribution exists / customer not eligible.
 */
export async function recordCommissionForPayment(
  args: ConversionInput,
  deps: CommissionDeps,
): Promise<Commission | null> {
  const r = await deps.store.getReferralForUser(args.referred_user_id);
  if (!r || !r.signup_at) return null;
  if (r.fraud_flagged || r.rejected_self_referral) return null;

  const rate =
    args.type === "voice_overage" ? VOICE_OVERAGE_RATE_BPS : COMMISSION_RATE_BPS;
  const amount = computeCommissionCents(args.base_amount_cents, rate);
  if (amount === 0) return null;

  // Idempotency on (affiliate, referral, period, type, invoice).
  const existing = await deps.store.findCommissionByIdempotency({
    affiliate_id: r.affiliate_id,
    referral_id: r.id,
    period_yyyy_mm: args.period_yyyy_mm,
    type: args.type,
    source_invoice_id: args.invoice_id,
  });
  if (existing) return existing;

  const clock = deps.clock ?? defaultClock;
  const id = deps.newId("request");

  const commission: Commission = {
    id,
    affiliate_id: r.affiliate_id,
    referral_id: r.id,
    referred_user_id: args.referred_user_id,
    type: args.type,
    source_invoice_id: args.invoice_id,
    period_yyyy_mm: args.period_yyyy_mm,
    base_amount_cents: args.base_amount_cents,
    rate_bps: rate,
    amount_cents: amount,
    status: "earned",
    paid_in_payout_id: null,
    ledger_entry_id: null,
    created_at: clock.iso(),
  };

  let ledger_entry_id: string | null = null;
  if (deps.ledger) {
    const entry = await deps.ledger({
      affiliate_id: r.affiliate_id,
      commission_id: id,
      amount_cents: amount,
      direction: "credit_revenue_share",
    });
    ledger_entry_id = entry.ledger_entry_id;
  }

  const inserted = await deps.store.insertCommission({
    ...commission,
    ledger_entry_id,
  });
  if (deps.emit) {
    await deps.emit("affiliate_commission_earned", {
      affiliate_id: inserted.affiliate_id,
      referred_user_id: inserted.referred_user_id,
      period: inserted.period_yyyy_mm,
      amount: inserted.amount_cents,
      commission_type: inserted.type,
    });
  }
  return inserted;
}

/**
 * Reverse a commission. Used by:
 *   - refund clawback (within 30 days of original payment)
 *   - chargeback clawback (any time)
 *
 * Writes a negative commission row + flips the original to `clawed_back`.
 */
export async function clawbackCommission(
  args: {
    original_commission_id: string;
    reason: "refund" | "chargeback";
  },
  deps: CommissionDeps,
): Promise<Commission> {
  const orig = await deps.store.insertClawback({
    original_id: args.original_commission_id,
    amount_cents_negative: 0, // overwritten below
    reason: args.reason,
  });
  // The amount on the clawback row should mirror the magnitude of the original.
  // (Store handles that — see InMemoryAffiliateStore.insertClawback)
  if (deps.ledger) {
    await deps.ledger({
      affiliate_id: orig.affiliate_id,
      commission_id: orig.id,
      amount_cents: orig.amount_cents,
      direction: "debit_affiliate_payable",
    });
  }
  if (deps.emit) {
    await deps.emit("affiliate_commission_clawed_back", {
      affiliate_id: orig.affiliate_id,
      referred_user_id: orig.referred_user_id,
      amount: orig.amount_cents,
      reason: args.reason,
    });
  }
  return orig;
}
