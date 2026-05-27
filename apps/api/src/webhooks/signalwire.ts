/**
 * SignalWire webhook receiver (voice + SMS).
 *
 * Signature: HMAC-SHA1 (Twilio-compatible) over `URL + sorted(form params)`,
 * using the SignalWire project token. SignalWire sends `application/x-www-form-urlencoded`
 * with `X-Twilio-Signature` (SignalWire keeps the Twilio header for compat).
 *
 * Events:
 *   - Voice status callbacks (initiated/ringing/answered/completed)
 *   - SMS status (queued/sent/delivered/failed)
 *   - Inbound SMS (TCPA opt-out keywords: STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT)
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { acceptAndEnqueue, readRawBody, headerMap } from "./common.js";

const OPT_OUT_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

export function buildSignalwireWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/", async (c) => {
    const { text } = await readRawBody(c);
    const headers = headerMap(c);
    const sig = headers["x-twilio-signature"] ?? headers["x-signalwire-signature"];
    if (!sig) return c.json({ error: "missing_signature" }, 401);

    const form = new URLSearchParams(text);
    const url = new URL(c.req.url).toString();

    const valid = await verifyTwilioCompatibleSignature(c.env.SIGNALWIRE_WEBHOOK_SECRET, url, form, sig);
    if (!valid) return c.json({ error: "invalid_signature" }, 401);

    // Event id: prefer CallSid > MessageSid > AccountSid+Timestamp
    const eventId =
      form.get("CallSid") ??
      form.get("MessageSid") ??
      `sw_${form.get("AccountSid") ?? "x"}_${headers["x-request-id"] ?? Date.now()}`;

    // Inbound SMS body — check opt-out before enqueueing (TCPA: must process opt-out within 60s).
    const body = (form.get("Body") ?? "").trim().toUpperCase();
    if (form.get("MessageSid") && OPT_OUT_KEYWORDS.has(body)) {
      // Enqueue with a high-priority flag — Q_WEBHOOKS consumer will write
      // suppression + emit `lead_sms_opted_out`.
      await acceptAndEnqueue(c, {
        provider: "signalwire-optout",
        eventId,
        body: text,
        headers,
        receivedAt: new Date().toISOString(),
      });
      // Respond with TwiML/SignalWireML acknowledging the opt-out so the carrier
      // can stop delivery immediately.
      return c.text(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>You have been unsubscribed. Reply HELP for help.</Message></Response>",
        200,
        { "Content-Type": "text/xml" },
      );
    }

    const result = await acceptAndEnqueue(c, {
      provider: "signalwire",
      eventId,
      body: text,
      headers,
      receivedAt: new Date().toISOString(),
    });
    return c.json(result, 200);
  });

  return r;
}

/** Twilio/SignalWire signature: HMAC-SHA1(secret, url + sorted(key+value)) */
async function verifyTwilioCompatibleSignature(
  secret: string,
  url: string,
  form: URLSearchParams,
  signatureHeader: string,
): Promise<boolean> {
  const sortedKeys = [...form.keys()].sort();
  let signed = url;
  for (const k of sortedKeys) signed += k + (form.get(k) ?? "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  let b = "";
  const view = new Uint8Array(sig);
  for (let i = 0; i < view.length; i++) b += String.fromCharCode(view[i]!);
  const expected = btoa(b);
  return constantTimeEqual(expected, signatureHeader);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}
