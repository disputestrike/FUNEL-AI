"use client";

/**
 * AI Command Center launcher.
 *
 * Opens a small modal that collects the campaign name + a freeform objective,
 * then calls POST /api/launch/campaigns to kick off the strategy → platform-
 * rec → audience pipeline. On success we deep-link the user into the cockpit
 * which immediately subscribes to the SSE side-channel for generation
 * progress.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";

interface Props {
  funnelId: string;
  variant?: "primary" | "ghost";
}

export function NewCampaignButton({ funnelId, variant = "primary" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/launch/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ funnelId, name: name.trim(), objective: objective.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't start the campaign");
      }
      const json = (await res.json()) as { campaignId: string };
      router.push(`/dashboard/campaigns/${json.campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const btnClass =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-md bg-signal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-signal-700"
      : "inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}>
        <Plus className="h-4 w-4" />
        New campaign
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-campaign-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setOpen(false);
          }}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-signal-600" />
              <h2 id="new-campaign-title" className="text-base font-semibold text-slate-950">
                Launch a new campaign
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              GoFunnelAI will generate strategy, audiences, copy, creative, and tracking
              across every recommended platform.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Campaign name
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q3 lead push"
                  maxLength={120}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Objective
                </span>
                <textarea
                  required
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Book 100 qualified discovery calls from local home-service contractors in 30 days."
                  rows={3}
                  maxLength={400}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </label>
            </div>

            {error ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !objective.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-signal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate plan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
