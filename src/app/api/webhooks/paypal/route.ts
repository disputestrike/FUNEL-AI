/**
 * PayPal subscription webhook ingress.
 *
 * Verifies the PayPal signature, then hands the event to `handlePayPalWebhook`
 * in @funnel/billing which does the idempotent state-machine work
 * (subscription created → activated → suspended → canceled, plus payment
 * sale/refund events).
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  handlePayPalWebhook,
  verifyPayPalSignature,
  type PayPalWebhookHeaders,
} from "@funnel/billing/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readHeaders(): PayPalWebhookHeaders {
  const h = headers();
  return {
    "paypal-transmission-id": h.get("paypal-transmission-id") ?? "",
    "paypal-transmission-time": h.get("paypal-transmission-time") ?? "",
    "paypal-transmission-sig": h.get("paypal-transmission-sig") ?? "",
    "paypal-cert-url": h.get("paypal-cert-url") ?? "",
    "paypal-auth-algo": h.get("paypal-auth-algo") ?? "",
  };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const h = readHeaders();

  const ok = await verifyPayPalSignature({ headers: h, raw_body: raw }).catch(
    () => false,
  );
  if (!ok) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  try {
    const result = await handlePayPalWebhook({ headers: h, raw_body: raw });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { error: "handler_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
