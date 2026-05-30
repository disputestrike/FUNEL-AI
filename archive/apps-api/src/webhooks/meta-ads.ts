/**
 * Meta Ads webhook receiver.
 *
 * Meta uses two signatures depending on payload type:
 *   - GET (verification challenge) → hub.challenge echo with hub.verify_token check
 *   - POST → X-Hub-Signature-256: sha256=<hex> HMAC over the raw body using the app secret
 *
 * Topics: `account_review`, `delivery`, `account_health`, etc.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/hash.js";

export function buildMetaAdsWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  // Subscription verification (GET).
  r.get("/", async (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode === "subscribe" && token === c.env.META_VERIFY_TOKEN && challenge) {
      return c.text(challenge, 200);
    }
    return c.json({ error: "verification_failed" }, 403);
  });

  // Event delivery (POST).
  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["x-hub-signature-256"];
    if (!sig?.startsWith("sha256=")) return c.json({ error: "missing_signature" }, 401);

    const expected = await hmacSha256Hex(c.env.META_APP_SECRET, text);
    if (!timingSafeEqual(sig.slice("sha256=".length), expected)) {
      return c.json({ error: "invalid_signature" }, 401);
    }

    let payload: { entry?: Array<{ id: string; time: number; changes?: unknown[] }> };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    // Meta groups multiple "changes" inside a single delivery; we synthesize an
    // event id from (page_id, time) hashed to keep dedupe stable across retries.
    const idSeed = (payload.entry ?? []).map((e) => `${e.id}:${e.time}`).join("|") || `meta:${Date.now()}`;
    const eventId = await sha256(idSeed);

    const result = await acceptAndEnqueue(c, {
      provider: "meta-ads",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
