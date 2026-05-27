/**
 * Reusable confirmation modal for every write action in the admin app.
 *
 * Hard-enforced contract:
 *  - Reason field with min 10 characters.
 *  - "I understand this action is logged" checkbox MUST be ticked.
 *  - The action key (e.g. "issue_refund") is shown verbatim — no friendly
 *    rephrasing — so the operator sees what'll appear in the audit log.
 *  - Confirm is disabled until both reason length + ack are satisfied.
 *
 * The form submits to a server action provided by the caller; the modal
 * itself never decides what happens. It only enforces the friction.
 */

"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export interface ActionConfirmationModalProps {
  /** Stable action key — written into the audit log. */
  actionKey: string;
  /** Human title for the modal (e.g. "Issue refund"). */
  title: string;
  /** Human description of what'll happen. Keep it terse. */
  description: ReactNode;
  /** Optional extra slot — e.g. an amount input. */
  extra?: ReactNode;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Whether the modal is open. Controlled. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the reason + extra form data when confirmed. */
  onConfirm: (data: { reason: string; ticket_id?: string }) => Promise<void> | void;
  /** Show a ticket id field (required for impersonation, etc). */
  requireTicketId?: boolean;
  /** Show extra warning text in red. */
  warning?: ReactNode;
}

const MIN_REASON = 10;

export function ActionConfirmationModal({
  actionKey,
  title,
  description,
  extra,
  confirmLabel = "Confirm",
  open,
  onOpenChange,
  onConfirm,
  requireTicketId = false,
  warning,
}: ActionConfirmationModalProps) {
  const [reason, setReason] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const reasonOk = reason.trim().length >= MIN_REASON;
  const ticketOk = !requireTicketId || ticketId.trim().length > 0;
  const canConfirm = reasonOk && ticketOk && ack && !pending;

  async function handleConfirm() {
    if (!canConfirm) return;
    setErr(null);
    setPending(true);
    try {
      await onConfirm({
        reason: reason.trim(),
        ticket_id: requireTicketId ? ticketId.trim() : undefined,
      });
      // Reset on success.
      setReason("");
      setTicketId("");
      setAck(false);
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 id="action-modal-title" className="text-h5 text-slate-900">
            {title}
          </h2>
          <p className="mt-0.5 font-mono text-caption text-slate-500">
            action: {actionKey}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="text-body-sm text-slate-700">{description}</div>

          {warning ? (
            <div className="rounded border border-error-200 bg-error-50 px-3 py-2 text-body-sm text-error-700">
              {warning}
            </div>
          ) : null}

          {extra}

          {requireTicketId ? (
            <label className="block">
              <span className="text-body-sm font-medium text-slate-900">
                Ticket id <span className="text-error-600">*</span>
              </span>
              <input
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="LIN-123 / PLN-456"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-body-sm"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-body-sm font-medium text-slate-900">
              Reason <span className="text-error-600">*</span>{" "}
              <span className="text-caption font-normal text-slate-500">
                (min {MIN_REASON} chars, written into the audit log)
              </span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Customer reported on PLN-1234 that..."
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-body-sm"
            />
            <span
              className={`mt-0.5 block text-caption ${
                reasonOk ? "text-success-600" : "text-slate-500"
              }`}
            >
              {reason.trim().length}/{MIN_REASON}
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-body-sm text-slate-700">
              I understand this action is logged to the admin audit trail and
              may be reviewed by Trust &amp; Safety, Legal, or the customer
              via DSAR.
            </span>
          </label>

          {err ? (
            <div className="rounded border border-error-300 bg-error-50 px-3 py-2 text-body-sm text-error-700">
              {err}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="rounded border border-slate-300 px-3 py-1.5 text-body-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 rounded bg-error-600 px-3 py-1.5 text-body-sm font-medium text-white hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
