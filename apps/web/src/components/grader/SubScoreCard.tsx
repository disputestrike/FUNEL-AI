import type { AgentName } from "@funnel/shared";

import { cn } from "@/lib/grader/utils";

interface SubScoreCardProps {
  agent: AgentName;
  score: number | null;
  critique?: string;
  loading?: boolean;
  degraded?: boolean;
}

const LABELS: Record<AgentName, { title: string; blurb: string }> = {
  hook: { title: "Hook strength", blurb: "Headline + value prop above the fold" },
  form: { title: "Form friction", blurb: "Field count, labels, payment surface" },
  trust: { title: "Trust signals", blurb: "Testimonials, badges, social proof" },
  speed: { title: "Mobile + speed", blurb: "LCP, FCP, CLS, performance score" },
  compliance: { title: "Compliance", blurb: "Privacy, disclosures, claims" },
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-ink-900/30";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-danger";
}

export function SubScoreCard({ agent, score, critique, loading, degraded }: SubScoreCardProps) {
  const meta = LABELS[agent];
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-900/50">{meta.title}</div>
          <div className="mt-0.5 text-xs text-ink-900/40">{meta.blurb}</div>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-12 rounded shimmer-bg" aria-hidden />
          ) : (
            <div className={cn("font-display text-3xl font-bold tabular-nums", scoreColor(score))}>
              {score === null ? "—" : score}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wide text-ink-900/40">/ 100</div>
        </div>
      </div>
      {!loading && critique && (
        <p className="mt-4 text-sm leading-snug text-ink-900/80">{critique}</p>
      )}
      {degraded && (
        <p className="mt-3 text-xs text-warning">Could not score this dimension — your overall score is unaffected.</p>
      )}
    </div>
  );
}
