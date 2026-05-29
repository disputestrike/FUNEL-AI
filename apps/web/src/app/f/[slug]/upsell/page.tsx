import { notFound } from "next/navigation";

import { AutomatedFunnelRenderer } from "@/components/funnels/AutomatedFunnelRenderer";
import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

export const dynamic = "force-dynamic";

export default function PublicFunnelUpsellPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { checkout?: string };
}) {
  const funnel = getGeneratedFunnel(params.slug);
  if (!funnel) notFound();

  const page = funnel.pages.find((item) => item.id === "upsell");
  if (!page) notFound();

  return (
    <AutomatedFunnelRenderer
      funnel={funnel}
      page={page}
      notice={checkoutNotice(searchParams?.checkout)}
    />
  );
}

function checkoutNotice(checkout?: string) {
  if (checkout === "missing_stripe") return "Stripe is not connected yet. Set STRIPE_SECRET_KEY to activate live Checkout Sessions.";
  if (checkout === "missing_paypal") return "PayPal is not connected yet. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to activate PayPal Checkout.";
  if (checkout === "cancelled") return "Checkout was cancelled. The offer is still available when the lead is ready.";
  if (checkout === "error") return "Checkout could not start. The funnel stayed live and logged the handoff safely.";
  return null;
}
