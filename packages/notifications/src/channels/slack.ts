/**
 * Slack channel — workspace webhook URL (Agency+ feature).
 */

import type { Notification } from "../types.js";

export interface WebhookSender {
  post(url: string, body: Record<string, unknown>): Promise<void>;
}

export interface SlackDeps {
  webhook: WebhookSender;
  resolveWebhookUrl: (workspace_id: string) => Promise<string | null>;
}

export async function sendSlack(notification: Notification, deps: SlackDeps): Promise<Notification> {
  const url = await deps.resolveWebhookUrl(notification.workspace_id);
  if (!url) return { ...notification, status: "failed", last_error: "no_slack_webhook" };
  await deps.webhook.post(url, {
    text: notification.subject ?? notification.body,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${notification.subject ?? "GoFunnelAI"}*\n${notification.body}` },
      },
      ...(notification.cta_url
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open" },
                  url: notification.cta_url,
                },
              ],
            },
          ]
        : []),
    ],
  });
  return { ...notification, status: "sent", sent_at: new Date().toISOString() };
}
