/**
 * RevTry webhook receiver (Funnel's sister voice product).
 *
 * Signature: HMAC-SHA256 over body, with `X-RevTry-Signature` header.
 *
 * Events:
 *   - call.initiated, call.answered, call.completed
 *   - call.transcript, call.sentiment
 *   - call.qualified, call.booked, call.voicemail, call.dnc, call.transferred, call.hung_up
 *   - number.message_received
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/hash.js";

export function buildRevtryWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["x-revtry-signature"];
    if (!sig) return c.json({ error: "missing_signature" }, 401);

    const expected = await hmacSha256Hex(c.env.REVTRY_WEBHOOK_SECRET, text);
    if (!timingSafeEqual(sig, expected)) return c.json({ error: "invalid_signature" }, 401);

    let event: { event_id: string; event_type: string; call_id?: string; lead_id?: string };
    try {
      event = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const result = await acceptAndEnqueue(c, {
      provider: "revtry",
      eventId: event.event_id,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
