/**
 * Email channel — Resend-backed.
 *
 * Wraps @funnel/email's `Email` interface so the engine doesn't depend
 * directly on Resend. Suppression list checks are upstream (see
 * @funnel/email/suppression).
 */

import type { Notification } from "../types.js";

export interface EmailSender {
  send(args: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
    idempotency_key?: string;
  }): Promise<{ message_id: string }>;
}

export interface EmailDeps {
  email: EmailSender;
  resolveRecipient: (user_id: string | null, workspace_id: string) => Promise<string | null>;
}

export async function sendEmail(notification: Notification, deps: EmailDeps): Promise<Notification> {
  const to = await deps.resolveRecipient(notification.user_id, notification.workspace_id);
  if (!to) throw new Error("no email address resolved");
  const r = await deps.email.send({
    to,
    subject: notification.subject ?? "",
    template: notification.template,
    data: notification.payload,
    idempotency_key: notification.id,
  });
  return { ...notification, external_message_id: r.message_id, status: "sent", sent_at: new Date().toISOString() };
}
