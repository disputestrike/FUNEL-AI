/**
 * Top-level send().
 *
 * Pipeline:
 *   1. Suppression list check → drop if hit.
 *   2. Resolve template + render to HTML + text (React Email).
 *   3. Build List-Unsubscribe + List-Unsubscribe-Post headers.
 *   4. Dispatch via provider (Resend, with optional failover).
 *   5. Audit: store a row with status + provider message_id.
 */

import { hashEmail } from "./suppression.js";
import type { SuppressionStore } from "./suppression.js";
import { buildListUnsubscribeHeaders } from "./unsubscribe.js";
import { TEMPLATES, type TemplateRenderResult } from "./templates/registry.js";
import type { Email, SendInput, SendResult } from "./index.js";

export interface AuditWriter {
  record(args: {
    workspace_id: string | null;
    user_id: string | null;
    to_hash: string;
    template: string;
    subject: string;
    decision: "sent" | "suppressed" | "failed";
    message_id?: string | null;
    error?: string | null;
    ts: string;
  }): Promise<void>;
}

export interface SendDeps {
  email: Email;
  suppression: SuppressionStore;
  audit?: AuditWriter;
  clock?: { iso(): string };
  unsubscribe_base_url?: string;
}

export interface SendOpts {
  workspace_id?: string | null;
  user_id?: string | null;
  to: string;
  template: keyof typeof TEMPLATES | string;
  data: Record<string, unknown>;
  subject?: string;        // override the default
  idempotency_key?: string;
  from?: string;
  unsubscribe_token?: string;
  unsubscribe_category?: string;
}

export interface SendDecision {
  ok: boolean;
  reason?: "suppressed" | "unknown_template" | "send_failed";
  message_id?: string;
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function send(opts: SendOpts, deps: SendDeps): Promise<SendDecision> {
  const clock = deps.clock ?? defaultClock;
  const to_hash = await hashEmail(opts.to);

  if (await deps.suppression.has(to_hash)) {
    await deps.audit?.record({
      workspace_id: opts.workspace_id ?? null,
      user_id: opts.user_id ?? null,
      to_hash,
      template: String(opts.template),
      subject: opts.subject ?? "",
      decision: "suppressed",
      ts: clock.iso(),
    });
    return { ok: false, reason: "suppressed" };
  }

  const template = TEMPLATES[String(opts.template)];
  if (!template) {
    await deps.audit?.record({
      workspace_id: opts.workspace_id ?? null,
      user_id: opts.user_id ?? null,
      to_hash,
      template: String(opts.template),
      subject: opts.subject ?? "",
      decision: "failed",
      error: "unknown_template",
      ts: clock.iso(),
    });
    return { ok: false, reason: "unknown_template" };
  }

  let rendered: TemplateRenderResult;
  try {
    rendered = await template.render(opts.data);
  } catch (err) {
    await deps.audit?.record({
      workspace_id: opts.workspace_id ?? null,
      user_id: opts.user_id ?? null,
      to_hash,
      template: template.id,
      subject: opts.subject ?? "",
      decision: "failed",
      error: err instanceof Error ? err.message : String(err),
      ts: clock.iso(),
    });
    return { ok: false, reason: "send_failed" };
  }

  const subject = opts.subject ?? rendered.subject;
  const idempotency_key = opts.idempotency_key ?? `${opts.template}_${to_hash}_${rendered.subject}`;

  // Build list-unsubscribe — caller is responsible for passing a signed token.
  // If not supplied, the header is still set with a mailto: only — RFC 8058 is satisfied.
  const unsubUrl =
    opts.unsubscribe_token && opts.unsubscribe_category
      ? `${deps.unsubscribe_base_url ?? "https://funelai.com"}/unsubscribe?t=${encodeURIComponent(opts.unsubscribe_token)}&c=${encodeURIComponent(opts.unsubscribe_category)}`
      : `${deps.unsubscribe_base_url ?? "https://funelai.com"}/unsubscribe`;
  const headers = buildListUnsubscribeHeaders(unsubUrl);

  const sendInput: SendInput = {
    to: opts.to,
    template: opts.template as never,         // template id passed for vendor tagging
    subject,
    from: opts.from,
    idempotency_key,
    data: { html: rendered.html, text: rendered.text, ...headers },
  };

  try {
    const r: SendResult = await deps.email.send(sendInput);
    await deps.audit?.record({
      workspace_id: opts.workspace_id ?? null,
      user_id: opts.user_id ?? null,
      to_hash,
      template: template.id,
      subject,
      decision: "sent",
      message_id: r.message_id,
      ts: clock.iso(),
    });
    return { ok: true, message_id: r.message_id };
  } catch (err) {
    await deps.audit?.record({
      workspace_id: opts.workspace_id ?? null,
      user_id: opts.user_id ?? null,
      to_hash,
      template: template.id,
      subject,
      decision: "failed",
      error: err instanceof Error ? err.message : String(err),
      ts: clock.iso(),
    });
    return { ok: false, reason: "send_failed" };
  }
}
