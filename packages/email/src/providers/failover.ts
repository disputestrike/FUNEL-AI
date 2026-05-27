/**
 * Failover wrapper. The primary provider is Resend; the failover is a
 * caller-supplied SMTP fallback for hard outages. We DO NOT ship SendGrid.
 *
 * Strategy: try primary; on `UpstreamError` or 5xx, retry once on failover.
 * Both attempts share the same idempotency_key so the receiver de-dups.
 */

import type { Email, SendInput, SendResult } from "../index.js";

export class FailoverEmail implements Email {
  constructor(private readonly primary: Email, private readonly failover: Email) {}
  async send(input: SendInput): Promise<SendResult> {
    try {
      return await this.primary.send(input);
    } catch (err) {
      return this.failover.send(input);
    }
  }
}
