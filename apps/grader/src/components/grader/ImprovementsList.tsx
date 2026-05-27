import { ArrowRight } from "lucide-react";
import type { Improvement } from "@funnel/shared";

import { cn } from "@/lib/utils";

interface ImprovementsListProps {
  improvements: Improvement[];
}

const LIFT_COLOR: Record<string, string> = {
  high: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  low: "bg-ink-50 text-ink-900/70",
};

export function ImprovementsList({ improvements }: ImprovementsListProps) {
  if (improvements.length === 0) {
    return <p className="text-sm text-ink-900/50">No improvement candidates found.</p>;
  }
  return (
    <ol className="space-y-4">
      {improvements.map((imp, idx) => (
        <li key={imp.id} className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink-900">{imp.title}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    LIFT_COLOR[imp.estimated_lift] ?? LIFT_COLOR.low,
                  )}
                >
                  {imp.estimated_lift} lift
                </span>
                <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-900/70">
                  {imp.effort} effort
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-900/70">{imp.detail}</p>
              {(imp.before || imp.after) && (
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  {imp.before && (
                    <div className="rounded-md bg-ink-50 p-3">
                      <div className="text-[10px] font-semibold uppercase text-ink-900/40">Before</div>
                      <div className="mt-1 text-ink-900/80">{imp.before}</div>
                    </div>
                  )}
                  {imp.after && (
                    <div className="rounded-md bg-brand-50 p-3">
                      <div className="text-[10px] font-semibold uppercase text-brand-700">After</div>
                      <div className="mt-1 text-ink-900/90">{imp.after}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <ArrowRight className="hidden h-5 w-5 shrink-0 text-ink-900/30 sm:block" />
          </div>
        </li>
      ))}
    </ol>
  );
}
