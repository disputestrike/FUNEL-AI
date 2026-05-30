/**
 * Compliance tab — review list + risk score.
 *
 * Filterable by severity (info / warn / block). The aggregate risk score
 * is the average severity weight; blockers single-handedly prevent the
 * EXPORTED state transition (the lifecycle guard lives in the orchestrator
 * — this surface just refuses the user-facing "Generate package" action).
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard } from "../_shared/state";
import { ComplianceList } from "../_clients/ComplianceList.client";

export const metadata = { title: "Compliance | GoFunnelAI" };

const SEVERITY_WEIGHT: Record<string, number> = {
  info: 5,
  low: 15,
  medium: 35,
  high: 60,
  critical: 85,
  blocker: 100,
};

const BUCKET: Record<string, "info" | "warn" | "block"> = {
  info: "info",
  low: "info",
  medium: "warn",
  high: "warn",
  critical: "warn",
  blocker: "block",
};

export default async function CompliancePage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        complianceReviews: { orderBy: { createdAt: "desc" }, take: 500 },
      },
    }),
  );
  if (!campaign) notFound();

  const rows = campaign.complianceReviews.map((r) => ({
    id: r.id,
    severity: r.severity,
    bucket: BUCKET[r.severity] ?? "info",
    category: r.category,
    message: r.message,
    suggestion: r.suggestion,
    assetId: r.assetId,
  }));

  // Aggregate risk score (0..100) + per-category breakdown.
  const score =
    rows.length === 0
      ? 0
      : Math.round(
          rows.reduce((s, r) => s + (SEVERITY_WEIGHT[r.severity] ?? 0), 0) / rows.length,
        );

  const categories = new Map<string, { count: number; worst: number }>();
  for (const r of rows) {
    const w = SEVERITY_WEIGHT[r.severity] ?? 0;
    const c = categories.get(r.category) ?? { count: 0, worst: 0 };
    c.count += 1;
    c.worst = Math.max(c.worst, w);
    categories.set(r.category, c);
  }

  const hasBlocker = rows.some((r) => r.bucket === "block");

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Compliance"
        description="Findings from GoFunnelAI's policy checks. Blockers must be resolved before you can export."
      />
      {rows.length === 0 ? (
        <EmptyCard
          title="No findings yet"
          description="A compliance review runs automatically after copy and creative are drafted."
        />
      ) : (
        <ComplianceList
          campaignId={campaign.id}
          rows={rows}
          score={score}
          hasBlocker={hasBlocker}
          categoryBreakdown={Array.from(categories.entries()).map(([k, v]) => ({
            category: k,
            count: v.count,
            worst: v.worst,
          }))}
        />
      )}
    </div>
  );
}
