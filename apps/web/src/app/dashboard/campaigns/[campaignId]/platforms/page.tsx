/**
 * Platforms tab — CampaignPlatform table.
 *
 * Each row is one platform allocation (objective + budget). Expandable
 * region exposes platform-specific notes pulled from the orchestrator's
 * platform-rec output (creative requirements, bidding strategy hints,
 * spend pacing).
 */
import { notFound, redirect } from "next/navigation";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard, PLATFORM_LABEL } from "../_shared/state";
import { PlatformsTable } from "../_clients/PlatformsTable.client";

export const metadata = { title: "Platforms | GoFunnelAI" };

export default async function PlatformsPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        platforms: { orderBy: { platform: "asc" } },
      },
    }),
  );
  if (!campaign) notFound();

  // Currency + platform-specific notes are persisted by the orchestrator's
  // platform-rec output; until that lands on a Campaign field we use a
  // sensible default and surface "—" for notes.
  const currency = "USD";

  const rows = campaign.platforms.map((p) => {
    const notes: string | null = null;
    return {
      id: p.id,
      platform: p.platform,
      platformLabel: PLATFORM_LABEL[p.platform] ?? p.platform,
      status: p.status,
      objective: p.objective,
      budgetDaily: p.budgetDaily ? Number(p.budgetDaily) / 1_000_000 : null,
      budgetTotal: p.budgetTotal ? Number(p.budgetTotal) / 1_000_000 : null,
      currency,
      notes,
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Platforms"
        description="One row per ad platform. Budget + status are stored locally; you'll mark each platform as launched once you publish externally."
      />
      {rows.length === 0 ? (
        <EmptyCard
          title="No platforms yet"
          description="Approve the campaign plan to populate the recommended platform mix."
        />
      ) : (
        <PlatformsTable campaignId={campaign.id} rows={rows} />
      )}
    </div>
  );
}
