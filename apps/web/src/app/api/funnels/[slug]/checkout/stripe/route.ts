import { NextResponse } from "next/server";

import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const funnel = getGeneratedFunnel(params.slug);
  const origin = new URL(req.url).origin;
  if (!funnel) return NextResponse.redirect(`${origin}/?checkout=missing_funnel`, { status: 303 });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.redirect(`${origin}/f/${funnel.slug}/upsell?checkout=missing_stripe`, { status: 303 });
  }

  const offer = pickPaidOffer(funnel);
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/f/${funnel.slug}/thank-you?checkout=success`,
    cancel_url: `${origin}/f/${funnel.slug}/upsell?checkout=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(offer.priceCents),
    "line_items[0][price_data][product_data][name]": offer.title,
    "line_items[0][price_data][product_data][description]": offer.description,
    "metadata[funnel_slug]": funnel.slug,
    "metadata[funnel_id]": funnel.id,
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": process.env.STRIPE_API_VERSION ?? "2026-02-25.clover",
    },
    body,
  });

  const session = await response.json().catch(() => null) as { url?: string } | null;
  if (!response.ok || !session?.url) {
    return NextResponse.redirect(`${origin}/f/${funnel.slug}/upsell?checkout=error`, { status: 303 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}

function pickPaidOffer(funnel: NonNullable<ReturnType<typeof getGeneratedFunnel>>) {
  const offer = funnel.offer_intelligence.upsellLadder.find((step) => (step.priceCents ?? 0) > 0)
    ?? funnel.offer_intelligence.upsellLadder[0];

  return {
    title: offer?.title ?? funnel.offer_intelligence.offerStack.mainCta,
    description: (offer?.copy ?? funnel.offer_intelligence.offerStack.riskReversal).slice(0, 500),
    priceCents: Math.max(100, offer?.priceCents ?? 4900),
  };
}
