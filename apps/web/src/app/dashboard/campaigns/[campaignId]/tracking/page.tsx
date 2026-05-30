/**
 * Tracking tab — LaunchChecklist grouped by tier.
 *
 * Tiers: Required (must-pass to advance), Recommended, Optional. Each
 * checklist item is the structured output of tracking-setup.ts —
 * `key`, `label`, `status`, `details`, optional `required` flag.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard } from "../_shared/state";
import { ChecklistView } from "../_clients/ChecklistView.client";

export const metadata = { title: "Tracking | GoFunnelAI" };

export default async function TrackingPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        launchChecklists: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  );
  if (!campaign) notFound();

  const checklist = campaign.launchChecklists[0];
  const items = Array.isArray(checklist?.items)
    ? (checklist!.items as Array<Record<string, unknown>>)
    : [];

  const shaped = items.map((it) => ({
    key: String(it.key ?? "unknown"),
    label: String(it.label ?? "Untitled item"),
    status: String(it.status ?? "pending"),
    required: it.required === true,
    tier:
      it.tier === "recommended" || it.tier === "optional" ? (it.tier as string) : it.required === true ? "required" : "recommended",
    details: typeof it.details === "string" ? it.details : null,
  }));

  const total = shaped.length;
  const passed = shaped.filter((i) => i.status === "passed").length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Tracking & launch checklist"
        description="Everything GoFunnelAI watches before letting you go live. Required items must pass to ship."
      />
      {total === 0 ? (
        <EmptyCard
          title="No checklist yet"
          description="The launch checklist is generated once the plan is approved."
        />
      ) : (
        <ChecklistView
          campaignId={campaign.id}
          items={shaped}
          pct={pct}
          passed={passed}
          total={total}
        />
      )}
    </div>
  );
}
