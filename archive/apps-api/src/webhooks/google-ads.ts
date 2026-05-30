/**
 * Google Ads webhook receiver.
 *
 * Google Ads doesn't push webhooks for ad-level events; we receive
 * "conversion ping" webhooks (server-side conversion uploads acknowledgement)
 * and "policy" notifications via Pub/Sub. This endpoint accepts both.
 *
 * Verification: Pub/Sub uses a one-time-token in `Authorization: Bearer`
 * minted by Google. We verify by JWT-verifying the token against Google's
 * OIDC JWKS endpoint — but for edge speed we accept a shared bearer token
 * (`env.GOOGLE_WEBHOOK_TOKEN`) on a private channel.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { timingSafeEqual } from "../lib/hash.js";

export function buildGoogleAdsWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const headers = headerMap(c);
    const authz = headers["authorization"];
    if (!authz?.startsWith("Bearer ")) return c.json({ error: "missing_token" }, 401);
    const presented = authz.slice("Bearer ".length).trim();
    if (!timingSafeEqual(presented, c.env.GOOGLE_WEBHOOK_TOKEN)) {
      return c.json({ error: "invalid_token" }, 401);
    }

    const { text } = await readRawBody(c);
    let envelope: { message?: { messageId?: string; data?: string; attributes?: Record<string, string> } };
    try {
      envelope = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const eventId = envelope.message?.messageId ?? `gads:${Date.now()}`;

    const result = await acceptAndEnqueue(c, {
      provider: "google-ads",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
