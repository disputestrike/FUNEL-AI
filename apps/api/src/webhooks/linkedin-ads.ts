/**
 * LinkedIn Ads webhook receiver.
 *
 * LinkedIn signs payloads with HMAC-SHA256(app_secret, raw_body) in
 * `X-LI-Signature`. Lead-Sync (Lead Gen Forms) sends one event per submission.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/hash.js";

export function buildLinkedinAdsWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["x-li-signature"];
    if (!sig) return c.json({ error: "missing_signature" }, 401);

    const expected = await hmacSha256Hex(c.env.LINKEDIN_CLIENT_SECRET, text);
    if (!timingSafeEqual(sig, expected)) return c.json({ error: "invalid_signature" }, 401);

    let payload: { eventId?: string; eventType?: string };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const eventId = payload.eventId ?? `li:${Date.now()}`;

    const result = await acceptAndEnqueue(c, {
      provider: "linkedin-ads",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
