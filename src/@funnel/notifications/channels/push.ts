/**
 * Push channel — Expo / APN / FCM.
 *
 * The actual push provider is injected. We fan out to all registered devices
 * for the user (resolved by the caller's device registry).
 */

import type { Notification } from "../types.js";

export interface PushDevice {
  device_token: string;
  platform: "ios" | "android" | "expo";
}

export interface PushSender {
  send(args: {
    to: PushDevice[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{ accepted: number; rejected: number; errors: string[] }>;
}

export interface PushDeps {
  push: PushSender;
  listDevices: (user_id: string) => Promise<PushDevice[]>;
}

export async function sendPush(notification: Notification, deps: PushDeps): Promise<Notification> {
  if (!notification.user_id) throw new Error("push requires user_id");
  const devices = await deps.listDevices(notification.user_id);
  if (devices.length === 0) {
    return { ...notification, status: "failed", last_error: "no_devices", attempts: notification.attempts + 1 };
  }
  const r = await deps.push.send({
    to: devices,
    title: notification.subject ?? "GoFunnelAI",
    body: notification.body.slice(0, 240),
    data: { event_type: notification.event_type, cta_url: notification.cta_url ?? null },
  });
  return {
    ...notification,
    status: r.accepted > 0 ? "sent" : "failed",
    sent_at: r.accepted > 0 ? new Date().toISOString() : null,
    last_error: r.errors.join("; ") || null,
  };
}
