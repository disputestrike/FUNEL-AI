/**
 * PayPal webhook handler.
 *
 * Verifies signatures via PayPal's CertVerify endpoint, enforces idempotency
 * keyed on `id` (the PayPal event id), dispatches to per-event handlers, and
 * handles out-of-order delivery (we never apply a state regression — e.g. a
 * stale BILLING.SUBSCRIPTION.ACTIVATED cannot override a fresh CANCELLED).
 *
 * Webhook events of interest:
 *   - BILLING.SUBSCRIPTION.CREATED
 *   - BILLING.SUBSCRIPTION.ACTIVATED
 *   - BILLING.SUBSCRIPTION.UPDATED
 *   - BILLING.SUBSCRIPTION.SUSPENDED
 *   - BILLING.SUBSCRIPTION.CANCELLED
 *   - BILLING.SUBSCRIPTION.EXPIRED
 *   - PAYMENT.SALE.COMPLETED
 *   - PAYMENT.SALE.DENIED
 *   - PAYMENT.SALE.REFUNDED
 *   - BILLING.SUBSCRIPTION.PAYMENT.FAILED
 *
 * Doc 12 PRD 4 §2 stories 10–11, §9 acceptance criteria 2.
 */

import { createHash } from "node:crypto";

import { emitBilling } from "../events.js";
import { writeAuditLog } from "../audit.js";
import { BillingError, BillingWebhookEvent, WebhookHandleResult } from "../types.js";
import { getBillingStore } from "../store.js";
import { getAccessToken, getPayPalApiBase, getPayPalConfig } from "./client.js";

export interface PayPalWebhookHeaders {
  "paypal-transmission-id": string;
  "paypal-transmission-time": string;
  "paypal-transmission-sig": string;
  "paypal-cert-url": string;
  "paypal-auth-algo": string;
}

export interface PayPalWebhookRequest {
  headers: PayPalWebhookHeaders;
  raw_body: string; // exact body bytes, not parsed JSON
}

