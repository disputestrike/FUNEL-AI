/**
 * Stripe webhook handler.
 *
 * Verifies via the `Stripe-Signature` header (HMAC SHA256) using
 * stripe.webhooks.constructEvent. Idempotency keyed on `event.id`.
 *
 * Handled event types:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - customer.subscription.trial_will_end
 *   - invoice.paid
 *   - invoice.payment_failed
 *   - invoice.payment_action_required
 *   - charge.refunded
 *   - customer.source.expiring
 */

import { createHash } from "node:crypto";
import type Stripe from "stripe";

import { emitBilling } from "../events.js";
import { writeAuditLog } from "../audit.js";
import { BillingError, WebhookHandleResult } from "../types.js";
import { getBillingStore } from "../store.js";
import { getStripeClient, getStripeConfig } from "./client.js";

export interface StripeWebhookRequest {
  signature: string;
  raw_body: string | Buffer;
}

/** Verify + parse a Stripe webhook body. */
export function verifyStripeSignature(req: StripeWebhookRequest): Stripe.Event {
  const stripe = getStripeClient();
  const { webhook_secret } = getStripeConfig();
  try {
    return stripe.webhooks.constructEvent(req.raw_body, req.signature, webhook_secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new BillingError(`Invalid Stripe signature: ${msg}`, "webhook.signature_invalid", 400);
  }
}

export async function handleStripeWebhook(req: StripeWebhookRequest): Promise<WebhookHandleResult> {
  const event = verifyStripeSignature(req); // throws BillingError on bad sig
  const body_str = typeof req.raw_body === "string" ? req.raw_body : req.raw_body.toString("utf8");
  const payload_hash = createHash("sha256").update(body_str).digest("hex");

  const store = getBillingStore();
  const delivery_id = `wd_stripe_${event.id}`;
  const delivery = await store.recordWebhookDelivery({
    delivery_id,
    direction: "inbound",
    source: "stripe",
    event_id_external: event.id,
    payload_hash,
    signature_valid: true,
    status: "received",
  });
  if (!delivery.created) {
    return { status: "duplicate", actions: [] };
  }

  await emitBilling("webhook_verified", { processor: "stripe", event_type: event.type, event_id: event.id });
  const result = await dispatchStripeEvent(event);
  await store.markWebhookDeliveryStatus(delivery_id, "succeeded");
  return result;
}

async function dispatchStripeEvent(event: Stripe.Event): Promise<WebhookHandleResult> {
  const actions: string[] = [];
  const store = getBillingStore();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const workspace_id = sub.metadata.workspace_id;
      if (!workspace_id) {
        actions.push("missing_workspace_id");
        break;
      }
      const existing = await findSubscriptionByExternalId(sub.id);
      const status = mapStripeStatus(sub.status);
      if (existing) {
        // Guard against out-of-order: only apply if newer or status is terminal.
        const incomingTs = sub.created * 1000;
        const currentTs = new Date(existing.updated_at).getTime();
        if (incomingTs < currentTs && existing.status === "canceled") {
          actions.push("ignored_stale_update");
          break;
        }
        await store.updateSubscription(existing.id, {
          status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        actions.push("subscription_updated");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const existing = await findSubscriptionByExternalId(sub.id);
      if (existing) {
        await store.updateSubscription(existing.id, {
          status: "canceled",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await emitBilling("subscription_canceled", {
          subscription_id: existing.id,
          workspace_id: existing.workspace_id,
          via: "stripe_webhook",
        });
        actions.push("subscription_deleted");
      }
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const sub_id = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
      if (sub_id) {
        const existing = await findSubscriptionByExternalId(sub_id);
        if (existing) {
          await emitBilling("payment_succeeded", {
            subscription_id: existing.id,
            workspace_id: existing.workspace_id,
            external_invoice_id: inv.id,
            amount_micros: (inv.amount_paid ?? 0) * 10_000, // cents -> micros
            currency: inv.currency.toUpperCase(),
          });
          actions.push("payment_succeeded");
        }
      }
      break;
    }

    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const inv = event.data.object as Stripe.Invoice;
      const sub_id = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
      if (sub_id) {
        const existing = await findSubscriptionByExternalId(sub_id);
        if (existing) {
          await emitBilling("payment_failed", {
            subscription_id: existing.id,
            workspace_id: existing.workspace_id,
            external_invoice_id: inv.id,
            attempt_n: inv.attempt_count,
            failure_code: inv.last_finalization_error?.code ?? "unknown",
          });
          await writeAuditLog({
            workspace_id: existing.workspace_id,
            actor_user_id: null,
            action: "billing.payment_failed",
            resource_type: "invoice",
            resource_id: inv.id ?? "",
            metadata: { attempt_n: inv.attempt_count },
          });
          actions.push("payment_failed");
        }
      }
      break;
    }

    case "charge.refunded": {
      await emitBilling("refund_processed", {
        processor: "stripe",
        external_charge_id: (event.data.object as Stripe.Charge).id,
      });
      actions.push("refund_recorded");
      break;
    }

    case "customer.source.expiring": {
      const card = event.data.object as Stripe.Card;
      await emitBilling("card_expiring_reminder", {
        external_customer_id: typeof card.customer === "string" ? card.customer : card.customer?.id,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        last4: card.last4,
      });
      actions.push("card_expiring");
      break;
    }

    default:
      actions.push(`unhandled:${event.type}`);
  }

  return { status: actions.length === 0 ? "ignored" : "processed", actions };
}

async function findSubscriptionByExternalId(external_id: string) {
  const store = getBillingStore();
  const all = await store.listActiveSubscriptions("stripe");
  return all.find((s) => s.external_subscription_id === external_id) ?? null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): import("../types.js").SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "trialing";
    default:
      return "active";
  }
}
