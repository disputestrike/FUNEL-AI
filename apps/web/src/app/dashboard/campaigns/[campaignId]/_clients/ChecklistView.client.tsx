"use client";

/**
 * Launch checklist view with tier grouping, mark-as-ready, recheck-all.
 */
import { Fragment, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, RefreshCcw } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Item {
  key: string;
  label: string;
  status: string;
  required: boolean;
  tier: string;
  details: string | null;
}

const TIER_ORDER = ["required", "recommended", "optional"] as const;
const TIER_LABEL: Record<string, string> = {
  required: "Required",
  recommended: "Recommended",
  optional: "Optional",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  passed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  skipped: "bg-slate-100 text-slate-500 ring-slate-200",
  not_applicable: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ChecklistView({
  campaignId,
  items,
  pct,
  passed,
  total,
}: {
  campaignId: string;
  items: Item[];
  pct: number;
  passed: number;
  total: number;
}) {
  const { run, pending } = useLaunchMutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function markReady(key: string) {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/tracking/items/${key}/ready`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark as ready");
    }
  }

  async function recheckAll() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/tracking/recheck`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the recheck");
    }
  }

  const tone =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Overall readiness
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {pct}%
              <span className="ml-2 text-sm font-medium text-slate-500">
                {passed} of {total}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={recheckAll}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Recheck all
          </button>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {TIER_ORDER.map((tier) => {
        const tierItems = items.filter((i) => i.tier === tier);
        if (tierItems.length === 0) return null;
        return (
          <section
            key={tier}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {TIER_LABEL[tier]}
            </h3>
            <ul className="divide-y divide-slate-100">
              {tierItems.map((it) => {
                const isOpen = expanded.has(it.key);
                return (
                  <Fragment key={it.key}>
                    <li className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                            STATUS_TONE[it.status] ?? STATUS_TONE.pending
                          }`}
                        >
                          {it.status.replace(/_/g, " ")}
                        </span>
                        <p className="truncate text-sm text-slate-800">{it.label}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => markReady(it.key)}
                          disabled={pending || it.status === "passed"}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Mark ready
                        </button>
                        {it.details ? (
                          <button
                            type="button"
                            onClick={() => toggle(it.key)}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </li>
                    {isOpen && it.details ? (
                      <li className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                          {it.details}
                        </pre>
                      </li>
                    ) : null}
                  </Fragment>
                );
              })}
            </ul>
          </section>
        );
      })}

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
