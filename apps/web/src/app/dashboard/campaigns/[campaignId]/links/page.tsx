/**
 * Links tab — UTM link table.
 *
 * One row per UtmLink. Per-row copy, QR popover, click count. Bulk CSV
 * export + "Generate retargeting links" CTA at the top.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard, PLATFORM_LABEL } from "../_shared/state";
import { LinksTable } from "../_clients/LinksTable.client";

export const metadata = { title: "Links | GoFunnelAI" };

export default async function LinksPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        utmLinks: { orderBy: [{ platform: "asc" }, { createdAt: "desc" }] },
      },
    }),
  );
  if (!campaign) notFound();

  const rows = campaign.utmLinks.map((l) => ({
    id: l.id,
    variant: l.variant ?? "—",
    platform: l.platform,
    platformLabel: PLATFORM_LABEL[l.platform] ?? l.platform,
    fullUrl: l.fullUrl,
    shortUrl: l.shortCode ? `https://gofnl.co/${l.shortCode}` : null,
    clickCount: Number(l.clickCount),
  }));

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Links"
        description="UTM-tagged destinations + short links for every variant. Track click counts in real time."
      />
      {rows.length === 0 ? (
        <EmptyCard
          title="No links yet"
          description="Links are generated automatically when copy is approved."
        />
      ) : (
        <LinksTable campaignId={campaign.id} rows={rows} />
      )}
    </div>
  );
}
