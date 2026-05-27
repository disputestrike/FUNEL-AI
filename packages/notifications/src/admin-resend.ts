/**
 * Support API — admin can manually resend a failed notification.
 *
 * Every action writes an audit row with the admin's user_id as actor.
 */

import { recordAudit } from "./audit.js";
import type { NotificationStore } from "./store.js";
import type { Notification } from "./types.js";

export interface AdminResendDeps {
  store: NotificationStore;
  retrySend: (n: Notification) => Promise<Notification>;
  clock?: { iso(): string };
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function adminResend(
  args: { notification_id: string; admin_user_id: string; justification: string },
  deps: AdminResendDeps,
): Promise<Notification> {
  const cur = await deps.store.updateStatus(args.notification_id, "queued", {
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
  });
  const result = await deps.retrySend(cur);
  await recordAudit(
    {
      notification_id: args.notification_id,
      workspace_id: cur.workspace_id,
      user_id: cur.user_id,
      event_type: cur.event_type,
      channel: cur.channel,
      decision: result.status === "sent" ? "sent" : "failed",
      reason: `admin_resend by ${args.admin_user_id}: ${args.justification.slice(0, 120)}`,
    },
    { store: deps.store, clock: deps.clock ?? defaultClock },
  );
  return result;
}
