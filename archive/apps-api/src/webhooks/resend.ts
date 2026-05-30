/**
 * Resend webhook receiver (transactional email events).
 *
 * Signature scheme: Svix. Headers: `svix-id`, `svix-timestamp`, `svix-signature`.
 * Verified with HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}` using
 * `env.RESEND_WEBHOOK_SECRET` (Svix secret, base64 — prefixed `whsec_`).
 *
 * Events of interest:
 *   email.sent, email.delivered, email.delivery_delayed, email.bounced,
 *   email.complained, email.opened, email.clicked
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Base64, timingSafeEqual } from "../lib/hash.js";

const MAX_SKEW_SEC = 5 * 60;

export function buildResendWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const svixId = headers["svix-id"];
    const svixTs = headers["svix-timestamp"];
    const svixSig = headers["svix-signature"];
    if (!svixId || !svixTs || !svixSig) return c.json({ error: "missing_headers" }, 401);

    const tsNum = Number.parseInt(svixTs, 10);
    if (!Number.isFinite(tsNum)) return c.json({ error: "bad_timestamp" }, 401);
    const skew = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
    if (skew > MAX_SKEW_SEC) return c.json({ error: "timestamp_out_of_range" }, 401);

    // Svix secret is "whsec_<base64>"; decode the suffix before HMAC.
    const secret = c.env.RESEND_WEBHOOK_SECRET;
    const secretKey = secret.startsWith("whsec_")
      ? atob(secret.slice("whsec_".length))
      : secret;

    const signedPayload = `${svixId}.${svixTs}.${text}`;
    const expected = await hmacSha256Base64(secretKey, signedPayload);

    // svixSig is space-separated "v1,<base64> v1,<base64>" — at least one must match.
    const candidates = svixSig.split(/\s+/).map((s) => s.split(",")[1] ?? "");
    const ok = candidates.some((sig) => timingSafeEqual(sig, expected));
    if (!ok) return c.json({ error: "invalid_signature" }, 401);

    let payload: { type: string; data: { email_id?: string; id?: string } };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const eventId = svixId; // Svix guarantees unique per delivery
    const result = await acceptAndEnqueue(c, {
      provider: "resend",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });

    void payload;
    return c.json(result, 200);
  });

  return r;
}
