import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
  icon?: ReactNode;
}) {
  const toneCls = {
    neutral: "border-slate-200",
    success: "border-success-200 bg-success-50/40",
    warning: "border-warning-200 bg-warning-50/40",
    error: "border-error-200 bg-error-50/40",
  }[tone];
  return (
    <div className={cn("rounded-lg border bg-white p-3", toneCls)}>
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-1 text-h4 num text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-caption text-slate-500">{hint}</div> : null}
    </div>
  );
}
