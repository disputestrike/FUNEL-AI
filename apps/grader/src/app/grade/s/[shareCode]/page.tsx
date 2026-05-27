import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/grader/Footer";
import { ImprovementsList } from "@/components/grader/ImprovementsList";
import { ScoreDial } from "@/components/grader/ScoreDial";
import { SubScoreCard } from "@/components/grader/SubScoreCard";
import { prisma } from "@funnel/db";
import { isValidShareCode } from "@/lib/share-code";
import { shareMetadata } from "@/lib/seo";
import { displayUrl } from "@/lib/utils";
import type { AgentName, FinalScore, Improvement } from "@funnel/shared";

interface SharePageProps {
  params: { shareCode: string };
}

export const revalidate = 3600; // share content is immutable per audit, cache 1h

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  if (!isValidShareCode(params.shareCode)) return {};
  const share = await prisma.shareCode.findUnique({
    where: { code: params.shareCode },
    include: { audit: true },
  });
  if (!share || !share.audit.scoreOverall) return {};

  return shareMetadata({
    shareCode: params.shareCode,
    url: share.audit.url,
    scoreOverall: share.audit.scoreOverall,
    grade: share.audit.scoreGrade ?? "—",
    topLine: (share.audit.critique ?? "").slice(0, 140),
  });
}

export default async function SharePage({ params }: SharePageProps) {
  if (!isValidShareCode(params.shareCode)) notFound();
  const share = await prisma.shareCode.findUnique({
    where: { code: params.shareCode },
    include: { audit: true },
  });
  if (!share || share.audit.status !== "done") notFound();

  // Increment view count async (don't block render).
  void prisma.shareCode
    .update({
      where: { code: params.shareCode },
      data: { viewCount: { increment: 1 }, lastViewed: new Date() },
    })
    .catch(() => null);

  const audit = share.audit;
  const score: FinalScore = {
    overall: audit.scoreOverall ?? 0,
    grade: (audit.scoreGrade ?? "F") as FinalScore["grade"],
    subscores: (audit.subscores as FinalScore["subscores"]) ?? {
      hook: 0,
      form: 0,
      trust: 0,
      speed: 0,
      compliance: 0,
    },
    critique: audit.critique ?? "",
    improvements: (audit.improvements as Improvement[]) ?? [],
    confidence: (audit.confidence as FinalScore["confidence"]) ?? "high",
    degraded_agents: (audit.degradedAgents ?? []) as AgentName[],
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <header className="container pt-10 pb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold text-ink-900">Shared audit</h1>
          <span className="font-mono text-sm text-ink-900/60">{displayUrl(audit.url)}</span>
        </div>
      </header>

      <section className="container space-y-10 pb-16">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-ink-100 bg-white p-8 shadow-sm sm:flex-row">
          <ScoreDial value={score.overall} grade={score.grade} />
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-ink-900">
              Scored {score.overall}/100
            </h2>
            <p className="mt-2 text-ink-900/80">{score.critique}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(["hook", "form", "trust", "speed", "compliance"] as AgentName[]).map((a) => (
            <SubScoreCard
              key={a}
              agent={a}
              score={score.subscores[a]}
              degraded={score.degraded_agents.includes(a)}
            />
          ))}
        </div>

        <div>
          <h3 className="font-display text-xl font-bold text-ink-900">Top 3 improvements</h3>
          <div className="mt-4">
            <ImprovementsList improvements={score.improvements} />
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
          <p className="font-display text-xl font-bold text-ink-900">
            Want to grade your own page?
          </p>
          <p className="mt-1 text-sm text-ink-900/70">Free, 15 seconds, no signup.</p>
          <Link
            href="/grade"
            className="mt-4 inline-flex items-center rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Grade my page →
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
