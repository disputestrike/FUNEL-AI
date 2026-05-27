/**
 * Internal admin roles + impersonation.
 *
 * Doc 12 PRD-5 Â§7 defines the admin role Ã— capability matrix; this file
 * enforces it. Each capability has a stable string id matching the doc.
 *
 * Admin login flow (driven by the admin app):
 *  1. Google Workspace SSO via `sso.ts` (`beginSso("google")`).
 *  2. Verify the email belongs to `gofunnelai.com` (or `is_internal=true`).
 *  3. WebAuthn step-up (`webauthnAuthenticationVerify`).
 *  4. Mint an `admin_sessions` row + tie the JWT to it via `admin_sid`.
 *
 * Impersonation:
 *  - Requires `super_admin` role + a reason (â‰¥20 chars) + a ticket id.
 *  - Max 60 min lifetime, refreshable with a new reason.
 *  - Banner shown to the impersonated user on every page (the app reads
 *    `impersonator_user_id` off the customer's session for this).
 *  - High-risk targets (Doc 07a Â§13) require a co-signer.
 *  - `pii_access_recorded` and `impersonation_started` events fire from here.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import { Errors } from "./errors.js";
import { sha256Hex } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { newId } from "./internal/ids.js";
import { createSession } from "./session.js";
import type { AdminRole, AdminScope, Session } from "./types.js";

export type AdminCapability =
  | "view_dashboard"
  | "search_users"
  | "search_workspaces"
  | "view_usage"
  | "view_failed_payments"
  | "view_email_log"
  | "view_webhook_log"
  | "view_audit_log_own"
  | "view_audit_log_all"
  | "view_error_log"
  | "read_pii"
  | "resend_verification"
  | "trigger_password_reset"
  | "apply_credit"
  | "apply_credit_above_cap"
  | "issue_refund"
  | "issue_refund_above_cap"
  | "suspend_workspace"
  | "restore_funnel"
  | "force_regenerate"
  | "retry_webhook"
  | "retry_job"
  | "add_internal_note"
  | "impersonate"
  | "grant_admin_role"
  | "force_terminate_impersonation";

type Cap = AdminCapability;

const CAPS: Record<AdminRole, ReadonlySet<Cap>> = {
  read_only: new Set<Cap>([
    "view_dashboard",
    "view_usage",
    "view_audit_log_own",
  ]),
  support: new Set<Cap>([
    "view_dashboard",
    "search_users",
    "search_workspaces",
    "view_usage",
    "view_failed_payments",
    "view_email_log",
    "view_webhook_log",
    "view_audit_log_own",
    "view_error_log",
    "resend_verification",
    "trigger_password_reset",
    "retry_webhook",
    "retry_job",
    "add_internal_note",
  ]),
  billing_admin: new Set<Cap>([
    "view_dashboard",
    "search_users",
    "search_workspaces",
    "view_usage",
    "view_failed_payments",
    "view_email_log",
    "view_webhook_log",
    "view_audit_log_own",
    "resend_verification",
    "apply_credit",
    "issue_refund",
    "suspend_workspace",
    "retry_webhook",
    "add_internal_note",
  ]),
  engineering: new Set<Cap>([
    "view_dashboard",
    "search_users",
    "search_workspaces",
    "view_usage",
    "view_failed_payments",
    "view_email_log",
    "view_webhook_log",
    "view_audit_log_own",
    "view_error_log",
    "restore_funnel",
    "force_regenerate",
    "retry_webhook",
    "retry_job",
    "add_internal_note",
    "force_terminate_impersonation",
  ]),
  super_admin: new Set<Cap>([
    "view_dashboard",
    "search_users",
    "search_workspaces",
    "view_usage",
    "view_failed_payments",
    "view_email_log",
    "view_webhook_log",
    "view_audit_log_own",
    "view_audit_log_all",
    "view_error_log",
    "read_pii",
    "resend_verification",
    "trigger_password_reset",
    "apply_credit",
    "apply_credit_above_cap",
    "issue_refund",
    "issue_refund_above_cap",
    "suspend_workspace",
    "restore_funnel",
    "force_regenerate",
    "retry_webhook",
    "retry_job",
    "add_internal_note",
    "impersonate",
    "grant_admin_role",
    "force_terminate_impersonation",
  ]),
};

/** Caps that additionally require an explicit scope on the grant. */
const SCOPE_GATED: Partial<Record<Cap, AdminScope>> = {
  read_pii: "pii:read",
};

const CAP_AMOUNT_CAPS_CENTS: Partial<Record<AdminRole, { credit: number; refund: number }>> = {
  billing_admin: { credit: 50_000, refund: 50_000 }, // $500
};

export async function getAdminRole(ctx: AuthContext, userId: string) {
  const row = await ctx.admin.getRole(userId);
  if (!row || row.revoked_at) return null;
  return row;
}

