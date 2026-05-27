/**
 * Weekly payout job (Doc 16 §2.3).
 *
 *   - Cron: Monday 09:00 UTC. Pays prior ISO week.
 *   - Aggregate every `earned` commission for prior week per affiliate.
 *   - Apply $50 minimum; rollover otherwise.
 *   - PayPal Mass Pay (Phase 1) — adapter is injected.
 *   - On `failed` we retry 3x with exponential backoff (handled by caller).
 *   - On confirmed `paid`: mark all included commissions as `paid`.
 *
 * Refund clawback is handled BEFORE the payout job runs (see commissions.ts).
 */

import { MIN_PAYOUT_CENTS } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { Payout, PayoutMethod } from "./types.js";

export interface PaypalMassPayAdapter {
  send(args: {
    /** Array of single payments — one per affiliate. */
    items: Array<{
      payout_id: string;
      receiver_email: string;
      amount_cents: number;
      currency: string;
      note: string;
    }>;
  }): Promise<{
    batch_id: string;
    results: Array<{ payout_id: string; status: "ok" | "failed"; txn_id?: string; error?: string }>;
  }>;
}

export interface PayoutDeps {
  store: AffiliateStore;
  newId: (entity: "request") => string;
  paypal: PaypalMassPayAdapter;
  clock?: { now(): number; iso(): string };
  emit?: (
    name: "affiliate_payout_sent" | "affiliate_payout_failed",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/** Compute the ISO week boundaries (Monday 00:00 UTC inclusive → next Monday exclusive). */
export function weekBoundaries(asOf: Date): { start: string; end: string } {
  const utcDay = asOf.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const daysSinceMon = (utcDay + 6) % 7; // 0=Mon → 0, 0=Sun → 6
  const start = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() - daysSinceMon, 0, 0, 0, 0),
  );
  const end = new Date(start.valueOf() + 7 * 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface PayoutPlanRow {
  affiliate_id: string;
  amount_cents: number;
  payout_email: string;
  method: PayoutMethod;
  commission_ids: string[];
}

/**
 * Build the list of payouts to run for the just-closed week. Excludes
 * paused/suspended/terminated affiliates, applies the $50 minimum.
 */
export async function buildPayoutPlan(
  asOfIso: string,
  affiliate_ids: string[],
  deps: PayoutDeps,
): Promise<PayoutPlanRow[]> {
  const asOf = new Date(asOfIso);
  // We pay the week that ended LAST Monday — i.e. shift back by 7 days.
  const prior = new Date(asOf.valueOf() - 7 * 24 * 3600 * 1000);
  const { start, end } = weekBoundaries(prior);

  const plan: PayoutPlanRow[] = [];
  for (const aff_id of affiliate_ids) {
    const aff = await deps.store.getAffiliateById(aff_id);
    if (!aff) continue;
    if (aff.status !== "active") continue;
    if (!aff.payout_email) continue;

    const commissions = await deps.store.listCommissionsInPeriod(aff_id, start, end);
    const earned = commissions.filter((c) => c.status === "earned");
    if (earned.length === 0) continue;
    const total = earned.reduce((s, c) => s + c.amount_cents, 0);
    if (total < MIN_PAYOUT_CENTS) continue;

    plan.push({
      affiliate_id: aff_id,
      amount_cents: total,
      payout_email: aff.payout_email,
      method: aff.payout_method,
      commission_ids: earned.map((c) => c.id),
    });
  }
  return plan;
}

/**
 * Materialize payout rows and call PayPal Mass Pay. Each row goes to `pending`
 * → `processing` (when sent to PayPal) → `paid`/`failed`.
 */
export async function runPayouts(
  asOfIso: string,
  affiliate_ids: string[],
  deps: PayoutDeps,
): Promise<{ paid: Payout[]; failed: Payout[] }> {
  const clock = deps.clock ?? defaultClock;
  const plan = await buildPayoutPlan(asOfIso, affiliate_ids, deps);
  if (plan.length === 0) return { paid: [], failed: [] };

  const { start, end } = weekBoundaries(new Date(new Date(asOfIso).valueOf() - 7 * 24 * 3600 * 1000));

  const payouts = await Promise.all(
    plan.map(async (row) =>
      deps.store.insertPayout({
        id: deps.newId("request"),
        affiliate_id: row.affiliate_id,
        period_start: start,
        period_end: end,
        amount_cents: row.amount_cents,
        currency: "USD",
        method: row.method,
        destination: row.payout_email,
        status: "pending",
        txn_id: null,
        failure_reason: null,
        attempt_count: 0,
        created_at: clock.iso(),
        paid_at: null,
      }),
    ),
  );

  // Group by method (Phase 1 = PayPal only; future: split for Wise / Stripe Connect).
  const paypalItems = payouts
    .filter((p) => p.method === "paypal")
    .map((p) => ({
      payout_id: p.id,
      receiver_email: p.destination,
      amount_cents: p.amount_cents,
      currency: "USD",
      note: `GoFunnelAI affiliate commission — week ending ${start.slice(0, 10)}`,
    }));

  if (paypalItems.length === 0) return { paid: [], failed: [] };

  const result = await deps.paypal.send({ items: paypalItems });

  const paid: Payout[] = [];
  const failed: Payout[] = [];
  for (const r of result.results) {
    if (r.status === "ok") {
      const updated = await deps.store.updatePayoutStatus(r.payout_id, "paid", {
        txn_id: r.txn_id ?? null,
        paid_at: clock.iso(),
        attempt_count: 1,
      });
      // Flip the included commissions to `paid`.
      const planRow = plan.find((p) => updated.affiliate_id === p.affiliate_id);
      if (planRow) {
        await Promise.all(
          planRow.commission_ids.map((cid) => deps.store.markCommissionPaid(cid, updated.id)),
        );
      }
      paid.push(updated);
      if (deps.emit) {
        await deps.emit("affiliate_payout_sent", {
          affiliate_id: updated.affiliate_id,
          amount: updated.amount_cents,
          method: updated.method,
          transaction_id: updated.txn_id,
          period: start,
        });
      }
    } else {
      const updated = await deps.store.updatePayoutStatus(r.payout_id, "failed", {
        failure_reason: r.error ?? "unknown",
        attempt_count: 1,
      });
      failed.push(updated);
      if (deps.emit) {
        await deps.emit("affiliate_payout_failed", {
          affiliate_id: updated.affiliate_id,
          amount: updated.amount_cents,
          error_code: r.error ?? "unknown",
        });
      }
    }
  }
  return { paid, failed };
}
