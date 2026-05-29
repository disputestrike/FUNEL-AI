/**
 * Resend provider — primary transactional email backend.
 *
 * SPF / DKIM / DMARC config (configured at the Resend dashboard, not in code):
 *   - SPF: `v=spf1 include:_spf.resend.com ~all`
 *   - DKIM: CNAME record `resend._domainkey` â†’ provided by Resend
 *   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@gofunnelai.com`
 *
 * Webhook events arrive via Svix and are verified in
 * `apps/api/src/webhooks/resend.ts` (HMAC-SHA256, 5 min skew).
 *
 * Failover provider:
 *   We intentionally do NOT ship a SendGrid fallback. If a second provider is
 *   added later it should plug in via the `Email` interface — wire it in here.
 */

import { Resend } from "resend";
import type { Email, SendInput, SendResult } from "../index.js";

export interface ResendEmailOptions {
  apiKey: string;
  /** Default From: address — must be a verified domain in Resend. */
  defaultFrom?: string;
}

/**
 * Concrete `Email` implementation backed by Resend. Templates are resolved
 * upstream and passed through as the rendered subject/body; this adapter does
 * not own template rendering itself.
 */
export class ResendEmail implements Email {
  private readonly client: Resend;
  private readonly defaultFrom: string;

  constructor(opts: ResendEmailOptions) {
    if (!opts.apiKey) throw new Error("ResendEmail: apiKey is required");
    this.client = new Resend(opts.apiKey);
    this.defaultFrom = opts.defaultFrom ?? "no-reply@gofunnelai.com";
  }

  async send(input: SendInput): Promise<SendResult> {
    const res = await this.client.emails.send({
      from: input.from ?? this.defaultFrom,
      to: input.to,
      subject: input.subject,
      // Until the template renderer is wired, fall back to a JSON body so we
      // never silently drop the payload.
      text: typeof input.data?.text === "string" ? (input.data.text as string) : JSON.stringify(input.data),
      html: typeof input.data?.html === "string" ? (input.data.html as string) : undefined,
      headers: input.idempotency_key ? { "Idempotency-Key": input.idempotency_key } : undefined,
      tags: [{ name: "template", value: input.template }],
    });

    if ((res as { error?: unknown }).error) {
      const err = (res as { error: { message?: string } }).error;
      throw new Error(`resend rejected email: ${err.message ?? "unknown"}`);
    }

    const data = (res as { data?: { id?: string } }).data;
    return {
      message_id: data?.id ?? `resend_${Math.random().toString(36).slice(2)}`,
      accepted: true,
    };
  }
}
