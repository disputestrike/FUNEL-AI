/**
 * In-memory implementations of every port in `internal/ports.ts`.
 *
 * Used by:
 *   - the auth package's own unit tests
 *   - the admin app's local dev mode (no Postgres needed to click around)
 *
 * NOT suitable for production. Lookups are O(n) on the underlying Maps.
 */

import type { UserId, WorkspaceId } from "@funnel/shared";
import type {
  AdminPermissionGrantRow,
  AdminStore,
  ApiKeyRow,
  ApiKeyStore,
  AuditLogInput,
  AuditWriter,
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
import type { Session } from "./types.js";

export class InMemoryUserStore implements UserStore {
  public users = new Map<UserId, UserRow>();
  private byEmail = new Map<string, UserId>();

  async findByEmail(emailNormalized: string): Promise<UserRow | null> {
    const id = this.byEmail.get(emailNormalized);
    return id ? (this.users.get(id) ?? null) : null;
  }
  async findById(userId: UserId): Promise<UserRow | null> {
    return this.users.get(userId) ?? null;
  }
  async create(input: {
    id: UserId;
    email: string;
    email_normalized: string;
    password_hash: string | null;
    full_name?: string | null;
    is_internal?: boolean;
  }): Promise<UserRow> {
    const row: UserRow = {
      id: input.id,
      email: input.email,
      email_normalized: input.email_normalized,
      email_verified_at: null,
      full_name: input.full_name ?? null,
      password_hash: input.password_hash,
      password_changed_at: null,
      mfa_enrolled: false,
      status: "pending_verification",
      is_internal: input.is_internal ?? false,
      created_at: new Date().toISOString(),
      failed_login_count: 0,
      locked_until: null,
      last_login_at: null,
    };
    this.users.set(row.id, row);
    this.byEmail.set(row.email_normalized, row.id);
    return row;
  }
  async update(userId: UserId, patch: Partial<UserRow>): Promise<UserRow> {
    const cur = this.users.get(userId);
    if (!cur) throw new Error(`user ${userId} not found`);
    if (patch.email_normalized && patch.email_normalized !== cur.email_normalized) {
      this.byEmail.delete(cur.email_normalized);
      this.byEmail.set(patch.email_normalized, userId);
    }
    const next = { ...cur, ...patch };
    this.users.set(userId, next);
    return next;
  }
  async recordFailedLogin(userId: UserId, lockoutUntil: string | null): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    u.failed_login_count += 1;
    u.locked_until = lockoutUntil;
  }
  async resetFailedLogins(userId: UserId, now: string): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    u.failed_login_count = 0;
    u.locked_until = null;
    u.last_login_at = now;
  }
}

export class InMemorySessionStore implements SessionStore {
  public sessions = new Map<string, Session>();
  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }
  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }
  async touch(sessionId: string, now: string, newExpiresAt: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.last_seen_at = now;
    s.expires_at = newExpiresAt;
  }
  async revoke(sessionId: string, reason: string, now: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.revoked_at = now;
    s.revoked_reason = reason;
  }
  async revokeAllForUser(
    userId: UserId,
    exceptSessionId: string | null,
    reason: string,
    now: string,
  ): Promise<number> {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.user_id !== userId) continue;
      if (s.revoked_at) continue;
      if (exceptSessionId && s.id === exceptSessionId) continue;
      s.revoked_at = now;
      s.revoked_reason = reason;
      count++;
    }
    return count;
  }
  async list(userId: UserId): Promise<Session[]> {
    return [...this.sessions.values()].filter((s) => s.user_id === userId);
  }
}

