/**
 * Google Calendar webhook receiver (Push notifications channel).
 *
 * Google Calendar's webhook is just a "ping" — the payload tells us a channel
 * fired but not what changed. The consumer must call `events.list?syncToken=`
 * to figure out diffs.
 *
 * Verification: `X-Goog-Channel-Token` (we set this when subscribing — it's a
 * shared secret per workspace stored in `integration_connections.metadata`).
 * `X-Goog-Resource-State` is one of `sync` | `exists` | `not_exists`.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";

export function buildGoogleCalendarWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const headers = headerMap(c);
    const channelId = headers["x-goog-channel-id"];
    const channelToken = headers["x-goog-channel-token"];
    const messageNumber = headers["x-goog-message-number"];
    const resourceId = headers["x-goog-resource-id"];
    const state = headers["x-goog-resource-state"];

    if (!channelId || !channelToken || !resourceId || !state) {
      return c.json({ error: "missing_headers" }, 401);
    }

    // Look up the channel's stored token in KV (set at subscription time).
    const stored = await c.env.OAUTH_STATE.get(`gcal:channel:${channelId}`);
    if (!stored || stored !== channelToken) {
      return c.json({ error: "invalid_token" }, 401);
    }

    // Body is usually empty — keep what's there.
    const { text } = await readRawBody(c);
    const eventId = `gcal:${channelId}:${messageNumber ?? "x"}`;

    const result = await acceptAndEnqueue(c, {
      provider: "google-calendar",
      eventId,
      body: text || JSON.stringify({ channelId, resourceId, state }),
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
