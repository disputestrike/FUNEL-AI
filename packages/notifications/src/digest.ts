/**
 * Digest engine.
 *
 * Per-user digest cadence is set per event_type. For `daily` cadence we
 * accumulate digestable notifications between scans, then emit a single
 * `daily_digest` email at 09:00 local time. Hourly works the same way but
 * fires every hour.
 */

import type { Notification } from "./types.js";

export interface DigestStore {
  appendDigestItem(args: { user_id: string; event_type: string; payload: Record<string, unknown>; ts: string }): Promise<void>;
  drainDigestBucket(user_id: string, cadence: "hourly" | "daily", asOf: string): Promise<{ event_type: string; payload: Record<string, unknown>; ts: string }[]>;
}

export interface DigestDeps {
  store: DigestStore;
  email: { send(args: { to: string; subject: string; template: string; data: Record<string, unknown> }): Promise<{ message_id: string }> };
  resolveEmail: (user_id: string, workspace_id: string) => Promise<string | null>;
}

/** Append a notification to the user's digest bucket (instead of sending). */
export async function deferToDigest(
  args: { user_id: string; event_type: string; payload: Record<string, unknown> },
  deps: DigestDeps,
): Promise<void> {
  await deps.store.appendDigestItem({
    user_id: args.user_id,
    event_type: args.event_type,
    payload: args.payload,
    ts: new Date().toISOString(),
  });
}

/** Cron entrypoint — drain a user's bucket and send one digest email. */
export async function sendDigest(
  args: { user_id: string; workspace_id: string; cadence: "hourly" | "daily" },
  deps: DigestDeps,
): Promise<{ sent: boolean; count: number }> {
  const now = new Date().toISOString();
  const items = await deps.store.drainDigestBucket(args.user_id, args.cadence, now);
  if (items.length === 0) return { sent: false, count: 0 };
  const email = await deps.resolveEmail(args.user_id, args.workspace_id);
  if (!email) return { sent: false, count: items.length };

  await deps.email.send({
    to: email,
    subject:
      args.cadence === "daily"
        ? `Your daily GoFunnelAI digest — ${items.length} updates`
        : `Hourly GoFunnelAI digest — ${items.length} updates`,
    template: args.cadence === "daily" ? "daily-digest" : "hourly-digest",
    data: { items, count: items.length, cadence: args.cadence },
  });
  return { sent: true, count: items.length };
}
