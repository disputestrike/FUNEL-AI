"use client";

/**
 * Ad variant card.
 *
 * Surfaces: angle badge, status badge, primary text, headline, optional
 * description, CTA, per-field char counters (red if over the platform
 * limit), inline policy warnings, and the standard variant actions.
 */
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Pencil,
  RefreshCcw,
  Files,
} from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Variant {
  id: string;
  platform: string;
  angle: string;
  primaryText: string;
  headline: string;
  description: string | null;
  ctaText: string | null;
  status: string;
}

interface Limits {
  primaryText: number;
  headline: number;
  description: number | null;
}

interface Flag {
  severity: string;
  category: string;
  message: string;
}

const ANGLE_LABEL: Record<string, string> = {
  pain: "Pain",
  roi: "ROI",
  speed: "Speed",
  proof: "Proof",
  comparison: "Comparison",
  fear: "Fear",
  convenience: "Convenience",
  trust: "Trust",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  ready: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function CopyVariantCard({
  campaignId,
  variant,
  limits,
  flags,
}: {
  campaignId: string;
  variant: Variant;
  limits: Limits;
  flags: Flag[];
}) {
  const { run, pending } = useLaunchMutation();
  const [regenOpen, setRegenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/variants/${variant.id}/approve`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve");
    }
  }

  async function regenerate() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/variants/${variant.id}/regenerate`, {
        reason: reason.trim() || null,
      });
      setRegenOpen(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't regenerate");
    }
  }

  async function duplicate() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/variants/${variant.id}/duplicate`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't duplicate");
    }
  }

  function copyAll() {
    const text = [
      variant.headline,
      variant.primaryText,
      variant.description ?? "",
      variant.ctaText ? `CTA: ${variant.ctaText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-signal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-700 ring-1 ring-inset ring-signal-200">
            {ANGLE_LABEL[variant.angle] ?? variant.angle}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              STATUS_TONE[variant.status] ?? STATUS_TONE.draft
            }`}
          >
            {variant.status}
          </span>
        </div>
        <button
          type="button"
          onClick={copyAll}
          title="Copy all"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="mt-3 space-y-3 text-sm">
        <Field
          label="Headline"
          value={variant.headline}
          length={variant.headline.length}
          limit={limits.headline}
        />
        <Field
          label="Primary text"
          value={variant.primaryText}
          length={variant.primaryText.length}
          limit={limits.primaryText}
          multiline
        />
        {variant.description !== null && limits.description !== null ? (
          <Field
            label="Description"
            value={variant.description}
            length={variant.description.length}
            limit={limits.description}
          />
        ) : null}
        {variant.ctaText ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              CTA
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{variant.ctaText}</p>
          </div>
        ) : null}
      </div>

      {flags.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {flags.slice(0, 3).map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <span className="font-semibold">{f.category}:</span> {f.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={approve}
          disabled={pending || variant.status === "approved"}
          className="inline-flex items-center gap-1 rounded-md bg-signal-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Approve
        </button>
        <button
          type="button"
          onClick={() => setRegenOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw className="h-3 w-3" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={duplicate}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Files className="h-3 w-3" />
          Duplicate
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          title="Inline edit (opens edit modal — wired to Cockpit editor)"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </footer>

      {regenOpen ? (
        <div className="mt-2 rounded-lg bg-slate-50/70 p-2 ring-1 ring-inset ring-slate-200">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="Less jargon, more concrete numbers."
            className="block w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
          />
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-signal-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-signal-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
              Run again
            </button>
            <button
              type="button"
              onClick={() => setRegenOpen(false)}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p>
      ) : null}
    </article>
  );
}

function Field({
  label,
  value,
  length,
  limit,
  multiline,
}: {
  label: string;
  value: string;
  length: number;
  limit: number;
  multiline?: boolean;
}) {
  const exceeded = limit > 0 && length > limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-[10px] tabular-nums ${exceeded ? "font-semibold text-rose-600" : "text-slate-400"}`}>
          {length}/{limit || "—"}
        </p>
      </div>
      <p className={`mt-0.5 ${multiline ? "whitespace-pre-line" : ""} text-sm text-slate-900`}>
        {value}
      </p>
    </div>
  );
}
