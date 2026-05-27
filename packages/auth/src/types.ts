/**
 * Public types for the auth package. Lightweight, framework-agnostic shapes
 * that wrap @funnel/shared's User/Workspace and the DB models.
 *
 * We deliberately keep IO shapes here (CreateSessionInput, LoginResult, etc.)
 * separate from domain models so callers can pin them without dragging in
 * Prisma types.
 */

import type { Role, UserId, WorkspaceId } from "@funnel/shared";

export type AdminRole =
  | "read_only"
  | "support"
  | "billing_admin"
  | "engineering"
  | "super_admin";

export const ADMIN_ROLES: readonly AdminRole[] = [
  "read_only",
  "support",
  "billing_admin",
  "engineering",
  "super_admin",
] as const;

export type AdminScope =
  | "pii:read"
  | "impersonate:high_risk"
  | "audit:read_all"
  | "billing:cap_exempt"
  | "role:grant";

export interface SessionTokenClaims {
  /** Session id (`ses_*`). */
  sid: string;
  /** User id (`usr_*`). */
  sub: UserId;
  /** Currently active workspace, if any. */
  wsid?: WorkspaceId;
  /** If this is an impersonation session, the impersonator user id. */
  impersonator_user_id?: UserId;
  /** Admin session id, if any. */
  admin_sid?: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
  /** Token type — access vs refresh. */
  typ: "access" | "refresh";
}

export interface CreateSessionInput {
  user_id: UserId;
  workspace_id?: WorkspaceId | null;
  ip_hash: string;
  user_agent_class: string | null;
  device_id_hash: string | null;
  /** Was MFA satisfied on the credential check that minted this session? */
  mfa_satisfied: boolean;
  /** If true, ties this to an impersonation_sessions row. */
  impersonator_user_id?: UserId | null;
  admin_session_id?: string | null;
}

export interface Session {
  id: string;
  user_id: UserId;
  workspace_id: WorkspaceId | null;
  ip_hash: string;
  user_agent_class: string | null;
  device_id_hash: string | null;
  mfa_satisfied: boolean;
  impersonator_user_id: UserId | null;
  admin_session_id: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface LoginRequestInput {
  email: string;
  password: string;
  ip: string;
  user_agent: string;
}

export interface LoginResult {
  /** Either a fully-authed session or a step-up requirement. */
  status: "authenticated" | "mfa_required" | "new_device_review";
  session?: Session;
  access_token?: string;
  refresh_token?: string;
  csrf_token?: string;
  /** Short-lived pre-auth token used to complete MFA challenge. */
  mfa_challenge_token?: string;
}

export interface CookieDirective {
  name: string;
  value: string;
  http_only: boolean;
  secure: boolean;
  same_site: "Lax" | "Strict" | "None";
  path: string;
  max_age_sec: number;
  domain?: string;
}

/** Result of a successful signup. */
export interface SignupResult {
  user_id: UserId;
  email: string;
  verification_required: true;
  verification_email_queued: boolean;
}

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "invite"
  | "transfer"
  | "manage_billing"
  | "manage_api_keys"
  | "impersonate";

export type PermissionResource =
  | "workspace"
  | "workspace.members"
  | "workspace.billing"
  | "workspace.api_keys"
  | "funnel"
  | "lead"
  | "contact"
  | "audit_log";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  role?: Role;
}
