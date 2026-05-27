/**
 * Session management.
 *
 * Tokens
 *  - Access token: short-lived (15m), HS256 JWT, no DB roundtrip required.
 *  - Refresh token: bound to a `Session` row in the DB. Used to mint new access
 *    tokens. We treat session rows as the source of truth — a revoked session
 *    cannot mint new access tokens even if a stolen JWT is still under its
 *    nominal expiry, because callers MUST validate `sid` against the store on
 *    every refresh.
 *
 * Cookies
 *  - `__Host-funnel-access`: HttpOnly, Secure, SameSite=Lax, Path=/, host-only.
 *  - `__Host-funnel-refresh`: HttpOnly, Secure, SameSite=Lax, Path=/auth/refresh.
 *  - `funnel-csrf`: NOT HttpOnly (double-submit pattern — readable by JS so the
 *    SPA can echo it as a header).
 *
 * Lifetimes
 *  - Access: 15m
 *  - Refresh: 30d rolling (extends on each refresh, capped at 30d from latest use)
 *  - Idle timeout: 24h (any session without a touch in 24h is revoked)
 */

import { SignJWT, jwtVerify } from "jose";
import { Errors } from "./errors.js";
import { classifyUserAgent, hashIp } from "./internal/hash.js";
import { newId } from "./internal/ids.js";
import type { AuthContext } from "./internal/ports.js";
import type {
  CookieDirective,
  CreateSessionInput,
  Session,
  SessionTokenClaims,
} from "./types.js";

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;
export const IDLE_TIMEOUT_SEC = 24 * 60 * 60;

const ACCESS_COOKIE = "__Host-funnel-access";
const REFRESH_COOKIE = "__Host-funnel-refresh";
const CSRF_COOKIE = "funnel-csrf";

function secret(ctx: AuthContext): Uint8Array {
  return new TextEncoder().encode(ctx.env.jwt_secret);
}

function isoFromEpochSec(s: number): string {
  return new Date(s * 1000).toISOString();
}

async function signJwt(
  ctx: AuthContext,
  claims: Omit<SessionTokenClaims, "iat" | "exp"> & { typ: "access" | "refresh" },
  ttlSec: number,
): Promise<{ token: string; iat: number; exp: number }> {
  const iat = Math.floor(ctx.now().getTime() / 1000);
  const exp = iat + ttlSec;
  const token = await new SignJWT({ ...claims, typ: claims.typ })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ctx.env.jwt_issuer)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setSubject(claims.sub)
    .setJti(claims.sid)
    .sign(secret(ctx));
  return { token, iat, exp };
}

export async function verifyAccessToken(
  ctx: AuthContext,
  token: string,
): Promise<SessionTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret(ctx), {
      issuer: ctx.env.jwt_issuer,
    });
    const c = payload as unknown as SessionTokenClaims;
    if (c.typ !== "access") throw Errors.sessionExpired();
    return c;
  } catch (err) {
    if (err instanceof Error && err.name === "JWTExpired") throw Errors.sessionExpired();
    throw Errors.invalidToken();
  }
}

export async function verifyRefreshToken(
  ctx: AuthContext,
  token: string,
): Promise<SessionTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret(ctx), {
      issuer: ctx.env.jwt_issuer,
    });
    const c = payload as unknown as SessionTokenClaims;
    if (c.typ !== "refresh") throw Errors.invalidToken();
    return c;
  } catch (err) {
    if (err instanceof Error && err.name === "JWTExpired") throw Errors.sessionExpired();
    throw Errors.invalidToken();
  }
}

export async function createSession(
  ctx: AuthContext,
  input: CreateSessionInput,
): Promise<{
  session: Session;
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  cookies: CookieDirective[];
}> {
  const id = newId("ses");
  const now = ctx.now();
  const session: Session = {
    id,
    user_id: input.user_id,
    workspace_id: input.workspace_id ?? null,
    ip_hash: input.ip_hash,
    user_agent_class: input.user_agent_class,
    device_id_hash: input.device_id_hash,
    mfa_satisfied: input.mfa_satisfied,
    impersonator_user_id: input.impersonator_user_id ?? null,
    admin_session_id: input.admin_session_id ?? null,
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString(),
    revoked_at: null,
    revoked_reason: null,
  };
  await ctx.sessions.create(session);

  const baseClaims: Omit<SessionTokenClaims, "iat" | "exp" | "typ"> = {
    sid: id,
    sub: input.user_id,
    ...(input.workspace_id ? { wsid: input.workspace_id } : {}),
    ...(input.impersonator_user_id ? { impersonator_user_id: input.impersonator_user_id } : {}),
    ...(input.admin_session_id ? { admin_sid: input.admin_session_id } : {}),
  };
  const access = await signJwt(ctx, { ...baseClaims, typ: "access" }, ACCESS_TOKEN_TTL_SEC);
  const refresh = await signJwt(ctx, { ...baseClaims, typ: "refresh" }, REFRESH_TOKEN_TTL_SEC);

  const csrf = ctx.random(32);

  return {
    session,
    access_token: access.token,
    refresh_token: refresh.token,
    csrf_token: csrf,
    cookies: buildCookies(ctx, access.token, refresh.token, csrf),
  };
}

