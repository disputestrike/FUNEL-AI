/**
 * TikTok Ads webhook receiver.
 *
 * Signature: HMAC-SHA256(app_secret, raw_body) in `X-Tiktok-Signature` header
 * formatted as `t=<unix>,s=<hex>` (timestamp + signature).
 *
 * Events: `lead.captured`, `lead.delivered`, `auth.expired`, `auth.revoked`.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/hash.js";

const MAX_SKEW_SEC = 5 * 60;

export function buildTiktokAdsWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sigHeader = headers["x-tiktok-signature"];
    if (!sigHeader) return c.json({ error: "missing_signature" }, 401);

    const parts = Object.fromEntries(
      sigHeader.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k?.trim() ?? "", v?.trim() ?? ""];
      }),
    );
    const ts = parts.t ?? "";
    const sig = parts.s ?? "";
    const tsNum = Number.parseInt(ts, 10);
    if (!Number.isFinite(tsNum)) return c.json({ error: "bad_timestamp" }, 401);
    if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > MAX_SKEW_SEC) {
      return c.json({ error: "timestamp_out_of_range" }, 401);
    }

    const expected = await hmacSha256Hex(c.env.TIKTOK_APP_SECRET, `${ts}.${text}`);
    if (!timingSafeEqual(sig, expected)) return c.json({ error: "invalid_signature" }, 401);

    let payload: { event_id?: string; event: string };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const eventId = payload.event_id ?? `tt:${ts}:${payload.event}`;

    const result = await acceptAndEnqueue(c, {
      provider: "tiktok-ads",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
