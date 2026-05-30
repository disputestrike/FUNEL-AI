"use client";

/**
 * UTM links table with copy + QR popover.
 *
 * The QR code is rendered inline via a chart.googleapis.com fallback (the
 * lightweight option that doesn't require a npm dep); a custom domain QR
 * generator can be swapped in here later without changing the API.
 */
import { useState } from "react";
import { Copy, Loader2, QrCode, Sparkles } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Row {
  id: string;
  variant: string;
  platform: string;
  platformLabel: string;
  fullUrl: string;
  shortUrl: string | null;
  clickCount: number;
}

export function LinksTable({ campaignId, rows }: { campaignId: string; rows: Row[] }) {
  const { run, pending } = useLaunchMutation();
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateRetargeting() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/retargeting/generate`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate retargeting links");
    }
  }

  const exportHref = `/api/launch/campaigns/${campaignId}/links.csv`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">
          {rows.length} link{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.reduce((s, r) => s + r.clickCount, 0).toLocaleString()} clicks
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Export CSV
          </a>
          <button
            type="button"
            onClick={generateRetargeting}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate retargeting links
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Variant</th>
              <th className="px-4 py-2 text-left font-medium">Platform</th>
              <th className="px-4 py-2 text-left font-medium">URL</th>
              <th className="px-4 py-2 text-right font-medium">Clicks</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs font-mono text-slate-700">{r.variant}</td>
                <td className="px-4 py-3 text-xs text-slate-700">{r.platformLabel}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="break-all font-mono text-[11px] text-slate-700">{r.fullUrl}</p>
                    {r.shortUrl ? (
                      <p className="break-all font-mono text-[11px] text-signal-700">{r.shortUrl}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {r.clickCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="relative inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(r.shortUrl ?? r.fullUrl)}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrFor(qrFor === r.id ? null : r.id)}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      title="Show QR code"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                    {qrFor === r.id ? (
                      <div className="absolute right-0 top-7 z-10 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://chart.googleapis.com/chart?cht=qr&chs=160x160&chl=${encodeURIComponent(r.shortUrl ?? r.fullUrl)}`}
                          alt="QR code"
                          width={160}
                          height={160}
                        />
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
