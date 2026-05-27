/**
 * PayPal webhook receiver.
 *
 * Signature scheme: PayPal's official `verify-webhook-signature` REST call,
 * implemented in `@funnel/billing/paypal/webhook.ts`. We dispatch verification
 * there to keep one source of truth.
 *
 * Event id: PayPal's `id` (top-level WebhookEvent.id).
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";

export function buildPaypalWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);

    // Forward to @funnel/billing for signature verification + dispatch. The
    // package call is awaited only as far as signature validation — heavy
    // dispatch happens inside the Q_WEBHOOKS consumer.
    const billing = await import("@funnel/billing/paypal/webhook").catch(() => null);
    if (!billing) return c.json({ error: "billing_unavailable" }, 500);

    const valid = await billing
      .verifyPayPalSignature({
        headers: {
          "paypal-transmission-id": headers["paypal-transmission-id"] ?? "",
          "paypal-transmission-time": headers["paypal-transmission-time"] ?? "",
          "paypal-transmission-sig": headers["paypal-transmission-sig"] ?? "",
          "paypal-cert-url": headers["paypal-cert-url"] ?? "",
          "paypal-auth-algo": headers["paypal-auth-algo"] ?? "",
        },
        raw_body: text,
      })
      .catch(() => false);

    if (!valid) return c.json({ error: "invalid_signature" }, 401);

    let event: { id: string; event_type: string };
    try {
      event = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const result = await acceptAndEnqueue(c, {
      provider: "paypal",
      eventId: event.id,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });

    return c.json(result, 200);
  });

  return r;
}
