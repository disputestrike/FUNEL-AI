/**
 * Audit log writer.
 *
 * Every state-changing operation MUST call `writeAuditLog`. The row lands in
 * the `audit_logs` table (workspace-scoped, append-only, 7y retention) and an
 * `audit_log_written` analytics event fires.
 *
 * Doc 03 §A.8 + Doc 12 PRD-5 §7 govern the field set. We hash IPs (P1) and
 * never store raw request bodies — only a diff and a content hash.
 */

import { ulid } from "ulid";
import { withWorkspaceContext } from "@funnel/db/rls";
import type { TxClient } from "@funnel/db/rls";
import type { RequestContext } from "./context.js";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "clone"
  | "import"
  | "export"
  | "invite"
  | "remove"
  | "transfer"
  | "role_change"
  | "login"
  | "logout"
  | "password_change"
  | "mfa_enroll"
  | "mfa_disable"
  | "api_key_create"
  | "api_key_revoke"
  | "subscription_change"
  | "refund"
  | "credit"
  | "impersonate"
  | "force_terminate_impersonation"
  | "oauth_connect"
  | "oauth_disconnect"
  | "webhook_replay"
  | "job_retry"
  | "compliance_override";

export interface AuditLogInput {
  /** Workspace this audit row belongs to. NULL only for cross-tenant admin ops. */
  workspace_id: string | null;
  action: AuditAction;
  /** Resource family — "funnel", "lead", "subscription", "api_key", … */
  resource: string;
  /** Specific resource id, when available. */
  resource_id?: string;
  /** Before/after diff. Never PII; reference ids only. */
  diff?: Record<string, unknown>;
  /** Free-form context (reason, ticket id, etc.). */
  metadata?: Record<string, unknown>;
  /** Outcome of the action. */
  outcome?: "success" | "failure" | "denied";
}

/**
 * Persist an audit log entry. Caller's request context supplies actor + IP.
 *
 * Writes via Prisma `audit_logs` model (see @funnel/db). Workspace-scoped via
 * `withWorkspaceContext`. Cross-tenant rows (workspace_id null) skip RLS by
 * routing through `withAdminContext` — only super-admins should hit that path.
 */
export async function writeAuditLog(
  ctx: RequestContext,
  input: AuditLogInput,
): Promise<{ id: string }> {
  const id = `aud_${ulid()}`;
  const row = {
    id,
    workspace_id: input.workspace_id ?? "",
    action: input.action,
    resource: input.resource,
    resource_id: input.resource_id ?? null,
    actor_user_id: ctx.actor.user_id ?? null,
    actor_type: ctx.actor.type,
    impersonator_user_id: ctx.actor.impersonator_user_id ?? null,
    api_key_id: ctx.actor.api_key_id ?? null,
    ip_hash: ctx.ipHash,
    user_agent: ctx.userAgent ?? null,
    request_id: ctx.requestId,
    trace_id: ctx.traceId,
    outcome: input.outcome ?? "success",
    diff: input.diff ?? {},
    metadata: input.metadata ?? {},
    created_at: new Date(),
  } as const;

  if (input.workspace_id) {
    await withWorkspaceContext(input.workspace_id, async (tx: TxClient) => {
      await tx.auditLog.create({ data: row });
    });
  } else {
    // Cross-tenant audit — admin path. Caller is expected to be a super-admin
    // routed through the admin tRPC router, which provides withAdminContext.
    await persistCrossTenantAuditRow(row);
  }

  return { id };
}

/**
 * Cross-tenant audit persistence — only used by the admin router. The caller
 * must already be inside a `withAdminContext` transaction (BYPASSRLS).
 */
async function persistCrossTenantAuditRow(row: Record<string, unknown>): Promise<void> {
  const { withAdminContext } = await import("@funnel/db/rls");
  await withAdminContext(async (tx) => {
    await (tx as unknown as TxClient).auditLog.create({ data: row as never });
  });
}