export class InMemoryTokenStore implements SingleUseTokenStore {
  public rows = new Map<string, SingleUseTokenRow>();
  private byHash = new Map<string, string>();
  async create(row: SingleUseTokenRow): Promise<void> {
    this.rows.set(row.id, row);
    this.byHash.set(`${row.purpose}:${row.token_hash}`, row.id);
  }
  async findByHash(tokenHash: string, purpose: SingleUseTokenRow["purpose"]): Promise<SingleUseTokenRow | null> {
    const id = this.byHash.get(`${purpose}:${tokenHash}`);
    return id ? (this.rows.get(id) ?? null) : null;
  }
  async markConsumed(id: string, now: string): Promise<void> {
    const r = this.rows.get(id);
    if (!r) return;
    r.consumed_at = now;
  }
}

export class InMemoryMfaStore implements MfaStore {
  public rows = new Map<string, MfaSecretRow>(); // key: `${user_id}:${type}`
  async list(userId: UserId): Promise<MfaSecretRow[]> {
    return [...this.rows.values()].filter((r) => r.user_id === userId);
  }
  async get(userId: UserId, type: "totp" | "webauthn"): Promise<MfaSecretRow | null> {
    return this.rows.get(`${userId}:${type}`) ?? null;
  }
  async upsert(row: MfaSecretRow): Promise<void> {
    this.rows.set(`${row.user_id}:${row.type}`, row);
  }
  async remove(userId: UserId, type: "totp" | "webauthn"): Promise<void> {
    this.rows.delete(`${userId}:${type}`);
  }
  async consumeBackupCode(userId: UserId, codeHash: string): Promise<boolean> {
    const r = this.rows.get(`${userId}:totp`);
    if (!r) return false;
    const before = r.backup_codes_hashes.length;
    r.backup_codes_hashes = r.backup_codes_hashes.filter((h) => h !== codeHash);
    return r.backup_codes_hashes.length < before;
  }
  async updateWebauthnCounter(userId: UserId, _credentialId: string, counter: number): Promise<void> {
    const r = this.rows.get(`${userId}:webauthn`);
    if (!r || !r.webauthn) return;
    r.webauthn.counter = counter;
  }
}

export class InMemoryWorkspaceStore implements WorkspaceStore {
  public members = new Map<string, WorkspaceMemberRow>();
  public invites = new Map<string, WorkspaceInviteRow>();
  public closed = new Set<WorkspaceId>();
  async getMember(workspaceId: WorkspaceId, userId: UserId): Promise<WorkspaceMemberRow | null> {
    return (
      [...this.members.values()].find(
        (m) => m.workspace_id === workspaceId && m.user_id === userId,
      ) ?? null
    );
  }
  async listMembers(workspaceId: WorkspaceId): Promise<WorkspaceMemberRow[]> {
    return [...this.members.values()].filter((m) => m.workspace_id === workspaceId);
  }
  async addMember(row: WorkspaceMemberRow): Promise<void> {
    this.members.set(row.id, row);
  }
  async updateMember(memberId: string, patch: Partial<WorkspaceMemberRow>): Promise<void> {
    const m = this.members.get(memberId);
    if (!m) return;
    this.members.set(memberId, { ...m, ...patch });
  }
  async createInvite(row: WorkspaceInviteRow): Promise<void> {
    this.invites.set(row.id, row);
  }
  async findInviteByHash(tokenHash: string): Promise<WorkspaceInviteRow | null> {
    return [...this.invites.values()].find((i) => i.token_hash === tokenHash) ?? null;
  }
  async markInviteAccepted(inviteId: string, now: string): Promise<void> {
    const i = this.invites.get(inviteId);
    if (i) i.accepted_at = now;
  }
  async markInviteDeclined(inviteId: string, now: string): Promise<void> {
    const i = this.invites.get(inviteId);
    if (i) i.declined_at = now;
  }
  async setOwner(_workspaceId: WorkspaceId, _newOwnerId: UserId, _cooldownUntil: string): Promise<void> {
    // In a real impl this would update the workspace owner_user_id + cooldown.
  }
  async scheduleClose(workspaceId: WorkspaceId, _purgeAfter: string): Promise<void> {
    this.closed.add(workspaceId);
  }
  async isClosed(workspaceId: WorkspaceId): Promise<boolean> {
    return this.closed.has(workspaceId);
  }
}

