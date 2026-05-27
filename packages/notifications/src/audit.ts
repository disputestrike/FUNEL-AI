/**
 * Audit log — every notification decision is recorded for ops review.
 */

import type { AuditRow, NotificationChannel } from "./types.js";
import type { NotificationStore } from "./store.js";

export interface AuditDeps {
  store: NotificationStore;
  clock?: { iso(): string };
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function recordAudit(
  args: {
    notification_id: string;
    workspace_id: string;
    user_id: string | null;
    event_type: string;
    channel: NotificationChannel;
    decision: AuditRow["decision"];
    reason?: string | null;
  },
  deps: AuditDeps,
): Promise<AuditRow> {
  const row: AuditRow = {
    notification_id: args.notification_id,
    workspace_id: args.workspace_id,
    user_id: args.user_id,
    event_type: args.event_type,
    channel: args.channel,
    decision: args.decision,
    reason: args.reason ?? null,
    ts: (deps.clock ?? defaultClock).iso(),
  };
  return deps.store.insertAudit(row);
}
