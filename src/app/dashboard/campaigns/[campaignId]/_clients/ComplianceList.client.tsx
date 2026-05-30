"use client";

/**
 * Compliance review list + filterable risk score + per-category breakdown.
 */
import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, Check, Info, Loader2, Sparkles } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Row {
  id: string;
  severity: string;
  bucket: "info" | "warn" | "block";
  category: string;
  message: string;
  suggestion: string | null;
  assetId: string | null;
}

const BUCKET_LABEL: Record<string, string> = {
  info: "Info",
  warn: "Warn",
  block: "Block",
};

const BUCKET_ICON = {
  info: Info,
  warn: AlertTriangle,
  block: AlertOctagon,
};

const BUCKET_TONE: Record<string, string> = {
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  block: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function ComplianceList({
  campaignId,
  rows,
  score,
  hasBlocker,
  categoryBreakdown,
}: {
  campaignId: string;
  rows: Row[];
  score: number;
  hasBlocker: boolean;
  categoryBreakdown: Array<{ category: string; count: number; worst: number }>;
}) {
  const { run, pending } = useLaunchMutation();
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "block">("all");
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.bucket === filter)),
    [rows, filter],
  );

  async function applySuggestion(id: string) {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/compliance/${id}/apply`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply the suggestion");
    }
  }

  const riskTone =
    score >= 60
      ? "text-rose-700"
      : score >= 30
        ? "text-amber-700"
        : "text-emerald-700";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compliance risk score
          </p>
          <p className={`mt-1 text-3xl font-bold ${riskTone}`}>
            {score}
            <span className="ml-1 text-sm font-medium text-slate-500">/ 100</span>
          </p>
          {hasBlocker ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertOctagon className="h-3 w-3" />
              Blocker present — export disabled
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-600">No blockers — export is unlocked.</p>
          )}
        </div>
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category breakdown
          </p>
          <ul className="mt-2 space-y-2">
            {categoryBreakdown.map((c) => {
              const tone =
                c.worst >= 80
                  ? "bg-rose-500"
                  : c.worst >= 40
                    ? "bg-amber-500"
                    : "bg-sky-500";
              return (
                <li key={c.category}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      {c.count} finding{c.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${tone}`} style={{ width: `${c.worst}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "info", "warn", "block"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setFilter(b)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
              filter === b
                ? "bg-signal-50 text-signal-700 ring-signal-200"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {b === "all" ? "All" : BUCKET_LABEL[b]} ·{" "}
            {b === "all" ? rows.length : rows.filter((r) => r.bucket === b).length}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visible.map((r) => {
          const Icon = BUCKET_ICON[r.bucket];
          return (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                    BUCKET_TONE[r.bucket]
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        BUCKET_TONE[r.bucket]
                      }`}
                    >
                      {r.severity}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {r.category}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-900">{r.message}</p>
                  {r.suggestion ? (
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">Suggestion:</span> {r.suggestion}
                    </p>
                  ) : null}
                </div>
                {r.suggestion ? (
                  <button
                    type="button"
                    onClick={() => applySuggestion(r.id)}
                    disabled={pending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-signal-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Apply
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
