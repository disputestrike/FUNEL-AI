/**
 * In-app channel — backed by the notification table + a websocket fanout
 * served by the API layer. This module persists the row + optionally
 * publishes a realtime broadcast.
 */

import type { Notification } from "../types.js";

export interface InAppBroadcaster {
  broadcast(args: { workspace_id: string; user_id: string | null; notification: Notification }): Promise<void>;
}

export interface InAppStore {
  insert(n: Notification): Promise<Notification>;
}

export interface InAppDeps {
  store: InAppStore;
  broadcaster?: InAppBroadcaster;
}

export async function sendInApp(notification: Notification, deps: InAppDeps): Promise<Notification> {
  const inserted = await deps.store.insert({ ...notification, status: "sent", sent_at: new Date().toISOString() });
  if (deps.broadcaster) {
    await deps.broadcaster.broadcast({
      workspace_id: notification.workspace_id,
      user_id: notification.user_id,
      notification: inserted,
    });
  }
  return inserted;
}
