/**
 * Stripe adapter implementing `StripePort`.
 *
 * Wraps the `stripe` SDK with idempotency keys, USD-cent normalization, and
 * webhook signature verification. The marketplace package only depends on
 * `StripePort` â€” this adapter is the prod implementation.
 */

import Stripe from "stripe";

import type { StripePort } from "../port.js";
import { MarketplaceError } from "../types.js";

export interface StripeAdapterConfig {
  secret_key: string;
  webhook_secret: string;
  application_fee_basis_points?: number;
}

export function createStripeAdapter(cfg: StripeAdapterConfig): StripePort {
  const client = new Stripe(cfg.secret_key, { apiVersion: "2024-11-20.acacia" });
  return {
    async createCheckoutSession(args) {
      const session = await client.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: args.price_usd_cents,
                product_data: {
                  name: `GoFunnelAI Template ${args.template_id}`,
                },
              },
            },
          ],
          success_url: args.success_url,
          cancel_url: args.cancel_url,
          metadata: args.metadata,
          client_reference_id: args.buyer_workspace_id,
        },
        { idempotencyKey: `tpl-${args.template_id}-buyer-${args.buyer_workspace_id}` },
      );
      if (!session.url) {
        throw new MarketplaceError("Stripe returned no checkout URL.", "STRIPE_NO_URL", 502);
      }
      return { session_id: session.id, checkout_url: session.url };
    },

    async retrieveSessionFromWebhook(rawBody, signature) {
      let event: Stripe.Event;
      try {
        event = client.webhooks.constructEvent(rawBody, signature, cfg.webhook_secret);
      } catch (err) {
        throw new MarketplaceError("Invalid Stripe webhook signature.", "BAD_SIGNATURE", 401, {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      if (event.type !== "checkout.session.completed") {
        throw new MarketplaceError("Unsupported event type.", "UNSUPPORTED_EVENT", 400, {
          type: event.type,
        });
      }
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        session_id: session.id,
        payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? "",
        charge_id:
          typeof session.payment_intent === "object" && session.payment_intent
            ? ((session.payment_intent as { latest_charge?: string }).latest_charge ?? null)
            : null,
        amount_total_usd_cents: session.amount_total ?? 0,
        application_fee_amount_usd_cents: 0,
        metadata: (session.metadata ?? {}) as Record<string, string>,
        livemode: event.livemode,
      };
    },

    async refundCharge(args) {
      const refund = await client.refunds.create(
        {
          charge: args.charge_id,
          amount: args.amount_usd_cents,
          reason: "requested_by_customer",
          metadata: { funnel_reason: args.reason },
        },
        { idempotencyKey: `rfd-${args.charge_id}-${args.amount_usd_cents}` },
      );
      return { refund_id: refund.id };
    },

    async payoutToConnectedAccount(args) {
      const transfer = await client.transfers.create(
        {
          amount: args.amount_usd_cents,
          currency: "usd",
          destination: args.connect_account_id,
          description: args.description,
        },
        { idempotencyKey: args.idempotency_key },
      );
      return { transfer_id: transfer.id };
    },
  };
}
