/**
 * Microsoft Graph webhook receiver (subscriptions/notifications).
 *
 * Two flows:
 *   - validationToken: Graph sends GET/POST with `?validationToken=…` at
 *     subscription creation. We must echo it as text/plain within 10s.
 *   - notification: POST body contains `{ value: [{ clientState, … }] }`.
 *     We verify `clientState` matches our pre-shared secret.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";
import { timingSafeEqual } from "../lib/hash.js";

export function buildMicrosoftGraphWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const validationToken = c.req.query("validationToken");
    if (validationToken) {
      return c.text(validationToken, 200, { "Content-Type": "text/plain" });
    }

    const { text } = await readRawBody(c);
    let payload: { value?: Array<{ subscriptionId: string; clientState: string; resourceData?: { id?: string } }> };
    try {
      payload = JSON.parse(text);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    // Validate clientState on every notification entry; reject if any mismatch.
    for (const n of payload.value ?? []) {
      if (!timingSafeEqual(n.clientState, c.env.MICROSOFT_GRAPH_CLIENT_STATE)) {
        return c.json({ error: "invalid_client_state" }, 401);
      }
    }

    const eventId = `msg:${payload.value?.[0]?.subscriptionId ?? "x"}:${payload.value?.[0]?.resourceData?.id ?? Date.now()}`;
    const result = await acceptAndEnqueue(c, {
      provider: "microsoft-graph",
      eventId,
      body: text,
      headers: headerMap(c),
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}
