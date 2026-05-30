/**
 * GoFunnelAI — Launch Center cockpit shell.
 *
 * 11-tab navigation around a single Campaign:
 *
 *   Campaign Plan · Platforms · Audiences · Copy · Images · Videos ·
 *   Links · Follow-Up · Tracking · Compliance · Export
 *
 * The header pins a LaunchReadinessScore badge top-right, color-coded:
 *   >= 80 green, 50–79 amber, < 50 red. It refreshes from a server-rendered
 *   snapshot and is intended to be hot-updated by the SSE side-channel that
 *   the cockpit subscribes to inside `CockpitLiveBridge`.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Rocket } from "lucide-react";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { CockpitTabs } from "./CockpitTabs.client";
import { CockpitLiveBridge } from "./CockpitLiveBridge.client";

export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
  params: { campaignId: string };
}

const STATUS_COPY: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready_for_review: "Ready for review",
  approved: "Approved",
  exported: "Exported",
  launched_externally: "Launched externally",
  tracking_active: "Tracking live",
  optimizing: "Optimizing",
  archived: "Archived",
};

export default async function CockpitLayout({ children, params }: LayoutProps) {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=/dashboard/campaigns/${params.campaignId}`);

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        launchScores: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    }),
  );
  if (!campaign) notFound();

  const score = campaign.launchScores[0]?.launchReadiness
    ? Number(campaign.launchScores[0].launchReadiness)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/dashboard/funnels/${campaign.funnelId}/launch-center`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Launch Center
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 truncate text-sm font-semibold text-slate-950">
                  <Rocket className="h-4 w-4 shrink-0 text-signal-600" />
                  <span className="truncate">{campaign.name}</span>
                </h1>
                <p className="truncate text-xs text-slate-500">
                  {STATUS_COPY[campaign.status] ?? campaign.status}
                  {campaign.goal ? ` · ${campaign.goal}` : ""}
                </p>
              </div>
            </div>
            <ReadinessBadge initialScore={score} campaignId={campaign.id} />
          </div>
          <CockpitTabs campaignId={campaign.id} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

      <CockpitLiveBridge campaignId={campaign.id} />
    </div>
  );
}

function ReadinessBadge({
  initialScore,
  campaignId,
}: {
  initialScore: number | null;
  campaignId: string;
}) {
  return (
    <div
      data-launch-readiness
      data-campaign-id={campaignId}
      className="shrink-0"
      aria-label="Launch readiness score"
    >
      <ReadinessPill score={initialScore} />
    </div>
  );
}

function ReadinessPill({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Readiness — pending
      </span>
    );
  }
  const tone =
    score >= 80
      ? { ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" }
      : score >= 50
        ? { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }
        : { ring: "ring-rose-200", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${tone.bg} px-3 py-1.5 text-xs font-semibold ${tone.text} ring-1 ring-inset ${tone.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      Readiness {Math.round(score)} / 100
    </span>
  );
}
