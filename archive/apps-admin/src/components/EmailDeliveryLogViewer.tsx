/**
 * Resend delivery-log viewer.
 *
 * Lists every email sent on behalf of a workspace with its current state:
 *  sent → delivered → opened → clicked
 *      └─→ bounced (hard / soft)
 *      └─→ complained
 *
 * Each row links to the per-message detail panel and offers a "Resend"
 * button (writes an audit row + queues a `email_resend` job).
 */

"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export type EmailEvent =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced_hard"
  | "bounced_soft"
  | "complained"
  | "queued"
  | "failed";

export interface EmailRow {
  id: string;
  to: string;
  subject: string;
  template_id: string;
  status: EmailEvent;
  sent_at: string;
  last_event_at: string;
  bounce_reason?: string | null;
}

const STATUS_COLOR: Record<EmailEvent, string> = {
  queued: "bg-slate-100 text-slate-700",
  sent: "bg-info-100 text-info-700",
  delivered: "bg-success-100 text-success-700",
  opened: "bg-success-100 text-success-700",
  clicked: "bg-aqua-100 text-aqua-700",
  bounced_hard: "bg-error-100 text-error-700",
  bounced_soft: "bg-warning-100 text-warning-700",
  complained: "bg-error-100 text-error-700",
  failed: "bg-error-100 text-error-700",
};

export function EmailDeliveryLogViewer({
  rows,
  onResend,
}: {
  rows: EmailRow[];
  onResend?: (id: string) => Promise<void>;
}) {
  const [resending, setResending] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-body-sm">
        <thead className="bg-slate-50 text-left text-caption uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Sent</th>
            <th className="px-3 py-2 font-medium">Template</th>
            <th className="px-3 py-2 font-medium">To</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-caption">
                {new Date(r.sent_at).toISOString().replace("T", " ").slice(0, 16)}
              </td>
              <td className="px-3 py-1.5 font-mono text-caption">{r.template_id}</td>
              <td className="px-3 py-1.5">{r.to}</td>
              <td className="px-3 py-1.5">{r.subject}</td>
              <td className="px-3 py-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-caption ${STATUS_COLOR[r.status]}`}
                  title={r.bounce_reason ?? undefined}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right">
                {onResend ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setResending(r.id);
                      try {
                        await onResend(r.id);
                      } finally {
                        setResending(null);
                      }
                    }}
                    disabled={resending === r.id}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-caption hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${resending === r.id ? "animate-spin" : ""}`} />
                    Resend
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                No emails on file.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
