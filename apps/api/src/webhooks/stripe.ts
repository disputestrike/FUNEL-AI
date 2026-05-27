/**
 * Stripe webhook receiver.
 *
 * Signature scheme: `Stripe-Signature` HMAC header. We delegate the actual
 * verify to `@funnel/billing/stripe/webhook.ts` which wraps the official SDK.
 *
 * Event id: Stripe's `event.id` field.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";

export function buildStripeWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["stripe-signature"];
    if (!sig) return c.json({ error: "missing_signature" }, 401);

    const billing = await import("@funnel/billing/stripe/webhook").catch(() => null);
    if (!billing) return c.json({ error: "billing_unavailable" }, 500);

    let event: { id: string; type: string };
    try {
      event = billing.verifyStripeSignature({ signature: sig, raw_body: text });
    } catch {
      return c.json({ error: "invalid_signature" }, 401);
    }

    const result = await acceptAndEnqueue(c, {
      provider: "stripe",
      eventId: event.id,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
