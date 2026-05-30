/**
 * Discord channel — workspace webhook URL (Agency+ feature).
 */

import type { Notification } from "../types.js";

export interface WebhookSender {
  post(url: string, body: Record<string, unknown>): Promise<void>;
}

export interface DiscordDeps {
  webhook: WebhookSender;
  resolveWebhookUrl: (workspace_id: string) => Promise<string | null>;
}

export async function sendDiscord(notification: Notification, deps: DiscordDeps): Promise<Notification> {
  const url = await deps.resolveWebhookUrl(notification.workspace_id);
  if (!url) return { ...notification, status: "failed", last_error: "no_discord_webhook" };
  await deps.webhook.post(url, {
    username: "GoFunnelAI",
    content: notification.subject ?? "",
    embeds: [
      {
        title: notification.subject ?? "GoFunnelAI",
        description: notification.body,
        url: notification.cta_url ?? undefined,
        color: notification.severity === "critical" ? 15158332 : 3447003,
      },
    ],
  });
  return { ...notification, status: "sent", sent_at: new Date().toISOString() };
}
