/**
 * Resend webhooks ship through Svix. Svix signatures are computed as:
 *   v1,<base64(hmac-sha256(`${id}.${timestamp}.${body}`, secret_bytes))>
 * The secret begins with "whsec_" and the rest is base64.
 */
import { createHmac } from "node:crypto";

const SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "whsec_test_resend";

function secretBytes(): Buffer {
  const trimmed = SECRET.replace(/^whsec_/, "");
  return Buffer.from(trimmed, "base64").length > 0
    ? Buffer.from(trimmed, "base64")
    : Buffer.from(trimmed, "utf8");
}

export function svixHeaders(id: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const toSign = `${id}.${timestamp}.${body}`;
  const sig = createHmac("sha256", secretBytes()).update(toSign).digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${sig}`,
    "content-type": "application/json",
  };
}

export const RESEND_EMAIL_DELIVERED = {
  type: "email.delivered",
  created_at: "2025-01-01T00:00:00.000Z",
  data: { email_id: "re_test_email_id", from: "noreply@gofunnelai.com", to: ["lead@example.test"] },
};

export const RESEND_EMAIL_BOUNCED = {
  type: "email.bounced",
  data: { email_id: "re_test_bounce", to: ["bad@example.test"], bounce: { type: "hard" } },
};

export const RESEND_EMAIL_COMPLAINED = {
  type: "email.complained",
  data: { email_id: "re_test_complaint", to: ["unhappy@example.test"] },
};
