"use client";

/**
 * Approve / Regenerate / Edit footer for the Campaign Plan tab.
 *
 * Approve transitions Draft → ReadyForReview or ReadyForReview → Approved
 * (the orchestrator's lifecycle module is the authority — we just call the
 * server action and refresh).
 *
 * Regenerate prompts for an optional "reason" the user wants reflected in
 * the new draft (e.g. "shorter, more urgency"), then forwards to the
 * strategy agent.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCcw, Pencil, Loader2 } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Props {
  campaignId: string;
  status: string;
}

export function PlanActions({ campaignId, status }: Props) {
  const router = useRouter();
  const { run, pending } = useLaunchMutation();
  const [regenOpen, setRegenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canApprove = status === "ready_for_review" || status === "draft";
  const canRegen = status !== "launched_externally" && status !== "archived";

  async function approve() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/plan/approve`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve the plan");
    }
  }

  async function regenerate() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/plan/regenerate`, { reason: reason.trim() || null });
      setRegenOpen(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't regenerate the plan");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-slate-500">
        {status === "approved" ? (
          <>Plan approved. Move on to <span className="font-medium text-slate-700">Platforms →</span></>
        ) : status === "generating" ? (
          <>Draft in progress…</>
        ) : (
          <>Review the strategy before approving — every downstream tab inherits these decisions.</>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/campaigns/${campaignId}/platforms`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setRegenOpen((v) => !v)}
          disabled={!canRegen || pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={!canApprove || pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approve plan
        </button>
      </div>

      {regenOpen ? (
        <div className="basis-full">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              What should change? (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Tighten the angle around speed-to-value, less price-focused."
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
            />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Run again
            </button>
            <button
              type="button"
              onClick={() => setRegenOpen(false)}
              className="rounded-md px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="basis-full rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
