/**
 * Physical award fulfillment.
 *
 * Tier → item mapping (Doc 16 §3.3):
 *   Bronze   .... digital only
 *   Silver   .... custom certificate via print-on-demand (Printful) — $25
 *   Gold     .... engraved plaque ($150)
 *   Platinum .... larger plaque ($500) + FunnelCon mainstage invite
 *   Diamond  .... crystal trophy ($2000) + advisory seat + lifetime Agency tier
 *
 * The fulfillment vendor is injected — `Printful`, an engraving shop, etc.
 * Status webhooks back from the vendor flip `shipped` / `delivered`.
 */

import { PHYSICAL_DELIVERY_BY_TIER } from "./constants.js";
import type { AwardsStore } from "./store.js";
import type {
  Award,
  AwardTier,
  AwardWinner,
  PhysicalDelivery,
} from "./types.js";

export interface FulfillmentVendor {
  /** Returns a vendor-side order id we can correlate webhooks against. */
  placeOrder(args: {
    award_id: string;
    item_type: PhysicalDelivery["item_type"];
    recipient_address: NonNullable<AwardWinner["mailing_address"]>;
    line1_engrave: string;       // e.g. "Sarah Chen · $1,000,000 with GoFunnelAI"
    line2_engrave: string;       // e.g. "Solar · 2026"
  }): Promise<{ vendor_order_id: string }>;
}

export interface PhysicalDeliveryDeps {
  store: AwardsStore;
  newId: (entity: "request") => string;
  vendor: FulfillmentVendor;
  clock?: { iso(): string };
  emit?: (
    name: "award_shipped" | "award_delivered",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Schedule a physical delivery for an award. If the winner hasn't supplied a
 * mailing address yet, the row is created in `pending_address` and the caller
 * is expected to surface a mailing-address-collection prompt in-app.
 */
export async function scheduleDelivery(
  args: { award: Award; winner: AwardWinner },
  deps: PhysicalDeliveryDeps,
): Promise<PhysicalDelivery> {
  const tierSpec = PHYSICAL_DELIVERY_BY_TIER[args.award.tier];
  const clock = deps.clock ?? defaultClock;
  const now = clock.iso();

  if (tierSpec.item_type === "digital") {
    // Bronze: nothing to ship; we still write a delivery row marked delivered.
    return deps.store.insertPhysicalDelivery({
      id: deps.newId("request"),
      award_id: args.award.id,
      item_type: "digital",
      est_cost_cents: 0,
      vendor: "n/a",
      vendor_order_id: null,
      status: "delivered",
      tracking_number: null,
      carrier: null,
      shipped_at: now,
      delivered_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  if (!args.winner.mailing_address) {
    return deps.store.insertPhysicalDelivery({
      id: deps.newId("request"),
      award_id: args.award.id,
      item_type: tierSpec.item_type as PhysicalDelivery["item_type"],
      est_cost_cents: tierSpec.est_cost_cents,
      vendor: tierSpec.vendor,
      vendor_order_id: null,
      status: "pending_address",
      tracking_number: null,
      carrier: null,
      shipped_at: null,
      delivered_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  const engraveLine1 = `${args.winner.display_name ?? "GoFunnelAI Award"} — $${Math.round(args.award.revenue_at_milestone_cents / 100).toLocaleString()}`;
  const engraveLine2 = `${args.winner.industry ?? ""} · ${args.award.tier.toUpperCase()}`;

  const order = await deps.vendor.placeOrder({
    award_id: args.award.id,
    item_type: tierSpec.item_type as PhysicalDelivery["item_type"],
    recipient_address: args.winner.mailing_address,
    line1_engrave: engraveLine1,
    line2_engrave: engraveLine2,
  });

  return deps.store.insertPhysicalDelivery({
    id: deps.newId("request"),
    award_id: args.award.id,
    item_type: tierSpec.item_type as PhysicalDelivery["item_type"],
    est_cost_cents: tierSpec.est_cost_cents,
    vendor: tierSpec.vendor,
    vendor_order_id: order.vendor_order_id,
    status: "queued",
    tracking_number: null,
    carrier: null,
    shipped_at: null,
    delivered_at: null,
    created_at: now,
    updated_at: now,
  });
}

/** Vendor webhook → "shipped". */
export async function markShipped(
  args: {
    award_id: string;
    tracking_number: string;
    carrier: string;
  },
  deps: PhysicalDeliveryDeps,
): Promise<PhysicalDelivery | null> {
  const cur = await deps.store.getPhysicalDeliveryByAward(args.award_id);
  if (!cur) return null;
  const now = (deps.clock ?? defaultClock).iso();
  const next = await deps.store.updatePhysicalDelivery(cur.id, {
    status: "shipped",
    tracking_number: args.tracking_number,
    carrier: args.carrier,
    shipped_at: now,
  });
  if (deps.emit) {
    await deps.emit("award_shipped", {
      award_id: args.award_id,
      tier: cur.item_type,
      tracking_number: args.tracking_number,
      carrier: args.carrier,
    });
  }
  return next;
}

/** Vendor webhook → "delivered". */
export async function markDelivered(
  args: { award_id: string },
  deps: PhysicalDeliveryDeps,
): Promise<PhysicalDelivery | null> {
  const cur = await deps.store.getPhysicalDeliveryByAward(args.award_id);
  if (!cur) return null;
  const now = (deps.clock ?? defaultClock).iso();
  const next = await deps.store.updatePhysicalDelivery(cur.id, {
    status: "delivered",
    delivered_at: now,
  });
  if (deps.emit) {
    await deps.emit("award_delivered", {
      award_id: args.award_id,
      tier: cur.item_type,
      delivered_at: now,
    });
  }
  return next;
}

/** Re-trigger an order after a winner supplies their mailing address. */
export async function fulfillPendingAddress(
  args: { award: Award; winner: AwardWinner },
  deps: PhysicalDeliveryDeps,
): Promise<PhysicalDelivery | null> {
  const cur = await deps.store.getPhysicalDeliveryByAward(args.award.id);
  if (!cur || cur.status !== "pending_address") return null;
  if (!args.winner.mailing_address) return cur;

  const order = await deps.vendor.placeOrder({
    award_id: args.award.id,
    item_type: cur.item_type,
    recipient_address: args.winner.mailing_address,
    line1_engrave: `${args.winner.display_name ?? "GoFunnelAI Award"} — $${Math.round(args.award.revenue_at_milestone_cents / 100).toLocaleString()}`,
    line2_engrave: `${args.winner.industry ?? ""} · ${args.award.tier.toUpperCase()}`,
  });
  return deps.store.updatePhysicalDelivery(cur.id, {
    status: "queued",
    vendor_order_id: order.vendor_order_id,
  });
}

/** Tier helper for external callers. */
export function fulfillmentSpec(tier: AwardTier): typeof PHYSICAL_DELIVERY_BY_TIER[AwardTier] {
  return PHYSICAL_DELIVERY_BY_TIER[tier];
}
