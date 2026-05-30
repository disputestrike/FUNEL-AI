/**
 * GoFunnelAI — Level 2 Launch Center entry.
 *
 * Lists all campaigns belonging to this funnel, sorted by recency. Each row
 * deep-links into the 11-tab cockpit at /dashboard/campaigns/[campaignId].
 *
 * The "New campaign" CTA opens the AI Command Center modal which kicks off
 * the strategy → platform-rec → audience pipeline. The actual generation is
 * orchestrated server-side by packages/orchestrator/src/launch; the UI just
 * polls for status via the SSE side-channel.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Rocket, Sparkles } from "lucide-react";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { NewCampaignButton } from "./NewCampaignButton.client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Launch Center | GoFunnelAI",
};

interface PageProps {
  params: { id: string };
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  generating: "bg-signal-50 text-signal-700 ring-signal-200 animate-pulse",
  ready_for_review: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  exported: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  launched_externally: "bg-violet-50 text-violet-700 ring-violet-200",
  tracking_active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  optimizing: "bg-sky-50 text-sky-700 ring-sky-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready_for_review: "Ready for review",
  approved: "Approved",
  exported: "Exported",
  launched_externally: "Launched",
  tracking_active: "Tracking live",
  optimizing: "Optimizing",
  archived: "Archived",
};

export default async function LaunchCenterPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=/dashboard/funnels/${params.id}/launch-center`);

  const funnel = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.funnel.findFirst({
      where: { id: params.id, deletedAt: null },
    }),
  );
  if (!funnel) notFound();

  const campaigns = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findMany({
      where: { funnelId: params.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        platforms: { select: { platform: true, status: true } },
        launchScores: {
          orderBy: { computedAt: "desc" },
          take: 1,
          select: { launchReadiness: true },
        },
      },
    }),
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/funnels/${funnel.id}/edit`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Funnel
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Rocket className="h-4 w-4 text-signal-600" />
                Launch Center
              </h1>
              <p className="text-xs text-slate-500">
                Campaigns for <span className="font-medium text-slate-700">{funnel.name}</span>
              </p>
            </div>
          </div>
          <NewCampaignButton funnelId={funnel.id} />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {campaigns.length === 0 ? (
          <EmptyState funnelId={funnel.id} funnelName={funnel.name} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const score = c.launchScores[0]?.launchReadiness
                ? Number(c.launchScores[0].launchReadiness)
                : null;
              const tone = STATUS_TONE[c.status] ?? STATUS_TONE.draft;
              return (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/campaigns/${c.id}`}
                    className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-signal-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 text-sm font-semibold text-slate-950 group-hover:text-signal-700">
                        {c.name}
                      </h2>
                      <ReadinessDot score={score} />
                    </div>
                    {c.goal ? (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-600">{c.goal}</p>
                    ) : (
                      <p className="mt-2 text-xs italic text-slate-400">No objective set</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      {c.platforms.slice(0, 4).map((p) => (
                        <span
                          key={p.platform}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                        >
                          {p.platform}
                        </span>
                      ))}
                      {c.platforms.length > 4 ? (
                        <span className="text-[10px] text-slate-400">
                          +{c.platforms.length - 4}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[11px] text-slate-400">
                      Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function ReadinessDot({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
        —
      </span>
    );
  }
  const tone =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : score >= 50
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tone}`}
    >
      {Math.round(score)}
    </span>
  );
}

function EmptyState({ funnelId, funnelName }: { funnelId: string; funnelName: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-signal-50 text-signal-600">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">
        No campaigns yet for {funnelName}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Spin up a multi-platform ad campaign in under two minutes. GoFunnelAI handles
        strategy, audiences, creative, copy, tracking, and compliance for you.
      </p>
      <div className="mt-6">
        <NewCampaignButton funnelId={funnelId} variant="primary" />
      </div>
    </div>
  );
}
