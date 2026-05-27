/**
 * Storage ports.
 *
 * The auth package owns the *logic* of identity. It does NOT own the database.
 * Concrete implementations of these ports live in `@funnel/db` (or are passed
 * in by the app, e.g. an in-memory store for tests). This keeps auth testable
 * without a real Postgres and makes the boundary explicit.
 *
 * Every port returns plain object shapes — no Prisma types — so we can swap
 * backends in the future (Drizzle, Edge KV, whatever) without rewriting auth.
 */

import type { Role, UserId, WorkspaceId } from "@funnel/shared";
import type { AdminRole, AdminScope, Session } from "../types.js";

export interface UserRow {
  id: UserId;
  email: string;
  email_normalized: string;
  email_verified_at: string | null;
  full_name: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  mfa_enrolled: boolean;
  status: "pending_verification" | "active" | "deactivated" | "deleted";
  is_internal: boolean;
  created_at: string;
  /**
   * Login failure tracking — used by brute-force lockout. The store is free
   * to denormalize these on the users row or in a separate table; the port
   * only needs to read/increment them.
   */
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
}

export interface MfaSecretRow {
  user_id: UserId;
  type: "totp" | "webauthn";
  /** TOTP: base32 secret (encrypted at rest in real impl). WebAuthn: credential id. */
  secret: string;
  /** WebAuthn only: COSE public key, counter, transports. */
  webauthn?: {
    credential_public_key: string;
    counter: number;
    transports: string[];
  };
  label: string | null;
  /** argon2id-hashed recovery codes (TOTP only). */
  backup_codes_hashes: string[];
  enrolled_at: string;
  last_used_at: string | null;
}

export interface SingleUseTokenRow {
  id: string;
  purpose:
    | "email_verify"
    | "magic_link"
    | "password_reset"
    | "email_change"
    | "invite";
  user_id: UserId | null;
  workspace_id: WorkspaceId | null;
  /** sha256 of the token string (we never store raw tokens). */
  token_hash: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  /** IP that requested this token; logged for password reset audit. */
  requester_ip_hash: string | null;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: WorkspaceId;
  user_id: UserId;
  role: Role;
  invited_by: UserId | null;
  invited_at: string | null;
  joined_at: string | null;
  removed_at: string | null;
  removed_by: UserId | null;
}

export interface WorkspaceInviteRow {
  id: string;
  workspace_id: WorkspaceId;
  invited_email_normalized: string;
  role: Role;
  invited_by: UserId;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  workspace_id: WorkspaceId;
  created_by: UserId;
  label: string;
  prefix: string;
  secret_hash: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  rotated_from: string | null;
  revoked_at: string | null;
  revoked_by: UserId | null;
  created_at: string;
}

export interface AdminPermissionGrantRow {
  user_id: UserId;
  role: AdminRole;
  granted_by: UserId;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: UserId | null;
  scopes: AdminScope[];
}

export interface AuditLogInput {
  workspace_id: WorkspaceId | null;
  actor_user_id: UserId | null;
  impersonator_user_id: UserId | null;
  subject_type: string;
  subject_id: string;
  action: string;
  payload: Record<string, unknown>;
  justification_ticket_id: string | null;
  ip_hash: string | null;
  user_agent_class: string | null;
}

/* ===== Ports ===== */

export interface UserStore {
  findByEmail(emailNormalized: string): Promise<UserRow | null>;
  findById(userId: UserId): Promise<UserRow | null>;
  create(input: {
    id: UserId;
    email: string;
    email_normalized: string;
    password_hash: string | null;
    full_name?: string | null;
    is_internal?: boolean;
  }): Promise<UserRow>;
  update(userId: UserId, patch: Partial<UserRow>): Promise<UserRow>;
  recordFailedLogin(userId: UserId, lockoutUntil: string | null): Promise<void>;
  resetFailedLogins(userId: UserId, now: string): Promise<void>;
}

export interface SessionStore {
  create(session: Session): Promise<void>;
  get(sessionId: string): Promise<Session | null>;
  touch(sessionId: string, now: string, newExpiresAt: string): Promise<void>;
  revoke(sessionId: string, reason: string, now: string): Promise<void>;
  revokeAllForUser(userId: UserId, exceptSessionId: string | null, reason: string, now: string): Promise<number>;
  list(userId: UserId): Promise<Session[]>;
}