export async function requireAdminCapability(
  ctx: AuthContext,
  adminUserId: string,
  capability: AdminCapability,
): Promise<void> {
  const row = await getAdminRole(ctx, adminUserId);
  if (!row) {
    await emit("admin_permission_denied", {
      admin_user_id: adminUserId,
      attempted_action: capability,
      resource: "admin",
      reason: "no_role",
    });
    throw Errors.adminRequired();
  }
  if (!CAPS[row.role].has(capability)) {
    await emit("admin_permission_denied", {
      admin_user_id: adminUserId,
      attempted_action: capability,
      resource: "admin",
      reason: `role_${row.role}_lacks_capability`,
    });
    throw Errors.permissionDenied("admin", capability);
  }
  const reqScope = SCOPE_GATED[capability];
  if (reqScope && !row.scopes.includes(reqScope)) {
    await emit("admin_permission_denied", {
      admin_user_id: adminUserId,
      attempted_action: capability,
      resource: "admin",
      reason: `missing_scope_${reqScope}`,
    });
    throw Errors.permissionDenied("admin", capability);
  }
}

export async function assertCapCents(
  ctx: AuthContext,
  adminUserId: string,
  kind: "credit" | "refund",
  amountCents: number,
): Promise<void> {
  const row = await getAdminRole(ctx, adminUserId);
  if (!row) throw Errors.adminRequired();
  const cap = CAP_AMOUNT_CAPS_CENTS[row.role]?.[kind];
  if (cap !== undefined && amountCents > cap) {
    const aboveCap = kind === "credit" ? "apply_credit_above_cap" : "issue_refund_above_cap";
    if (!CAPS[row.role].has(aboveCap)) {
      await emit("admin_permission_denied", {
        admin_user_id: adminUserId,
        attempted_action: aboveCap,
        resource: "admin",
        reason: `amount_${amountCents}_exceeds_cap_${cap}`,
      });
      throw Errors.permissionDenied("admin", aboveCap);
    }
  }
}

/* ===== Admin login: SSO + WebAuthn step-up ===== */

export interface AdminLoginResult {
  status: "ok";
  session: Session;
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  admin_session_id: string;
  role: AdminRole;
}

export async function completeAdminLogin(
  ctx: AuthContext,
  args: {
    /** User who already completed SSO + WebAuthn in a prior step. */
    user_id: string;
    ip_hash: string;
    user_agent_class: string | null;
    device_id_hash: string | null;
  },
): Promise<AdminLoginResult> {
  const user = await ctx.users.findById(args.user_id);
  if (!user) throw Errors.adminRequired();
  if (!user.is_internal) throw Errors.adminRequired();
  if (!user.mfa_enrolled) throw Errors.adminMfaRequired();

  const grant = await getAdminRole(ctx, args.user_id);
  if (!grant) throw Errors.adminRequired();

  const adminSessionId = newId("adm");

  const { session, access_token, refresh_token, csrf_token } = await createSession(ctx, {
    user_id: args.user_id,
    workspace_id: null,
    ip_hash: args.ip_hash,
    user_agent_class: args.user_agent_class,
    device_id_hash: args.device_id_hash,
    mfa_satisfied: true,
    admin_session_id: adminSessionId,
  });

  await ctx.audit.write({
    workspace_id: null,
    actor_user_id: args.user_id,
    impersonator_user_id: null,
    subject_type: "admin_session",
    subject_id: adminSessionId,
    action: "login",
    payload: { role: grant.role, scopes: grant.scopes },
    justification_ticket_id: null,
    ip_hash: args.ip_hash,
    user_agent_class: args.user_agent_class,
  });

  return {
    status: "ok",
    session,
    access_token,
    refresh_token,
    csrf_token,
    admin_session_id: adminSessionId,
    role: grant.role,
  };
}

/* ===== Impersonation ===== */

export const IMPERSONATION_MAX_SEC = 60 * 60; // 60 min per Doc 12 PRD-5.

const StartInput = z.object({
  admin_user_id: z.string().min(1),
  target_user_id: z.string().min(1),
  workspace_id: z.string().min(1),
  justification: z.string().min(20).max(2000),
  justification_ticket_id: z.string().min(1).max(120),
  cosigner_user_id: z.string().optional().nullable(),
  scopes: z.array(z.string()).optional(),
  high_risk: z.boolean().optional(),
  ip_hash: z.string().min(1),
  user_agent_class: z.string().nullable(),
});

export interface StartImpersonationResult {
  impersonation_id: string;
  session: Session;
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  expires_at: string;
}

