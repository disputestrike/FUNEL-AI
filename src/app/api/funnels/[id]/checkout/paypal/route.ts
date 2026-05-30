import { NextResponse } from "next/server";

import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const funnel = getGeneratedFunnel(params.id);
  const origin = new URL(req.url).origin;
  if (!funnel) return NextResponse.redirect(`${origin}/?checkout=missing_funnel`, { status: 303 });

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/f/${funnel.slug}/upsell?checkout=missing_paypal`, { status: 303 });
  }

  const baseUrl = process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
  const offer = pickPaidOffer(funnel);

  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const token = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenResponse.ok || !token?.access_token) {
    return NextResponse.redirect(`${origin}/f/${funnel.slug}/upsell?checkout=error`, { status: 303 });
  }

  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `${funnel.id}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: funnel.slug,
          description: offer.title,
          custom_id: funnel.id,
          amount: {
            currency_code: "USD",
            value: (offer.priceCents / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "GoFunnelAI",
        user_action: "PAY_NOW",
        return_url: `${origin}/f/${funnel.slug}/thank-you?checkout=success`,
        cancel_url: `${origin}/f/${funnel.slug}/upsell?checkout=cancelled`,
      },
    }),
  });

  const order = await orderResponse.json().catch(() => null) as {
    links?: Array<{ rel: string; href: string }>;
  } | null;
  const approvalUrl = order?.links?.find((link) => link.rel === "approve")?.href;
  if (!orderResponse.ok || !approvalUrl) {
    return NextResponse.redirect(`${origin}/f/${funnel.slug}/upsell?checkout=error`, { status: 303 });
  }

  return NextResponse.redirect(approvalUrl, { status: 303 });
}

function pickPaidOffer(funnel: NonNullable<ReturnType<typeof getGeneratedFunnel>>) {
  const offer = funnel.offer_intelligence.upsellLadder.find((step) => (step.priceCents ?? 0) > 0)
    ?? funnel.offer_intelligence.upsellLadder[0];

  return {
    title: offer?.title ?? funnel.offer_intelligence.offerStack.mainCta,
    priceCents: Math.max(100, offer?.priceCents ?? 4900),
  };
}
