"use client";

/**
 * Interactive platforms table — expandable rows, add/remove, mark launched.
 */
import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

const PLATFORM_CHOICES: Array<{ value: string; label: string }> = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "snapchat", label: "Snapchat" },
  { value: "pinterest", label: "Pinterest" },
  { value: "reddit", label: "Reddit" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  exported: "Exported",
  launched: "Launched externally",
  paused: "Paused",
  archived: "Archived",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  ready: "bg-amber-50 text-amber-700 ring-amber-200",
  exported: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  launched: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-slate-100 text-slate-500 ring-slate-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

interface Row {
  id: string;
  platform: string;
  platformLabel: string;
  status: string;
  objective: string | null;
  budgetDaily: number | null;
  budgetTotal: number | null;
  currency: string;
  notes: string | null;
}

export function PlatformsTable({
  campaignId,
  rows,
}: {
  campaignId: string;
  rows: Row[];
}) {
  const { run, pending } = useLaunchMutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markLaunched(rowId: string) {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/platforms/${rowId}/mark-launched`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update status");
    }
  }

  async function addPlatform(platform: string) {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/platforms`, { platform });
      setAddOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the platform");
    }
  }

  const used = new Set(rows.map((r) => r.platform));
  const available = PLATFORM_CHOICES.filter((c) => !used.has(c.value));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">
          {rows.length} platform{rows.length === 1 ? "" : "s"}
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            disabled={available.length === 0 || pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add platform
          </button>
          {addOpen ? (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-slate-200 bg-white shadow-lg">
              <ul className="max-h-64 overflow-auto py-1">
                {available.map((c) => (
                  <li key={c.value}>
                    <button
                      type="button"
                      onClick={() => addPlatform(c.value)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Platform</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="hidden px-4 py-2 text-left font-medium md:table-cell">Objective</th>
            <th className="px-4 py-2 text-right font-medium">Budget / day</th>
            <th className="w-12 px-4 py-2 text-right" aria-label="expand" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.platformLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        STATUS_TONE[r.status] ?? STATUS_TONE.draft
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-700 md:table-cell">
                    {r.objective ?? <span className="italic text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.budgetDaily !== null
                      ? `${r.currency} ${r.budgetDaily.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Collapse row" : "Expand row"}
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="bg-slate-50/40">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Platform-specific notes
                          </h4>
                          {r.notes ? (
                            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
                              {r.notes}
                            </pre>
                          ) : (
                            <p className="mt-2 text-xs italic text-slate-400">
                              No platform-specific notes yet.
                            </p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Actions
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => markLaunched(r.id)}
                              disabled={pending || r.status === "launched"}
                              className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
                            >
                              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                              Mark launched externally
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {error ? (
        <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