export function buildCookies(
  ctx: AuthContext,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
): CookieDirective[] {
  const base: Pick<CookieDirective, "secure" | "same_site" | "domain"> = {
    secure: true,
    same_site: "Lax",
    ...(ctx.env.cookie_domain ? { domain: ctx.env.cookie_domain } : {}),
  };
  return [
    {
      ...base,
      name: ACCESS_COOKIE,
      value: accessToken,
      http_only: true,
      path: "/",
      max_age_sec: ACCESS_TOKEN_TTL_SEC,
    },
    {
      ...base,
      name: REFRESH_COOKIE,
      value: refreshToken,
      http_only: true,
      path: "/auth/refresh",
      max_age_sec: REFRESH_TOKEN_TTL_SEC,
    },
    {
      ...base,
      name: CSRF_COOKIE,
      value: csrfToken,
      http_only: false, // CSRF token is meant to be read by client JS.
      path: "/",
      max_age_sec: REFRESH_TOKEN_TTL_SEC,
    },
  ];
}

export function clearCookies(ctx: AuthContext): CookieDirective[] {
  const base = {
    secure: true,
    same_site: "Lax" as const,
    http_only: true,
    value: "",
    max_age_sec: 0,
    ...(ctx.env.cookie_domain ? { domain: ctx.env.cookie_domain } : {}),
  };
  return [
    { ...base, name: ACCESS_COOKIE, path: "/" },
    { ...base, name: REFRESH_COOKIE, path: "/auth/refresh" },
    { ...base, name: CSRF_COOKIE, path: "/", http_only: false },
  ];
}

/**
 * Refresh an access token using a refresh token. Enforces:
 *  - session exists and not revoked
 *  - not past idle timeout
 *  - not past expiry
 *
 * Returns a new access token (and rotates the session expiry so we get
 * 30d rolling refresh, but keeps the same session id).
 */
export async function refreshSession(
  ctx: AuthContext,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; session: Session }> {
  const claims = await verifyRefreshToken(ctx, refreshToken);
  const session = await ctx.sessions.get(claims.sid);
  if (!session) throw Errors.sessionExpired();
  if (session.revoked_at) throw Errors.sessionRevoked();

  const now = ctx.now();
  const lastSeen = new Date(session.last_seen_at).getTime();
  if (now.getTime() - lastSeen > IDLE_TIMEOUT_SEC * 1000) {
    await ctx.sessions.revoke(session.id, "idle_timeout", now.toISOString());
    throw Errors.sessionIdleTimeout();
  }
  if (now.getTime() > new Date(session.expires_at).getTime()) {
    await ctx.sessions.revoke(session.id, "expired", now.toISOString());
    throw Errors.sessionExpired();
  }

  const newExpires = new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString();
  await ctx.sessions.touch(session.id, now.toISOString(), newExpires);

  const baseClaims: Omit<SessionTokenClaims, "iat" | "exp" | "typ"> = {
    sid: session.id,
    sub: session.user_id,
    ...(session.workspace_id ? { wsid: session.workspace_id } : {}),
    ...(session.impersonator_user_id ? { impersonator_user_id: session.impersonator_user_id } : {}),
    ...(session.admin_session_id ? { admin_sid: session.admin_session_id } : {}),
  };
  const access = await signJwt(ctx, { ...baseClaims, typ: "access" }, ACCESS_TOKEN_TTL_SEC);
  const refresh = await signJwt(ctx, { ...baseClaims, typ: "refresh" }, REFRESH_TOKEN_TTL_SEC);

  return {
    access_token: access.token,
    refresh_token: refresh.token,
    session: { ...session, last_seen_at: now.toISOString(), expires_at: newExpires },
  };
}

/**
 * Verify the access token AND check the session row hasn't been revoked.
 * Most middlewares should call this on every request — it's the only way to
 * make revocation work for stolen access tokens before their 15-min expiry.
 */
export async function authenticate(
  ctx: AuthContext,
  accessToken: string,
): Promise<{ session: Session; claims: SessionTokenClaims }> {
  const claims = await verifyAccessToken(ctx, accessToken);
  const session = await ctx.sessions.get(claims.sid);
  if (!session) throw Errors.sessionExpired();
  if (session.revoked_at) throw Errors.sessionRevoked();
  return { session, claims };
}

export async function revokeSession(
  ctx: AuthContext,
  sessionId: string,
  reason = "user_revoked",
): Promise<void> {
  await ctx.sessions.revoke(sessionId, reason, ctx.now().toISOString());
}

export async function revokeAllOtherSessions(
  ctx: AuthContext,
  userId: string,
  keepSessionId: string | null,
  reason: string,
): Promise<number> {
  return ctx.sessions.revokeAllForUser(userId, keepSessionId, reason, ctx.now().toISOString());
}

/**
 * CSRF: classic double-submit. The cookie holds the CSRF token; the SPA
 * echoes it on mutating requests as `X-CSRF-Token`. We constant-time-compare.
 */
export function verifyCsrf(headerToken: string | undefined, cookieToken: string | undefined): void {
  if (!headerToken || !cookieToken) throw Errors.csrfInvalid();
  if (headerToken.length === 0 || cookieToken.length === 0) throw Errors.csrfInvalid();
  // length-checked constant-time compare
  const a = Buffer.from(headerToken);
  const b = Buffer.from(cookieToken);
  if (a.length !== b.length) throw Errors.csrfInvalid();
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined || bv === undefined) {
      throw Errors.csrfInvalid();
    }
    diff |= av ^ bv;
  }
  if (diff !== 0) throw Errors.csrfInvalid();
}

/**
 * Normalize the IP/UA hash from raw request context.
 */
export function deriveDeviceFingerprint(
  ctx: AuthContext,
  ip: string,
  userAgent: string | null | undefined,
): { ip_hash: string; user_agent_class: string | null } {
  return {
    ip_hash: hashIp(ip, ctx.env.ip_hash_salt),
    user_agent_class: classifyUserAgent(userAgent),
  };
}

export const COOKIE_NAMES = {
  ACCESS: ACCESS_COOKIE,
  REFRESH: REFRESH_COOKIE,
  CSRF: CSRF_COOKIE,
} as const;
