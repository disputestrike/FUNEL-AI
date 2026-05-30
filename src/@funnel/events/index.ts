/**
 * GoFunnelAI canonical event taxonomy.
 *
 * Every event passes through `emit(eventName, props)` which:
 *   - validates the payload against its zod schema,
 *   - strips PII (raw emails, IPs) by convention (callers MUST pre-hash IPs),
 *   - hands the typed payload to whichever sink is configured.
 *
 * See `docs/03-event-taxonomy-and-schemas.md` for the full taxonomy.
 */

import { z } from "zod";

const AuditId = z.string().min(1);

export const AuditRequestedSchema = z.object({
  audit_id: AuditId,
  url_hostname: z.string(),
  url_hash: z.string(),
  requester_ip_hash: z.string().nullable(),
  referrer: z.string().nullable().optional(),
  utm: z.record(z.string()).optional(),
  user_agent_class: z.string().nullable().optional(),
});

export const AuditRenderStartedSchema = z.object({ audit_id: AuditId });
export const AuditRenderCompletedSchema = z.object({
  audit_id: AuditId,
  duration_ms: z.number().int().nonnegative(),
  dom_bytes: z.number().int().nonnegative(),
  lighthouse_perf: z.number().int().nullable(),
});

export const AuditAgentCompletedSchema = z.object({
  audit_id: AuditId,
  agent_name: z.string(),
  ok: z.boolean(),
  duration_ms: z.number().int().nonnegative(),
  tokens_in: z.number().int().nonnegative().optional(),
  tokens_out: z.number().int().nonnegative().optional(),
  cache_read_tokens: z.number().int().nonnegative().optional(),
});

export const AuditCompletedSchema = z.object({
  audit_id: AuditId,
  total_duration_ms: z.number().int().nonnegative(),
  score_overall: z.number().int().nullable(),
  score_grade: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
  degraded_count: z.number().int().nonnegative(),
  cost_cents: z.number().nonnegative(),
});

export const AuditFailedSchema = z.object({
  audit_id: AuditId,
  stage: z.string(),
  reason: z.string(),
});

export const ShareLinkGeneratedSchema = z.object({
  audit_id: AuditId,
  share_code: z.string(),
});

export const ShareLinkViewedSchema = z.object({
  share_code: z.string(),
  referrer: z.string().nullable().optional(),
});

export const EmailCapturedSchema = z.object({
  audit_id: AuditId.optional(),
  source: z.enum(["grader_pdf_gate", "grader_waitlist", "preview_cta"]),
  marketing_consent: z.boolean(),
  email_domain: z.string(),
  email_hash: z.string(),
});

export const PreviewClickedSchema = z.object({ audit_id: AuditId });
export const PreviewCompletedSchema = z.object({
  audit_id: AuditId,
  duration_ms: z.number().int().nonnegative(),
  cost_cents: z.number().nonnegative(),
});

export const WaitlistJoinedSchema = z.object({
  audit_id: AuditId.optional(),
  source: z.string(),
  position: z.number().int().positive().nullable(),
});

export const RateLimitedSchema = z.object({
  layer: z.string(),
  scope: z.string(),
  endpoint: z.string(),
});

/* =========================================================================
 * Identity / Auth / Workspace / Admin events.
 *
 * These map to Doc 03 Â§A.1 (Identity), Â§A.7 (Revenue/account state) and
 * Â§A.8 (Support / admin actions). Schemas are intentionally permissive
 * (untrustedActor optional fields) because they're produced from multiple
 * services. Every admin-write event carries `actor_user_id` + an optional
 * `impersonator_user_id`.
 *
 * Names below MUST stay in sync with Doc 03 Appendix B.
 * ======================================================================= */

const UserIdStr = z.string().min(1);
const WorkspaceIdStr = z.string().min(1);

const ActorRefSchema = z.object({
  type: z.enum(["user", "admin", "system", "api_key"]),
  user_id: UserIdStr.optional(),
  impersonator_user_id: UserIdStr.optional(),
  admin_session_id: z.string().optional(),
});

export const UserSignedUpSchema = z.object({
  user_id: UserIdStr,
  email_domain: z.string(),
  email_hash: z.string(),
  source: z.enum(["email", "google", "apple", "magic_link", "invite"]),
});