export async function startImpersonation(
  ctx: AuthContext,
  raw: z.infer<typeof StartInput>,
): Promise<StartImpersonationResult> {
  const input = StartInput.parse(raw);
  await requireAdminCapability(ctx, input.admin_user_id, "impersonate");

  if (input.admin_user_id === input.target_user_id) {
    throw Errors.impersonationDisallowed("Cannot impersonate yourself.");
  }
  if (input.high_risk && !input.cosigner_user_id) {
    throw Errors.highRiskCosignRequired();
  }
  if (input.cosigner_user_id) {
    const cosigner = await getAdminRole(ctx, input.cosigner_user_id);
    if (!cosigner || cosigner.role !== "super_admin") {
      throw Errors.highRiskCosignRequired();
    }
    if (input.cosigner_user_id === input.admin_user_id) {
      throw Errors.highRiskCosignRequired();
    }
  }

  const target = await ctx.users.findById(input.target_user_id);
  if (!target) throw Errors.impersonationDisallowed("Target user not found.");
  if (target.is_internal) {
    throw Errors.impersonationDisallowed("Cannot impersonate internal users.");
  }
  if (target.status === "deleted") {
    throw Errors.impersonationDisallowed("Target user is deleted.");
  }

  const id = newId("imp");
  const expires = new Date(ctx.now().getTime() + IMPERSONATION_MAX_SEC * 1000).toISOString();

  await emit("impersonation_started", {
    session_id: id,
    admin_user_id: input.admin_user_id,
    target_user_id: input.target_user_id,
    workspace_id: input.workspace_id,
    justification: input.justification,
    justification_ticket_id: input.justification_ticket_id,
    cosigner_user_id: input.cosigner_user_id ?? null,
    expires_at: expires,
  });

  // Audit row in the same logical step.
  await ctx.audit.write({
    workspace_id: input.workspace_id,
    actor_user_id: input.admin_user_id,
    impersonator_user_id: input.admin_user_id,
    subject_type: "impersonation",
    subject_id: id,
    action: "start",
    payload: {
      target_user_id: input.target_user_id,
      justification_hash: sha256Hex(input.justification),
      ticket_id: input.justification_ticket_id,
      cosigner_user_id: input.cosigner_user_id ?? null,
      expires_at: expires,
    },
    justification_ticket_id: input.justification_ticket_id,
    ip_hash: input.ip_hash,
    user_agent_class: input.user_agent_class,
  });

  // Mint a session AS the target with impersonator_user_id stamped.
  const { session, access_token, refresh_token, csrf_token } = await createSession(ctx, {
    user_id: input.target_user_id,
    workspace_id: input.workspace_id,
    ip_hash: input.ip_hash,
    user_agent_class: input.user_agent_class,
    device_id_hash: null,
    mfa_satisfied: true,
    impersonator_user_id: input.admin_user_id,
  });

  return {
    impersonation_id: id,
    session,
    access_token,
    refresh_token,
    csrf_token,
    expires_at: expires,
  };
}

export async function endImpersonation(
  ctx: AuthContext,
  args: {
    impersonation_id: string;
    admin_user_id: string;
    target_user_id: string;
    workspace_id: string;
    session_id: string;
    ended_reason: "self" | "expired" | "force_terminated" | "dsar";
    actions_summary: string[];
  },
): Promise<void> {
  await ctx.sessions.revoke(args.session_id, `impersonation_${args.ended_reason}`, ctx.now().toISOString());
  await emit("impersonation_ended", {
    session_id: args.impersonation_id,
    admin_user_id: args.admin_user_id,
    target_user_id: args.target_user_id,
    ended_reason: args.ended_reason,
    actions_summary: args.actions_summary,
  });
  await ctx.audit.write({
    workspace_id: args.workspace_id,
    actor_user_id: args.admin_user_id,
    impersonator_user_id: args.admin_user_id,
    subject_type: "impersonation",
    subject_id: args.impersonation_id,
    action: "end",
    payload: { ended_reason: args.ended_reason, actions_summary: args.actions_summary },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

/* ===== Role grants ===== */

export async function grantAdminRole(
  ctx: AuthContext,
  args: {
    grantor_user_id: string;
    cosigner_user_id: string;
    user_id: string;
    role: AdminRole;
    scopes?: AdminScope[];
  },
): Promise<void> {
  await requireAdminCapability(ctx, args.grantor_user_id, "grant_admin_role");
  if (args.cosigner_user_id === args.grantor_user_id) throw Errors.highRiskCosignRequired();
  const cosigner = await getAdminRole(ctx, args.cosigner_user_id);
  if (!cosigner || cosigner.role !== "super_admin") throw Errors.highRiskCosignRequired();

  await ctx.admin.upsertRole({
    user_id: args.user_id,
    role: args.role,
    granted_by: args.grantor_user_id,
    granted_at: ctx.now().toISOString(),
    revoked_at: null,
    revoked_by: null,
    scopes: args.scopes ?? [],
  });
  await ctx.audit.write({
    workspace_id: null,
    actor_user_id: args.grantor_user_id,
    impersonator_user_id: null,
    subject_type: "admin_role_grant",
    subject_id: args.user_id,
    action: "grant",
    payload: { role: args.role, scopes: args.scopes ?? [], cosigner_user_id: args.cosigner_user_id },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

export async function revokeAdminRole(
  ctx: AuthContext,
  args: { grantor_user_id: string; user_id: string },
): Promise<void> {
  await requireAdminCapability(ctx, args.grantor_user_id, "grant_admin_role");
  await ctx.admin.revokeRole(args.user_id, args.grantor_user_id, ctx.now().toISOString());
  await ctx.audit.write({
    workspace_id: null,
    actor_user_id: args.grantor_user_id,
    impersonator_user_id: null,
    subject_type: "admin_role_grant",
    subject_id: args.user_id,
    action: "revoke",
    payload: {},
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

export const ADMIN_CAPABILITIES = CAPS;
