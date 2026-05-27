/**
 * Common webhook plumbing.
 *
 * Every webhook follows the same skeleton:
 *
 *   1. Read raw body (text or bytes, never a parsed JSON object — signature
 *      verification requires byte-identical bodies).
 *   2. Verify the provider's signature scheme.
 *   3. Extract a stable `event_id` for dedupe.
 *   4. If duplicate inside 90 days, respond 200 OK with `replayed: true`.
 *   5. Persist raw body to R2 (30 day TTL handled by lifecycle policy).
 *   6. Mark dedupe in KV.
 *   7. Enqueue a `Q_WEBHOOKS` job → return 200 immediately.
 *
 * Steps 5–7 happen in a single non-blocking helper so we acknowledge fast
 * (providers retry aggressively above ~5s).
 *
 * Failure modes return:
 *   - 401  on signature mismatch (NEVER 200 — providers must know it failed)
 *   - 400  on body parse failure
 *   - 500  on storage failure (the provider will retry, which is what we want)
 */

import type { Context } from "hono";
import { ulid } from "ulid";
import type { HonoEnv } from "../lib/context.js";
import { webhookSeen, webhookMark } from "../lib/idempotency.js";

export interface WebhookContext {
  provider: string;
  eventId: string;
  body: string;
  headers: Record<string, string>;
  receivedAt: string;
}

/**
 * Persist + dedupe + enqueue. Returns `replayed: true` if the event was
 * already seen.
 */
export async function acceptAndEnqueue(
  c: Context<HonoEnv>,
  wctx: WebhookContext,
): Promise<{ ok: true; replayed: boolean; webhookEventId: string }> {
  // Dedupe first — cheaper than touching R2.
  if (await webhookSeen(c.env.WEBHOOK_DEDUPE, wctx.provider, wctx.eventId)) {
    return { ok: true, replayed: true, webhookEventId: wctx.eventId };
  }

  const webhookEventId = `whe_${ulid()}`;
  const rawKey = `raw/${wctx.provider}/${webhookEventId}`;

  // Persist raw body so reconciliation + replay can fully reconstruct the
  // verified payload bytes.
  await c.env.WEBHOOK_BODIES.put(rawKey, wctx.body, {
    httpMetadata: { contentType: wctx.headers["content-type"] ?? "application/json" },
    customMetadata: {
      provider: wctx.provider,
      external_event_id: wctx.eventId,
      received_at: wctx.receivedAt,
    },
  });

  await webhookMark(c.env.WEBHOOK_DEDUPE, wctx.provider, wctx.eventId);

  await c.env.Q_WEBHOOKS.send({
    webhookEventId,
    provider: wctx.provider,
    receivedAt: wctx.receivedAt,
    rawBodyKey: rawKey,
  });

  return { ok: true, replayed: false, webhookEventId };
}

/** Hono helper to safely read the raw body once. */
export async function readRawBody(c: Context<HonoEnv>): Promise<{ text: string; bytes: Uint8Array }> {
  const buf = new Uint8Array(await c.req.arrayBuffer());
  return { text: new TextDecoder("utf-8").decode(buf), bytes: buf };
}

export function getRequiredHeader(c: Context<HonoEnv>, name: string): string {
  const v = c.req.header(name);
  if (!v) throw new Error(`Missing required header: ${name}`);
  return v;
}

export function headerMap(c: Context<HonoEnv>): Record<string, string> {
  const out: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}
