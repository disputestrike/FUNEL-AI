import { notFound } from "next/navigation";

import { AutomatedFunnelRenderer } from "@/components/funnels/AutomatedFunnelRenderer";
import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

export const dynamic = "force-dynamic";

export default function PublicFunnelThankYouPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { checkout?: string };
}) {
  const funnel = getGeneratedFunnel(params.slug);
  if (!funnel) notFound();

  const page = funnel.pages.find((item) => item.id === "thank_you");
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
  if (checkout === "success") return "Checkout completed. The buyer can continue receiving automated follow-up.";
  return null;
}