export interface SingleUseTokenStore {
  create(row: SingleUseTokenRow): Promise<void>;
  findByHash(tokenHash: string, purpose: SingleUseTokenRow["purpose"]): Promise<SingleUseTokenRow | null>;
  markConsumed(id: string, now: string): Promise<void>;
}

export interface MfaStore {
  list(userId: UserId): Promise<MfaSecretRow[]>;
  get(userId: UserId, type: "totp" | "webauthn"): Promise<MfaSecretRow | null>;
  upsert(row: MfaSecretRow): Promise<void>;
  remove(userId: UserId, type: "totp" | "webauthn"): Promise<void>;
  consumeBackupCode(userId: UserId, codeHash: string): Promise<boolean>;
  updateWebauthnCounter(userId: UserId, credentialId: string, counter: number): Promise<void>;
}

export interface WorkspaceStore {
  getMember(workspaceId: WorkspaceId, userId: UserId): Promise<WorkspaceMemberRow | null>;
  listMembers(workspaceId: WorkspaceId): Promise<WorkspaceMemberRow[]>;
  addMember(row: WorkspaceMemberRow): Promise<void>;
  updateMember(memberId: string, patch: Partial<WorkspaceMemberRow>): Promise<void>;
  createInvite(row: WorkspaceInviteRow): Promise<void>;
  findInviteByHash(tokenHash: string): Promise<WorkspaceInviteRow | null>;
  markInviteAccepted(inviteId: string, now: string): Promise<void>;
  markInviteDeclined(inviteId: string, now: string): Promise<void>;
  setOwner(workspaceId: WorkspaceId, newOwnerId: UserId, cooldownUntil: string): Promise<void>;
  scheduleClose(workspaceId: WorkspaceId, purgeAfter: string): Promise<void>;
  isClosed(workspaceId: WorkspaceId): Promise<boolean>;
}

export interface ApiKeyStore {
  create(row: ApiKeyRow): Promise<void>;
  get(id: string): Promise<ApiKeyRow | null>;
  findByPrefix(prefix: string): Promise<ApiKeyRow | null>;
  list(workspaceId: WorkspaceId): Promise<ApiKeyRow[]>;
  revoke(id: string, by: UserId, now: string): Promise<void>;
  touchUsed(id: string, now: string): Promise<void>;
}

export interface AdminStore {
  getRole(userId: UserId): Promise<AdminPermissionGrantRow | null>;
  upsertRole(row: AdminPermissionGrantRow): Promise<void>;
  revokeRole(userId: UserId, by: UserId, now: string): Promise<void>;
}

export interface RateLimiter {
  /**
   * Returns the number of attempts in the current window. The caller
   * decides the threshold; this is purely a counter with TTL.
   */
  increment(key: string, windowSec: number): Promise<{ count: number; reset_at: string }>;
  reset(key: string): Promise<void>;
}

export interface AuditWriter {
  write(entry: AuditLogInput): Promise<void>;
}

export interface AuthEnv {
  /** JWT signing key (HS256 for now, JWK or KMS in real prod). */
  jwt_secret: string;
  /** Issuer string baked into every JWT. */
  jwt_issuer: string;
  /** Cookie domain — `null` means host-only. */
  cookie_domain: string | null;
  /** WebAuthn relying party id and name. */
  rp_id: string;
  rp_name: string;
  /** OAuth callbacks. */
  oauth: {
    google?: { client_id: string; client_secret: string; redirect_uri: string };
    apple?: { client_id: string; client_secret: string; redirect_uri: string };
  };
  /**
   * Hash salt for IP/UA — the auth package never persists raw IPs.
   * Doc 03 §C.2 (PII tiering): IPs are P1 hashed.
   */
  ip_hash_salt: string;
}

export interface AuthContext {
  env: AuthEnv;
  users: UserStore;
  sessions: SessionStore;
  tokens: SingleUseTokenStore;
  mfa: MfaStore;
  workspaces: WorkspaceStore;
  apiKeys: ApiKeyStore;
  admin: AdminStore;
  rate: RateLimiter;
  audit: AuditWriter;
  /** Replaceable clock for tests. */
  now: () => Date;
  /** Replaceable random source for tests (returns base64url). */
  random: (bytes: number) => string;
}
