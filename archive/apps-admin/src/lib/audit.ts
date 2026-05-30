/**
 * Audit wrapper for every admin write.
 *
 * No admin write goes through without:
 *   1. A reason string (min 10 chars after trim).
 *   2. A current admin session.
 *   3. An admin_action_log row.
 *   4. A `governance.admin_action_recorded` event on the bus.
 *
 * Usage:
 *
 *   const result = await withAdminAudit(
 *     {
 *       session,
 *       action: "issue_refund",
 *       resource_type: "billing.invoice",
 *       resource_id: invoiceId,
 *       workspace_id,
 *       reason,
 *       capability: "issue_refund",
 *     },
 *     async () => billing.refunds.issue({ invoiceId, amountCents }),
 *   );
 *
 * The wrapper:
 *  - Enforces the capability via @funnel/auth.requireAdminCapability.
 *  - Writes the audit row BEFORE invoking the action (so a crash mid-action
 *    still leaves a trail with status=pending).
 *  - On success: marks the row succeeded + emits event.
 *  - On failure: marks the row failed with the error class + emits event.
 *
 * The reason is never trimmed away — full text goes to the log. PII inside
 * the reason is the staff member's responsibility; doc 12 §7 explicitly
 * forbids paste-dumping customer data.
 */

import { emit } from "@funnel/events";
import {
  Errors,
  assertCapCents,
  requireAdminCapability,
  type AdminCapability,
} from "@funnel/auth";
import { getAuthContext } from "./auth-context";
import type { AdminSession } from "./session";

export interface AdminAuditArgs {
  session: AdminSession;
  /** Stable short string, e.g. "issue_refund", "suspend_account". */
  action: string;
  capability: AdminCapability;
  /** What kind of thing is being acted on. */
  resource_type: string;
  /** Stable ID of the resource. */
  resource_id: string;
  /** Workspace this affects; null for global actions like "grant_admin_role". */
  workspace_id: string | null;
  /** Free-text justification, min 10 chars after trim. */
  reason: string;
  /** Optional ticket id (Linear/Plain/Pylon) — required for impersonation. */
  ticket_id?: string | null;
  /** Optional dollar amount for cap-checked actions (credit/refund). */
  amount_cents?: number;
  amount_kind?: "credit" | "refund";
  /** Free-form, redacted-by-caller payload to attach to the audit row. */
  payload?: Record<string, unknown>;
}

export class AdminActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause_obj?: unknown,
  ) {
    super(message);
    this.name = "AdminActionError";
  }
}

const MIN_REASON_LEN = 10;
const MAX_REASON_LEN = 2000;

/**
 * Validates the reason. Used on the server side; the client modal also
 * enforces ≥10 chars so the user sees instant feedback.
 */
export function validateReason(reason: string): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < MIN_REASON_LEN) {
    throw new AdminActionError(
      "reason_too_short",
      `Reason must be at least ${MIN_REASON_LEN} characters.`,
    );
  }
  if (trimmed.length > MAX_REASON_LEN) {
    throw new AdminActionError(
      "reason_too_long",
      `Reason must be at most ${MAX_REASON_LEN} characters.`,
    );
  }
  return trimmed;
}

/**
 * Wraps an admin action with cap check + audit-row write + event emit.
 *
 * Guarantees: even if `fn()` throws, an audit row is written with
 * `status: "failed"` and the governance event still fires.
 */
export async function withAdminAudit<T>(
  args: AdminAuditArgs,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = getAuthContext();
  const reason = validateReason(args.reason);

  // 1. Capability check (also writes admin_permission_denied if denied).
  await requireAdminCapability(ctx, args.session.user_id, args.capability);
  if (args.amount_cents !== undefined && args.amount_kind) {
    await assertCapCents(
      ctx,
      args.session.user_id,
      args.amount_kind,
      args.amount_cents,
    );
  }

  // 2. Pending audit row — written BEFORE the action so partial failures
  //    still get a trail.
  const startedAt = new Date().toISOString();
  await ctx.audit.write({
    workspace_id: args.workspace_id,
    actor_user_id: args.session.user_id,
    impersonator_user_id: null,
    subject_type: args.resource_type,
    subject_id: args.resource_id,
    action: `${args.action}.started`,
    payload: {
      reason,
      ticket_id: args.ticket_id ?? null,
      amount_cents: args.amount_cents ?? null,
      ...(args.payload ?? {}),
    },
    justification_ticket_id: args.ticket_id ?? null,
    ip_hash: args.session.ip_hash,
    user_agent_class: args.session.user_agent_class,
  });

  await emit("admin_action_started" as never, {
    admin_user_id: args.session.user_id,
    admin_session_id: args.session.admin_session_id,
    action: args.action,
    resource_type: args.resource_type,
    resource_id: args.resource_id,
    workspace_id: args.workspace_id,
    reason_excerpt: reason.slice(0, 120),
    ticket_id: args.ticket_id ?? null,
    started_at: startedAt,
  } as never);

  // 3. Run the action; commit success/failure either way.
  try {
    const result = await fn();
    await ctx.audit.write({
      workspace_id: args.workspace_id,
      actor_user_id: args.session.user_id,
      impersonator_user_id: null,
      subject_type: args.resource_type,
      subject_id: args.resource_id,
      action: `${args.action}.succeeded`,
      payload: { reason, ticket_id: args.ticket_id ?? null },
      justification_ticket_id: args.ticket_id ?? null,
      ip_hash: args.session.ip_hash,
      user_agent_class: args.session.user_agent_class,
    });
    await emit("admin_action_succeeded" as never, {
      admin_user_id: args.session.user_id,
      action: args.action,
      resource_type: args.resource_type,
      resource_id: args.resource_id,
      workspace_id: args.workspace_id,
    } as never);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "unknown";
    await ctx.audit.write({
      workspace_id: args.workspace_id,
      actor_user_id: args.session.user_id,
      impersonator_user_id: null,
      subject_type: args.resource_type,
      subject_id: args.resource_id,
      action: `${args.action}.failed`,
      payload: { reason, error_code: code, error_message: message },
      justification_ticket_id: args.ticket_id ?? null,
      ip_hash: args.session.ip_hash,
      user_agent_class: args.session.user_agent_class,
    });
    await emit("admin_action_failed" as never, {
      admin_user_id: args.session.user_id,
      action: args.action,
      resource_type: args.resource_type,
      resource_id: args.resource_id,
      workspace_id: args.workspace_id,
      error_code: code,
    } as never);
    throw new AdminActionError(code, message, err);
  }
}

/** Tiny helper so server actions don't blow up the form on validation errors. */
export function reasonFromFormData(formData: FormData): string {
  const raw = formData.get("reason");
  if (typeof raw !== "string") throw new AdminActionError("reason_missing", "Reason is required.");
  return validateReason(raw);
}

/** Make sure the operator ticked the "I understand this is logged" box. */
export function ackFromFormData(formData: FormData): true {
  const ack = formData.get("ack");
  if (ack !== "on" && ack !== "true") {
    throw new AdminActionError("ack_required", "Acknowledge that this action is logged.");
  }
  return true;
}

// `Errors` is the same as auth — re-export so callers don't import both.
export { Errors };
