/**
 * @funnel/auth — public API.
 *
 * Identity, sessions, MFA, SSO, workspace membership, permissions, API keys,
 * admin roles, and impersonation. See README.md for usage.
 */

export { AuthError, Errors } from "./errors.js";
export type { AuthErrorCode } from "./errors.js";

export type {
  AdminRole,
  AdminScope,
  CookieDirective,
  CreateSessionInput,
  LoginRequestInput,
  LoginResult,
  PermissionAction,
  PermissionCheckResult,
  PermissionResource,
  Session,
  SessionTokenClaims,
  SignupResult,
} from "./types.js";
export { ADMIN_ROLES } from "./types.js";

export type {
  AdminPermissionGrantRow,
  ApiKeyRow,
  ApiKeyStore,
  AdminStore,
  AuditLogInput,
  AuditWriter,
  AuthContext,
  AuthEnv,
  MfaSecretRow,
  MfaStore,
  RateLimiter,
  SessionStore,
  SingleUseTokenRow,
  SingleUseTokenStore,
  UserRow,
  UserStore,
  WorkspaceInviteRow,
  WorkspaceMemberRow,
  WorkspaceStore,
} from "./internal/ports.js";

export { signupWithEmail, resendVerification } from "./signup.js";
export { verifyEmail } from "./verify.js";
export { loginWithEmail, verifyMfaChallengeToken } from "./login.js";
export { magicLinkRequest, magicLinkVerify } from "./magic-link.js";
export { passwordResetRequest, passwordResetConfirm } from "./password-reset.js";
export { changePassword } from "./password-change.js";
export { emailChangeRequest, emailChangeConfirm } from "./email-change.js";

export {
  totpEnrollBegin,
  totpEnrollConfirm,
  totpDisable,
  verifyTotp,
  webauthnAuthenticationBegin,
  webauthnAuthenticationVerify,
  webauthnRegistrationBegin,
  webauthnRegistrationVerify,
} from "./mfa.js";

export {
  ACCESS_TOKEN_TTL_SEC,
  COOKIE_NAMES,
  IDLE_TIMEOUT_SEC,
  REFRESH_TOKEN_TTL_SEC,
  authenticate,
  buildCookies,
  clearCookies,
  createSession,
  deriveDeviceFingerprint,
  refreshSession,
  revokeAllOtherSessions,
  revokeSession,
  verifyAccessToken,
  verifyCsrf,
  verifyRefreshToken,
} from "./session.js";

export { beginSso, completeSso } from "./sso.js";
export type { SsoProvider } from "./sso.js";

export {
  acceptInvite,
  changeRole,
  closeWorkspace,
  declineInvite,
  inviteMember,
  removeMember,
  transferOwnership,
} from "./workspace.js";

export {
  ROLE_MATRIX,
  buildRlsContext,
  can,
  requirePermission,
} from "./permissions.js";

export {
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  parseApiKey,
  revokeApiKey,
  rotateApiKey,
} from "./api-keys.js";

export {
  ADMIN_CAPABILITIES,
  IMPERSONATION_MAX_SEC,
  assertCapCents,
  completeAdminLogin,
  endImpersonation,
  getAdminRole,
  grantAdminRole,
  requireAdminCapability,
  revokeAdminRole,
  startImpersonation,
} from "./admin-roles.js";
export type { AdminCapability, AdminLoginResult, StartImpersonationResult } from "./admin-roles.js";

export { makeInMemoryAuthContext } from "./in-memory.js";
export {
  InMemoryAdminStore,
  InMemoryApiKeyStore,
  InMemoryAuditWriter,
  InMemoryMfaStore,
  InMemoryRateLimiter,
  InMemorySessionStore,
  InMemoryTokenStore,
  InMemoryUserStore,
  InMemoryWorkspaceStore,
} from "./in-memory.js";
