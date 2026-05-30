/**
 * Unsubscribe link builder + handler.
 *
 *   - One-click unsubscribe (RFC 8058) — the `List-Unsubscribe-Post` header
 *     points at a POST endpoint that doesn't require a click-through.
 *   - We include both the mailto: and https: variants for max compatibility.
 *   - Token is a signed HMAC of (user_id, category, expires_at). 90-day TTL.
 */

import { hashEmail } from "./suppression.js";
import type { SuppressionStore } from "./suppression.js";

export interface UnsubscribeTokenPayload {
  user_id: string | null;
  email: string;
  category: string;             // event_type or "all"
  expires_at: string;
}

export function buildUnsubscribeUrl(payload: UnsubscribeTokenPayload, signedToken: string, baseUrl = "https://gofunnelai.com"): string {
  const sp = new URLSearchParams({
    u: payload.user_id ?? "",
    c: payload.category,
    e: payload.email,
    t: signedToken,
  });
  return `${baseUrl}/unsubscribe?${sp.toString()}`;
}

export function buildListUnsubscribeHeaders(unsubUrl: string, mailto: string = "unsubscribe@gofunnelai.com"): {
  "List-Unsubscribe": string;
  "List-Unsubscribe-Post": string;
} {
  return {
    "List-Unsubscribe": `<${unsubUrl}>, <mailto:${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Handle a click on the unsubscribe link → write to the suppression list.
 * (Token validation happens upstream in the API route.)
 */
export async function handleUnsubscribe(
  args: { email: string; category: string },
  deps: { suppression: SuppressionStore },
): Promise<{ ok: true }> {
  const email_hash = await hashEmail(args.email);
  await deps.suppression.add({
    email_hash,
    reason: "unsubscribe",
    source: "unsubscribe.page",
    added_at: new Date().toISOString(),
  });
  return { ok: true };
}
