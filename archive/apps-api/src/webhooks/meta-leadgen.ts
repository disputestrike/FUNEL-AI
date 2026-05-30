/**
 * Meta Lead Ads (lead-gen) webhook.
 *
 * Same signature scheme as `meta-ads.ts`. Different topic & payload shape —
 * Meta delivers a `leadgen_id` and we fetch lead details via Graph API in
 * the consumer (we cannot include access tokens in the webhook payload).
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/hash.js";

export function buildMetaLeadgenWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.get("/", async (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode === "subscribe" && token === c.env.META_VERIFY_TOKEN && challenge) {
      return c.text(challenge, 200);
    }
    return c.json({ error: "verification_failed" }, 403);
  });

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["x-hub-signature-256"];
    if (!sig?.startsWith("sha256=")) return c.json({ error: "missing_signature" }, 401);

    const expected = await hmacSha256Hex(c.env.META_APP_SECRET, text);
    if (!timingSafeEqual(sig.slice("sha256=".length), expected)) {
      return c.json({ error: "invalid_signature" }, 401);
    }

    let payload: {
      entry?: Array<{
        id: string;
        time: number;
        changes?: Array<{ field: string; value?: { leadgen_id?: string; ad_id?: string; form_id?: string; created_time?: number } }>;
      }>;
    };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const leadIds: string[] = [];
    for (const e of payload.entry ?? []) {
      for (const ch of e.changes ?? []) {
        if (ch.field === "leadgen" && ch.value?.leadgen_id) leadIds.push(ch.value.leadgen_id);
      }
    }
    const eventId = leadIds.length ? `metalg:${leadIds.join(",")}` : `metalg:${Date.now()}`;

    const result = await acceptAndEnqueue(c, {
      provider: "meta-leadgen",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
