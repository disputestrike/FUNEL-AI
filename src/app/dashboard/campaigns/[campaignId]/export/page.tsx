/**
 * Export tab.
 *
 *   1. Big "Generate launch package" CTA (disabled while compliance has
 *      blockers — the orchestrator's lifecycle module will reject the
 *      transition either way; we just keep the UX consistent).
 *   2. ExportPackage list with PDF / CSV / ZIP downloads + file size.
 *   3. "Mark campaign as launched externally" footer CTA.
 *   4. Once launched: live TrackingEvent feed wired into the SSE bridge.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading } from "../_shared/state";
import { ExportPanel } from "../_clients/ExportPanel.client";

export const metadata = { title: "Export | GoFunnelAI" };

export default async function ExportPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        exportPackages: { orderBy: { createdAt: "desc" } },
        complianceReviews: { where: { severity: "blocker" }, select: { id: true } },
        trackingEvents: {
          orderBy: { occurredAt: "desc" },
          take: 20,
        },
      },
    }),
  );
  if (!campaign) notFound();

  const blocked = campaign.complianceReviews.length > 0;
  const isLive =
    campaign.status === "launched_externally" || campaign.status === "tracking_active";

  const packages = campaign.exportPackages.map((p) => ({
    id: p.id,
    format: p.format,
    status: p.status,
    url: p.url,
    generatedAt: p.generatedAt?.toISOString() ?? null,
    downloadCount: p.downloadCount,
  }));

  const initialEvents = campaign.trackingEvents.map((e) => ({
    id: e.id,
    type: e.eventType,
    occurredAt: e.occurredAt.toISOString(),
    properties: (e.properties ?? {}) as Record<string, unknown>,
  }));

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Export & launch"
        description="Package everything for upload to your ad managers, then mark the campaign as launched."
      />
      <ExportPanel
        campaignId={campaign.id}
        status={campaign.status}
        blocked={blocked}
        isLive={isLive}
        packages={packages}
        initialEvents={initialEvents}
      />
    </div>
  );
}