/** PayPal's official signature-verification endpoint. */
export async function verifyPayPalSignature(req: PayPalWebhookRequest): Promise<boolean> {
  const config = getPayPalConfig();
  const token = await getAccessToken();
  const parsedBody = JSON.parse(req.raw_body);
  const payload = {
    auth_algo: req.headers["paypal-auth-algo"],
    cert_url: req.headers["paypal-cert-url"],
    transmission_id: req.headers["paypal-transmission-id"],
    transmission_sig: req.headers["paypal-transmission-sig"],
    transmission_time: req.headers["paypal-transmission-time"],
    webhook_id: config.webhook_id,
    webhook_event: parsedBody,
  };
  const res = await fetch(`${getPayPalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

interface ParsedPayPalEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource: Record<string, unknown>;
}

/** Top-level webhook receiver. */
export async function handlePayPalWebhook(req: PayPalWebhookRequest): Promise<WebhookHandleResult> {
  const payload_hash = createHash("sha256").update(req.raw_body).digest("hex");
  const valid = await verifyPayPalSignature(req).catch(() => false);

  const delivery_id = `wd_${createHash("sha256")
    .update(`${req.headers["paypal-transmission-id"]}:${payload_hash}`)
    .digest("hex")
    .slice(0, 24)}`;

  const store = getBillingStore();

  if (!valid) {
    await store.recordWebhookDelivery({
      delivery_id,
      direction: "inbound",
      source: "paypal",
      payload_hash,
      signature_valid: false,
      status: "failed",
      last_error: "signature_invalid",
    });
    await emitBilling("webhook_rejected", {
      processor: "paypal",
      reason: "signature_invalid",
      transmission_id: req.headers["paypal-transmission-id"],
    });
    throw new BillingError("Invalid PayPal webhook signature", "webhook.signature_invalid", 400);
  }

  let event: ParsedPayPalEvent;
  try {
    event = JSON.parse(req.raw_body) as ParsedPayPalEvent;
  } catch {
    throw new BillingError("PayPal webhook body is not valid JSON", "webhook.malformed", 400);
  }

  // Idempotency: PayPal guarantees `id` is unique per event delivery.
  const delivery = await store.recordWebhookDelivery({
    delivery_id,
    direction: "inbound",
    source: "paypal",
    event_id_external: event.id,
    payload_hash,
    signature_valid: true,
    status: "received",
  });
  if (!delivery.created) {
    return { status: "duplicate", actions: [] };
  }
  await emitBilling("webhook_verified", { processor: "paypal", event_type: event.event_type, event_id: event.id });

  const normalized: BillingWebhookEvent = {
    event_id: event.id,
    processor: "paypal",
    event_type: event.event_type,
    resource: event.resource,
    occurred_at: event.create_time,
    received_at: new Date().toISOString(),
  };
  const result = await dispatchPayPalEvent(normalized);
  await store.markWebhookDeliveryStatus(delivery_id, "succeeded");
  return result;
}

async function dispatchPayPalEvent(event: BillingWebhookEvent): Promise<WebhookHandleResult> {
  const actions: string[] = [];
  const store = getBillingStore();
  const resource = event.resource as Record<string, unknown>;
  const externalId = (resource.id as string | undefined) ?? null;
  const status_time = (resource.status_update_time as string | undefined) ?? event.occurred_at;

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.CREATED":
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      if (!externalId) break;
      const sub = await findSubscriptionByExternalId(externalId);
      if (sub) {
        // Out-of-order protection: only flip to active from a non-terminal state.
        if (sub.status === "canceled" || sub.status === "suspended" || sub.status === "closed") {
          actions.push("ignored_stale_activate");
          break;
        }
        if (!isFresherThan(sub.updated_at, status_time)) {
          actions.push("ignored_out_of_order");
          break;
        }
        await store.updateSubscription(sub.id, {
          status: "active",
          updated_at: status_time ?? new Date().toISOString(),
        });
        await writeAuditLog({
          workspace_id: sub.workspace_id,
          actor_user_id: null,
          action: "subscription.activated_by_webhook",
          resource_type: "subscription",
          resource_id: sub.id,
          metadata: { processor: "paypal", event_id: event.event_id },
        });
        actions.push("subscription_activated");
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      if (!externalId) break;
      const sub = await findSubscriptionByExternalId(externalId);
      if (sub && sub.status !== "canceled") {
        await store.updateSubscription(sub.id, { status: "past_due", updated_at: new Date().toISOString() });
        await emitBilling("account_suspended", {
          subscription_id: sub.id,
          workspace_id: sub.workspace_id,
          reason: "paypal_suspended",
        });
        actions.push("subscription_suspended");
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      if (!externalId) break;
      const sub = await findSubscriptionByExternalId(externalId);
      if (sub) {
        await store.updateSubscription(sub.id, {
          status: "canceled",
          canceled_at: status_time ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await emitBilling("subscription_canceled", {
          subscription_id: sub.id,
          workspace_id: sub.workspace_id,
          via: "paypal_webhook",
        });
        actions.push("subscription_canceled");
      }
      break;
    }

    case "PAYMENT.SALE.COMPLETED": {
      const amountStr = ((resource.amount as Record<string, unknown>)?.total as string | undefined) ?? "0";
      const currency = ((resource.amount as Record<string, unknown>)?.currency as string | undefined) ?? "USD";
      const billing_agreement_id = resource.billing_agreement_id as string | undefined;
      if (billing_agreement_id) {
        const sub = await findSubscriptionByExternalId(billing_agreement_id);
        if (sub) {
          const amount_micros = Math.round(Number(amountStr) * 1_000_000);
          await emitBilling("payment_succeeded", {
            subscription_id: sub.id,
            workspace_id: sub.workspace_id,
            external_payment_id: externalId,
            amount_micros,
            currency,
          });
          actions.push("payment_succeeded");
        }
      }
      break;
    }

    case "PAYMENT.SALE.DENIED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const billing_agreement_id =
        (resource.billing_agreement_id as string | undefined) ?? externalId;
      if (billing_agreement_id) {
        const sub = await findSubscriptionByExternalId(billing_agreement_id);
        if (sub) {
          await emitBilling("payment_failed", {
            subscription_id: sub.id,
            workspace_id: sub.workspace_id,
            failure_code: (resource.reason_code as string | undefined) ?? "unknown",
          });
          actions.push("payment_failed");
        }
      }
      break;
    }

    case "PAYMENT.SALE.REFUNDED": {
      await emitBilling("refund_processed", {
        processor: "paypal",
        external_refund_id: externalId,
      });
      actions.push("refund_recorded");
      break;
    }

    default:
      actions.push(`unhandled:${event.event_type}`);
  }

  return { status: actions.length === 0 ? "ignored" : "processed", actions };
}

async function findSubscriptionByExternalId(external_id: string) {
  const store = getBillingStore();
  const all = await store.listActiveSubscriptions("paypal");
  return all.find((s) => s.external_subscription_id === external_id) ?? null;
}

/** Returns true if `incoming` ISO timestamp is greater than `current`. */
function isFresherThan(current: string | undefined, incoming: string | undefined): boolean {
  if (!incoming) return true;
  if (!current) return true;
  return new Date(incoming).getTime() >= new Date(current).getTime();
}
