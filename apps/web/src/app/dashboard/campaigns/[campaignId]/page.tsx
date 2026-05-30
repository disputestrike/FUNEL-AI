/**
 * Campaign Plan tab — the canonical strategy summary surface.
 *
 * Pulls the campaign + its primary audience + the latest CampaignPlatform
 * recommendations + the latest LaunchScore. The body mirrors the structured
 * output of packages/orchestrator/src/launch/strategy.ts but speaks the
 * branded vocabulary — no agent names, no version strings.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, PLATFORM_LABEL } from "./_shared/state";
import { PlanActions } from "./_clients/PlanActions.client";

export const metadata = { title: "Campaign Plan | GoFunnelAI" };

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

export default async function CampaignPlanPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        platforms: { orderBy: { platform: "asc" } },
        audienceProfiles: { take: 4, orderBy: { createdAt: "desc" } },
        launchScores: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    }),
  );
  if (!campaign) notFound();

  // The narrative pieces of the plan (summary, pain point, offer, CTA,
  // ranked platform recommendations) live in the strategy agent's output.
  // Once that's persisted alongside the campaign we'll surface it here;
  // for now we degrade gracefully to the structured fields we *do* have.
  const summary: string | null = null;
  const painPoint: string | null = null;
  const mainOffer: string | null = null;
  const primaryCta: string | null = null;
  const recommendations: Array<{ platform: string; fitScore: number; reason?: string }> = [];

  const score = campaign.launchScores[0]?.launchReadiness
    ? Number(campaign.launchScores[0].launchReadiness)
    : null;

  const isGenerating = campaign.status === "generating";

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Campaign plan"
        description="The strategy, audience read, and platform mix GoFunnelAI proposes for this campaign."
        action={
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
              STATUS_TONE[campaign.status] ?? STATUS_TONE.draft
            }`}
          >
            {campaign.status.replace(/_/g, " ")}
          </span>
        }
      />

      {isGenerating ? (
        <div className="rounded-xl border border-signal-200 bg-signal-50 p-6">
          <p className="text-sm font-medium text-signal-800">
            We're drafting your plan. This usually takes 30–60 seconds.
          </p>
          <p className="mt-1 text-xs text-signal-700">
            You can leave this page — every tab will fill in as the work completes.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strategy</h3>
          {summary ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">
              {summary}
            </p>
          ) : (
            <p className="mt-3 text-sm italic text-slate-400">
              {isGenerating
                ? "Drafting your strategy…"
                : "No strategy summary yet — regenerate the plan to produce one."}
            </p>
          )}

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Objective
              </dt>
              <dd className="mt-1 text-sm text-slate-800">
                {campaign.goal ?? <span className="italic text-slate-400">Not set</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pain point
              </dt>
              <dd className="mt-1 text-sm text-slate-800">
                {painPoint ?? <span className="italic text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Main offer
              </dt>
              <dd className="mt-1 text-sm text-slate-800">
                {mainOffer ?? <span className="italic text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary CTA
              </dt>
              <dd className="mt-1 text-sm text-slate-800">
                {primaryCta ?? <span className="italic text-slate-400">—</span>}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Target audiences
            </h4>
            {campaign.audienceProfiles.length === 0 ? (
              <p className="mt-2 text-sm italic text-slate-400">
                Audiences will appear once the plan finishes.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {campaign.audienceProfiles.map((a) => {
                  const t = a.targeting as Record<string, unknown>;
                  const headline =
                    typeof t?.headline === "string"
                      ? t.headline
                      : typeof t?.summary === "string"
                        ? t.summary
                        : `${PLATFORM_LABEL[a.platform] ?? a.platform} audience`;
                  const desc = typeof t?.description === "string" ? t.description : null;
                  return (
                    <li
                      key={a.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                    >
                      <p className="text-sm font-medium text-slate-900">{headline}</p>
                      {desc ? <p className="mt-1 text-xs text-slate-600">{desc}</p> : null}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                        {PLATFORM_LABEL[a.platform] ?? a.platform}
                        {a.estimatedReach
                          ? ` · est. reach ${Number(a.estimatedReach).toLocaleString()}`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <aside className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recommended platforms
            </h3>
            {recommendations.length === 0 && campaign.platforms.length === 0 ? (
              <p className="mt-3 text-sm italic text-slate-400">
                Platform recommendations will appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(recommendations.length > 0
                  ? recommendations.map((r) => ({
                      platform: r.platform,
                      fit: r.fitScore,
                      note: r.reason,
                    }))
                  : campaign.platforms.map((p) => ({
                      platform: p.platform,
                      fit: null as number | null,
                      note: p.objective ?? null,
                    }))
                ).map((row, i) => (
                  <li
                    key={`${row.platform}-${i}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {PLATFORM_LABEL[row.platform] ?? row.platform}
                      </p>
                      {row.note ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{row.note}</p>
                      ) : null}
                    </div>
                    {row.fit !== null ? <FitChip score={row.fit} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {score !== null ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Readiness snapshot
              </h3>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {Math.round(score)}
                <span className="ml-1 text-sm font-medium text-slate-500">/ 100</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                See <a className="font-medium text-signal-600 hover:underline" href="./tracking">
                  Tracking
                </a>{" "}
                and <a className="font-medium text-signal-600 hover:underline" href="./compliance">
                  Compliance
                </a>{" "}
                to raise it.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <PlanActions campaignId={campaign.id} status={campaign.status} />
    </div>
  );
}

function FitChip({ score }: { score: number }) {
  const pct = score > 1 ? Math.round(score) : Math.round(score * 100);
  const tone =
    pct >= 80
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : pct >= 50
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tone}`}
    >
      Fit {pct}
    </span>
  );
}
