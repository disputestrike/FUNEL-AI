"use client";

/**
 * Export panel.
 *
 * Generation flow + download list + launched-externally CTA + live event
 * feed (the SSE bridge dispatches `launch.tracking.event` window events
 * that this component subscribes to).
 */
import { useEffect, useState } from "react";
import {
  AlertOctagon,
  ArrowRight,
  Download,
  FileText,
  Loader2,
  Package,
  Rocket,
  Sparkles,
} from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface PackageRow {
  id: string;
  format: string;
  status: string;
  url: string | null;
  generatedAt: string | null;
  downloadCount: number;
}

interface TrackingRow {
  id: string;
  type: string;
  occurredAt: string;
  properties: Record<string, unknown>;
}

const FORMAT_LABEL: Record<string, string> = {
  meta_ads_csv: "Meta Ads CSV",
  google_ads_csv: "Google Ads CSV",
  tiktok_ads_csv: "TikTok Ads CSV",
  linkedin_campaign_manager_csv: "LinkedIn CSV",
  json: "JSON bundle",
  pdf: "PDF brief",
  zip: "Full ZIP",
  notion_markdown: "Notion markdown",
};

const FORMAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  zip: Package,
};

export function ExportPanel({
  campaignId,
  status,
  blocked,
  isLive,
  packages,
  initialEvents,
}: {
  campaignId: string;
  status: string;
  blocked: boolean;
  isLive: boolean;
  packages: PackageRow[];
  initialEvents: TrackingRow[];
}) {
  const { run, pending } = useLaunchMutation();
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TrackingRow[]>(initialEvents);

  useEffect(() => {
    function onTracking(ev: Event) {
      const ce = ev as CustomEvent<TrackingRow | null>;
      if (!ce.detail) return;
      setEvents((prev) => [ce.detail!, ...prev].slice(0, 50));
    }
    window.addEventListener("launch.tracking.event", onTracking);
    return () => window.removeEventListener("launch.tracking.event", onTracking);
  }, []);

  async function generate() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/export/generate`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the package");
    }
  }

  async function markLaunched() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/launch/mark-launched`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark as launched");
    }
  }

  const canGenerate = !blocked && !pending && status !== "generating" && status !== "archived";
  const canLaunch = packages.length > 0 && !isLive && !pending;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Launch package</h3>
            <p className="mt-1 text-sm text-slate-600">
              We'll bundle CSVs (Meta / Google / TikTok / LinkedIn), creative assets,
              tracking pixels, follow-up sequences, and a PDF brief.
            </p>
            {blocked ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertOctagon className="h-3 w-3" />
                Resolve blockers on the Compliance tab before exporting.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-signal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate launch package
          </button>
        </div>
      </section>

      {packages.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Generated packages
          </h3>
          <ul className="divide-y divide-slate-100">
            {packages.map((p) => {
              const Icon = FORMAT_ICON[p.format] ?? Download;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-signal-50 text-signal-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {FORMAT_LABEL[p.format] ?? p.format}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {p.status}
                        {p.generatedAt
                          ? ` · ${new Date(p.generatedAt).toLocaleString()}`
                          : ""}
                        {p.downloadCount > 0
                          ? ` · ${p.downloadCount} download${p.downloadCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {p.url ? (
                    <a
                      href={p.url}
                      download
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="text-[11px] italic text-slate-400">Preparing…</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col items-stretch gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            {isLive ? "Campaign launched" : "Ready to launch?"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {isLive
              ? "GoFunnelAI is mirroring tracking events from your ad managers below."
              : "Upload the packages to each ad manager, then mark this campaign as launched so we can start mirroring tracking events."}
          </p>
        </div>
        <button
          type="button"
          onClick={markLaunched}
          disabled={!canLaunch}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {isLive ? "Launched" : "Mark as launched externally"}
        </button>
      </section>

      {isLive ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Live tracking events
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              streaming
            </span>
          </div>
          {events.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Waiting for the first event…
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-auto">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 px-4 py-2 text-xs">
                  <span className="rounded-full bg-signal-50 px-2 py-0.5 text-[10px] font-semibold text-signal-700 ring-1 ring-inset ring-signal-200">
                    {ev.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700">
                      {new Date(ev.occurredAt).toLocaleString()}
                    </p>
                    {Object.keys(ev.properties).length > 0 ? (
                      <p className="truncate text-slate-500">
                        {Object.entries(ev.properties)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-1 h-3 w-3 text-slate-300" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
