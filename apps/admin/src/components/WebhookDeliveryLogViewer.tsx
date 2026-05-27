/**
 * Webhook delivery-log viewer.
 *
 * Lists each webhook delivery attempt with:
 *  - the destination URL (truncated)
 *  - HTTP status / error class
 *  - retry count (out of the policy max)
 *  - signature verification status (HMAC pass/fail/ skipped)
 *  - one-click retry — replays from the DLQ.
 */

"use client";

import { useState } from "react";
import { RefreshCw, Shield, ShieldAlert, ShieldOff } from "lucide-react";

export type WebhookStatus =
  | "delivered"
  | "retrying"
  | "failed"
  | "dropped"
  | "queued";

export interface WebhookRow {
  id: string;
  url: string;
  event_type: string;
  status: WebhookStatus;
  http_status: number | null;
  attempt: number;
  max_attempts: number;
  last_attempt_at: string;
  next_attempt_at: string | null;
  signature_verified: "pass" | "fail" | "skipped";
  error_class: string | null;
}

const STATUS_COLOR: Record<WebhookStatus, string> = {
  delivered: "bg-success-100 text-success-700",
  retrying: "bg-warning-100 text-warning-700",
  failed: "bg-error-100 text-error-700",
  dropped: "bg-slate-200 text-slate-600",
  queued: "bg-slate-100 text-slate-600",
};

function SigIcon({ s }: { s: WebhookRow["signature_verified"] }) {
  if (s === "pass") return <Shield className="h-3 w-3 text-success-600" aria-label="signature verified" />;
  if (s === "fail") return <ShieldAlert className="h-3 w-3 text-error-600" aria-label="signature failed" />;
  return <ShieldOff className="h-3 w-3 text-slate-400" aria-label="signature skipped" />;
}

export function WebhookDeliveryLogViewer({
  rows,
  onRetry,
}: {
  rows: WebhookRow[];
  onRetry?: (id: string) => Promise<void>;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-body-sm">
        <thead className="bg-slate-50 text-left text-caption uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">URL</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Attempt</th>
            <th className="px-3 py-2 font-medium">HMAC</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-caption">
                {new Date(r.last_attempt_at).toISOString().replace("T", " ").slice(0, 16)}
              </td>
              <td className="px-3 py-1.5 font-mono text-caption">{r.event_type}</td>
              <td className="max-w-xs truncate px-3 py-1.5 font-mono text-caption" title={r.url}>
                {r.url}
              </td>
              <td className="px-3 py-1.5">
                <span className={`rounded px-1.5 py-0.5 text-caption ${STATUS_COLOR[r.status]}`}>
                  {r.status}
                  {r.http_status ? <span className="ml-1 font-mono">{r.http_status}</span> : null}
                </span>
                {r.error_class ? (
                  <span className="ml-2 text-caption text-error-600">{r.error_class}</span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 font-mono text-caption">
                {r.attempt}/{r.max_attempts}
              </td>
              <td className="px-3 py-1.5">
                <SigIcon s={r.signature_verified} />
              </td>
              <td className="px-3 py-1.5 text-right">
                {onRetry && (r.status === "failed" || r.status === "dropped") ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setRetrying(r.id);
                      try {
                        await onRetry(r.id);
                      } finally {
                        setRetrying(null);
                      }
                    }}
                    disabled={retrying === r.id}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-caption hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${retrying === r.id ? "animate-spin" : ""}`} />
                    Retry
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                No webhook deliveries on file.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