export const UserEmailVerifiedSchema = z.object({
  user_id: UserIdStr,
  email_hash: z.string(),
});

export const UserLoggedInSchema = z.object({
  user_id: UserIdStr,
  session_id: z.string(),
  method: z.enum(["password", "google", "apple", "magic_link", "webauthn"]),
  mfa_used: z.boolean(),
  new_device: z.boolean(),
  ip_hash: z.string(),
});

export const UserLoginFailedSchema = z.object({
  email_hash: z.string(),
  reason: z.enum([
    "invalid_credentials",
    "locked_out",
    "rate_limited",
    "email_not_verified",
    "mfa_invalid",
  ]),
  ip_hash: z.string(),
});

export const UserLoggedOutSchema = z.object({
  user_id: UserIdStr,
  session_id: z.string(),
  reason: z.string(),
});

export const UserPasswordResetRequestedSchema = z.object({
  user_id: UserIdStr.nullable(),
  email_hash: z.string(),
  actor: ActorRefSchema,
  ip_hash: z.string().nullable(),
});

export const UserPasswordChangedSchema = z.object({
  user_id: UserIdStr,
  via: z.enum(["self", "password_reset", "admin"]),
  sessions_invalidated: z.number().int().nonnegative(),
});

export const UserVerificationResentSchema = z.object({
  user_id: UserIdStr.nullable(),
  email_hash: z.string(),
  actor: ActorRefSchema,
});

export const UserMfaEnrolledSchema = z.object({
  user_id: UserIdStr,
  factor: z.enum(["totp", "webauthn"]),
});

export const UserMfaDisabledSchema = z.object({
  user_id: UserIdStr,
  factor: z.enum(["totp", "webauthn"]),
  actor: ActorRefSchema,
});

export const WorkspaceCreatedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  owner_user_id: UserIdStr,
  plan: z.string(),
});

export const WorkspaceMemberInvitedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  invited_email_hash: z.string(),
  invited_by: UserIdStr,
  role: z.string(),
});

export const WorkspaceMemberJoinedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  user_id: UserIdStr,
  role: z.string(),
});

export const WorkspaceMemberRemovedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  user_id: UserIdStr,
  actor: ActorRefSchema,
});

export const WorkspaceMemberRoleChangedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  user_id: UserIdStr,
  from_role: z.string(),
  to_role: z.string(),
  actor: ActorRefSchema,
});

export const WorkspaceOwnershipTransferredSchema = z.object({
  workspace_id: WorkspaceIdStr,
  from_user_id: UserIdStr,
  to_user_id: UserIdStr,
  effective_at: z.string(),
});

export const WorkspaceClosedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  closed_by: UserIdStr,
  reason: z.string().nullable(),
  purge_after: z.string(),
});

export const ApiKeyCreatedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  api_key_id: z.string(),
  prefix: z.string(),
  created_by: UserIdStr,
});

export const ApiKeyRevokedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  api_key_id: z.string(),
  revoked_by: UserIdStr,
});

/* ===== Admin / impersonation (A.8) ===== */

export const ImpersonationStartedSchema = z.object({
  session_id: z.string(),
  admin_user_id: UserIdStr,
  target_user_id: UserIdStr,
  workspace_id: WorkspaceIdStr,
  justification: z.string().min(20),
  justification_ticket_id: z.string(),
  cosigner_user_id: UserIdStr.nullable().optional(),
  expires_at: z.string(),
});

export const ImpersonationEndedSchema = z.object({
  session_id: z.string(),
  admin_user_id: UserIdStr,
  target_user_id: UserIdStr,
  ended_reason: z.enum(["self", "expired", "force_terminated", "dsar"]),
  actions_summary: z.array(z.string()),
});

export const AdminCreditAppliedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  admin_user_id: UserIdStr,
  amount_cents: z.number().int(),
  currency: z.string().length(3),
  justification_ticket_id: z.string(),
});

export const AdminRefundIssuedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  payment_id: z.string(),
  admin_user_id: UserIdStr,
  amount_cents: z.number().int(),
  currency: z.string().length(3),
  reason: z.string(),
  justification_ticket_id: z.string(),
});

export const AdminPermissionDeniedSchema = z.object({
  admin_user_id: UserIdStr,
  attempted_action: z.string(),
  resource: z.string(),
  reason: z.string(),
});

