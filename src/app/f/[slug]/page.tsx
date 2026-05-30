import { notFound } from "next/navigation";

import { AutomatedFunnelRenderer } from "@/components/funnels/AutomatedFunnelRenderer";
import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

export const dynamic = "force-dynamic";

export default function PublicFunnelPage({ params }: { params: { slug: string } }) {
  const funnel = getGeneratedFunnel(params.slug);
  if (!funnel) notFound();

  const page = funnel.pages.find((item) => item.id === "landing");
  if (!page) notFound();

  return <AutomatedFunnelRenderer funnel={funnel} page={page} />;
}