export class InMemoryApiKeyStore implements ApiKeyStore {
  public rows = new Map<string, ApiKeyRow>();
  async create(row: ApiKeyRow): Promise<void> {
    this.rows.set(row.id, row);
  }
  async get(id: string): Promise<ApiKeyRow | null> {
    return this.rows.get(id) ?? null;
  }
  async findByPrefix(prefix: string): Promise<ApiKeyRow | null> {
    return [...this.rows.values()].find((r) => r.prefix === prefix) ?? null;
  }
  async list(workspaceId: WorkspaceId): Promise<ApiKeyRow[]> {
    return [...this.rows.values()].filter((r) => r.workspace_id === workspaceId);
  }
  async revoke(id: string, by: UserId, now: string): Promise<void> {
    const r = this.rows.get(id);
    if (!r) return;
    r.revoked_at = now;
    r.revoked_by = by;
  }
  async touchUsed(id: string, now: string): Promise<void> {
    const r = this.rows.get(id);
    if (r) r.last_used_at = now;
  }
}

export class InMemoryAdminStore implements AdminStore {
  public rows = new Map<UserId, AdminPermissionGrantRow>();
  async getRole(userId: UserId): Promise<AdminPermissionGrantRow | null> {
    return this.rows.get(userId) ?? null;
  }
  async upsertRole(row: AdminPermissionGrantRow): Promise<void> {
    this.rows.set(row.user_id, row);
  }
  async revokeRole(userId: UserId, by: UserId, now: string): Promise<void> {
    const r = this.rows.get(userId);
    if (!r) return;
    r.revoked_at = now;
    r.revoked_by = by;
  }
}

export class InMemoryRateLimiter implements RateLimiter {
  private counts = new Map<string, { count: number; reset_at_ms: number }>();
  async increment(key: string, windowSec: number): Promise<{ count: number; reset_at: string }> {
    const now = Date.now();
    const cur = this.counts.get(key);
    if (!cur || cur.reset_at_ms <= now) {
      const reset = now + windowSec * 1000;
      this.counts.set(key, { count: 1, reset_at_ms: reset });
      return { count: 1, reset_at: new Date(reset).toISOString() };
    }
    cur.count += 1;
    return { count: cur.count, reset_at: new Date(cur.reset_at_ms).toISOString() };
  }
  async reset(key: string): Promise<void> {
    this.counts.delete(key);
  }
}

export class InMemoryAuditWriter implements AuditWriter {
  public entries: AuditLogInput[] = [];
  async write(entry: AuditLogInput): Promise<void> {
    this.entries.push(entry);
  }
}

import type { AuthContext, AuthEnv } from "./internal/ports.js";
import crypto from "node:crypto";

export function makeInMemoryAuthContext(envOverride: Partial<AuthEnv> = {}): AuthContext {
  const env: AuthEnv = {
    jwt_secret: envOverride.jwt_secret ?? crypto.randomBytes(32).toString("hex"),
    jwt_issuer: envOverride.jwt_issuer ?? "gofunnelai.com",
    cookie_domain: envOverride.cookie_domain ?? null,
    rp_id: envOverride.rp_id ?? "gofunnelai.com",
    rp_name: envOverride.rp_name ?? "GoFunnelAI",
    oauth: envOverride.oauth ?? {},
    ip_hash_salt: envOverride.ip_hash_salt ?? "test-salt",
  };
  return {
    env,
    users: new InMemoryUserStore(),
    sessions: new InMemorySessionStore(),
    tokens: new InMemoryTokenStore(),
    mfa: new InMemoryMfaStore(),
    workspaces: new InMemoryWorkspaceStore(),
    apiKeys: new InMemoryApiKeyStore(),
    admin: new InMemoryAdminStore(),
    rate: new InMemoryRateLimiter(),
    audit: new InMemoryAuditWriter(),
    now: () => new Date(),
    random: (bytes: number) => crypto.randomBytes(bytes).toString("base64url"),
  };
}
