/**
 * Auth domain errors. Every error has a stable `code` we surface in API
 * responses; callers should never branch on `.message` because copy can change.
 *
 * We intentionally avoid leaking *why* a login failed (e.g. distinguishing
 * "no such user" from "wrong password" externally) — see `LoginFailed`.
 */

export type AuthErrorCode =
  | "invalid_credentials"
  | "rate_limited"
  | "locked_out"
  | "email_not_verified"
  | "email_already_in_use"
  | "weak_password"
  | "invalid_token"
  | "expired_token"
  | "consumed_token"
  | "mfa_required"
  | "mfa_invalid"
  | "mfa_already_enrolled"
  | "mfa_not_enrolled"
  | "session_expired"
  | "session_revoked"
  | "session_idle_timeout"
  | "csrf_invalid"
  | "permission_denied"
  | "workspace_not_found"
  | "workspace_closed"
  | "invite_invalid"
  | "invite_expired"
  | "invite_already_accepted"
  | "owner_cannot_leave"
  | "api_key_revoked"
  | "api_key_invalid"
  | "admin_required"
  | "admin_mfa_required"
  | "admin_role_revoked"
  | "high_risk_cosign_required"
  | "impersonation_disallowed"
  | "impersonation_expired"
  | "internal";

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly status: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(code: AuthErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  invalidCredentials: () => new AuthError("invalid_credentials", "Email or password is incorrect.", 401),
  rateLimited: (retryAfterSec: number) =>
    new AuthError("rate_limited", "Too many attempts. Try again later.", 429, { retry_after_sec: retryAfterSec }),
  lockedOut: (until: string) => new AuthError("locked_out", "Account temporarily locked.", 423, { until }),
  emailNotVerified: () => new AuthError("email_not_verified", "Please verify your email first.", 403),
  emailInUse: () => new AuthError("email_already_in_use", "That email is already registered.", 409),
  weakPassword: (reason: string) => new AuthError("weak_password", reason, 400),
  invalidToken: () => new AuthError("invalid_token", "Token is invalid.", 400),
  expiredToken: () => new AuthError("expired_token", "Token has expired.", 410),
  consumedToken: () => new AuthError("consumed_token", "Token has already been used.", 410),
  mfaRequired: () => new AuthError("mfa_required", "Multi-factor authentication required.", 401),
  mfaInvalid: () => new AuthError("mfa_invalid", "MFA code is invalid.", 401),
  mfaAlreadyEnrolled: () => new AuthError("mfa_already_enrolled", "MFA already enrolled.", 409),
  mfaNotEnrolled: () => new AuthError("mfa_not_enrolled", "MFA is not enrolled.", 400),
  sessionExpired: () => new AuthError("session_expired", "Session expired.", 401),
  sessionRevoked: () => new AuthError("session_revoked", "Session has been revoked.", 401),
  sessionIdleTimeout: () => new AuthError("session_idle_timeout", "Session timed out due to inactivity.", 401),
  csrfInvalid: () => new AuthError("csrf_invalid", "CSRF check failed.", 403),
  permissionDenied: (resource: string, action: string) =>
    new AuthError("permission_denied", `Not permitted to ${action} ${resource}.`, 403, { resource, action }),
  workspaceNotFound: () => new AuthError("workspace_not_found", "Workspace not found.", 404),
  workspaceClosed: () => new AuthError("workspace_closed", "Workspace is closed.", 410),
  inviteInvalid: () => new AuthError("invite_invalid", "Invite is invalid.", 400),
  inviteExpired: () => new AuthError("invite_expired", "Invite has expired.", 410),
  inviteAlreadyAccepted: () => new AuthError("invite_already_accepted", "Invite already used.", 410),
  ownerCannotLeave: () => new AuthError("owner_cannot_leave", "Owner must transfer ownership first.", 409),
  apiKeyRevoked: () => new AuthError("api_key_revoked", "API key has been revoked.", 401),
  apiKeyInvalid: () => new AuthError("api_key_invalid", "API key is invalid.", 401),
  adminRequired: () => new AuthError("admin_required", "Admin role required.", 403),
  adminMfaRequired: () => new AuthError("admin_mfa_required", "Admin MFA enrollment required.", 403),
  adminRoleRevoked: () => new AuthError("admin_role_revoked", "Admin role has been revoked.", 403),
  highRiskCosignRequired: () => new AuthError("high_risk_cosign_required", "Co-sign by a second super_admin required.", 403),
  impersonationDisallowed: (why: string) => new AuthError("impersonation_disallowed", why, 403),
  impersonationExpired: () => new AuthError("impersonation_expired", "Impersonation session has expired.", 410),
  internal: (msg = "Internal error") => new AuthError("internal", msg, 500),
} as const;