export const InternalNoteAddedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  note_id: z.string(),
  author_user_id: UserIdStr,
  subject_type: z.string(),
  subject_id: z.string(),
});

export const AccountSuspendedSchema = z.object({
  workspace_id: WorkspaceIdStr,
  admin_user_id: UserIdStr,
  reason: z.string(),
  justification_ticket_id: z.string(),
});

export const AccountRestoredSchema = z.object({
  workspace_id: WorkspaceIdStr,
  admin_user_id: UserIdStr,
  justification_ticket_id: z.string(),
});

export const PiiAccessRecordedSchema = z.object({
  admin_user_id: UserIdStr,
  workspace_id: WorkspaceIdStr,
  subject_type: z.string(),
  subject_id: z.string(),
  fields: z.array(z.string()),
});

export const EventSchemas = {
  audit_requested: AuditRequestedSchema,
  audit_render_started: AuditRenderStartedSchema,
  audit_render_completed: AuditRenderCompletedSchema,
  audit_agent_completed: AuditAgentCompletedSchema,
  audit_completed: AuditCompletedSchema,
  audit_failed: AuditFailedSchema,
  share_link_generated: ShareLinkGeneratedSchema,
  share_link_viewed: ShareLinkViewedSchema,
  email_captured: EmailCapturedSchema,
  preview_clicked: PreviewClickedSchema,
  preview_completed: PreviewCompletedSchema,
  waitlist_joined: WaitlistJoinedSchema,
  rate_limited: RateLimitedSchema,

  // Identity
  user_signed_up: UserSignedUpSchema,
  user_email_verified: UserEmailVerifiedSchema,
  user_logged_in: UserLoggedInSchema,
  user_login_failed: UserLoginFailedSchema,
  user_logged_out: UserLoggedOutSchema,
  user_password_reset_requested: UserPasswordResetRequestedSchema,
  user_password_changed: UserPasswordChangedSchema,
  user_verification_resent: UserVerificationResentSchema,
  user_mfa_enrolled: UserMfaEnrolledSchema,
  user_mfa_disabled: UserMfaDisabledSchema,

  // Workspace
  workspace_created: WorkspaceCreatedSchema,
  workspace_member_invited: WorkspaceMemberInvitedSchema,
  workspace_member_joined: WorkspaceMemberJoinedSchema,
  workspace_member_removed: WorkspaceMemberRemovedSchema,
  workspace_member_role_changed: WorkspaceMemberRoleChangedSchema,
  workspace_ownership_transferred: WorkspaceOwnershipTransferredSchema,
  workspace_closed: WorkspaceClosedSchema,

  // API keys
  api_key_created: ApiKeyCreatedSchema,
  api_key_revoked: ApiKeyRevokedSchema,

  // Admin / impersonation
  impersonation_started: ImpersonationStartedSchema,
  impersonation_ended: ImpersonationEndedSchema,
  admin_credit_applied: AdminCreditAppliedSchema,
  admin_refund_issued: AdminRefundIssuedSchema,
  admin_permission_denied: AdminPermissionDeniedSchema,
  internal_note_added: InternalNoteAddedSchema,
  account_suspended: AccountSuspendedSchema,
  account_restored: AccountRestoredSchema,
  pii_access_recorded: PiiAccessRecordedSchema,
} as const;

export type EventName = keyof typeof EventSchemas;
export type EventPayload<N extends EventName> = z.infer<(typeof EventSchemas)[N]>;

/** Pluggable sink — defaults to console; production wires PostHog + Analytics Engine. */
export type EventSink = (eventName: EventName, payload: unknown, ts: number) => void | Promise<void>;

const defaultSink: EventSink = (eventName, payload, ts) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: eventName, ts, ...((payload as object) ?? {}) }));
};

let currentSink: EventSink = defaultSink;

export function setEventSink(sink: EventSink): void {
  currentSink = sink;
}

/**
 * Emit a validated, typed event. Throws if payload fails schema validation —
 * we want loud failures in dev, not silently dropped telemetry.
 */
export async function emit<N extends EventName>(name: N, payload: EventPayload<N>): Promise<void> {
  const schema = EventSchemas[name];
  const parsed = schema.parse(payload);
  await currentSink(name, parsed, Date.now());
}
