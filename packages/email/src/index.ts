/**
 * Transactional email â€” public surface.
 *
 * The concrete sender (Resend, Postmark, etc.) implements the `Email`
 * interface. We expose a no-op `InMemoryEmail` for tests and dev.
 *
 * Templates are referenced by string id; the renderer is provider-side.
 */

/**
 * Template id — the canonical registry lives in `templates/registry.ts`.
 * Kept as a string union AND a free-form string for compatibility with
 * the new template catalog (47 templates).
 */
export type EmailTemplate = string;

export interface SendInput {
  to: string;
  template: EmailTemplate;
  subject: string;
  data: Record<string, unknown>;
  /** Optional override of the From: address; defaults to no-reply@gofunnelai.com */
  from?: string;
  /** Idempotency key â€” sender de-dups within a 24h window. */
  idempotency_key?: string;
}

export interface SendResult {
  message_id: string;
  accepted: boolean;
}

export interface Email {
  send(input: SendInput): Promise<SendResult>;
}

/**
 * In-memory implementation; perfect for unit tests and admin previews.
 */
export class InMemoryEmail implements Email {
  public readonly sent: Array<SendInput & { sent_at: string }> = [];
  async send(input: SendInput): Promise<SendResult> {
    this.sent.push({ ...input, sent_at: new Date().toISOString() });
    return {
      message_id: `mem_${Math.random().toString(36).slice(2)}`,
      accepted: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Concrete providers.
// ---------------------------------------------------------------------------
// Primary: Resend (see `providers/resend.ts`).
// Failover: intentionally none. We removed the SendGrid path. If you wire in
// a second provider, expose it here behind the same `Email` interface.
export { ResendEmail } from "./providers/resend.js";
export type { ResendEmailOptions } from "./providers/resend.js";
export { FailoverEmail } from "./providers/failover.js";

// Send entry-point + helpers.
export { send } from "./send.js";
export type { SendOpts, SendDecision, SendDeps, AuditWriter } from "./send.js";
export { hashEmail, InMemorySuppressionStore } from "./suppression.js";
export type { SuppressionStore, SuppressionEntry, SuppressionReason } from "./suppression.js";
export { buildUnsubscribeUrl, buildListUnsubscribeHeaders, handleUnsubscribe } from "./unsubscribe.js";
export type { UnsubscribeTokenPayload } from "./unsubscribe.js";
export { shouldThrottle, MAX_BOUNCE_RATE, MAX_COMPLAINT_RATE } from "./deliverability.js";
export type { DomainReputation, NormalizedEvent, ResendEventType } from "./deliverability.js";

// Brand tokens.
export { BRAND, TOKENS } from "./brand.js";

// Template registry.
export { TEMPLATES, listTemplateIds } from "./templates/registry.js";
export type { TemplateDef, TemplateRenderResult } from "./templates/registry.js";
