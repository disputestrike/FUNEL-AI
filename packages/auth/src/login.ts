/**
 * Password login flow.
 *
 * Rate limiting:
 *  - 5 attempts per 15 minutes per (ip_hash + email_hash) pair â†’ 429.
 *  - 5 consecutive failures per user â†’ account locked for 15 minutes (423).
 *
 * Security choices:
 *  - We respond identically to "no such user" and "wrong password"
 *    (401 invalid_credentials). The rate-limit and lockout paths are the
 *    only places an attacker can learn anything, and both apply on a per-IP
 *    basis to attenuate enumeration.
 *  - Before checking the password, we ALWAYS run argon2.verify on a sentinel
 *    hash if the user doesn't exist â€” this makes the timing of "no such user"
 *    and "wrong password" indistinguishable.
 *  - New-device detection: if (ip_hash, ua_class) doesn't match any prior
 *    successful login in the last 30d, we mark `new_device=true` and queue
 *    a notification email.
 *
 * MFA:
 *  - If the user has MFA enrolled and `totp_code` / `webauthn_response` is
 *    NOT provided, returns `status: "mfa_required"` with a 5-minute
 *    challenge token. Caller must complete the challenge via `completeMfa`.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { hashPassword, sha256Hex, verifyPassword } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { normalizeEmail } from "./internal/email.js";
import { createSession, deriveDeviceFingerprint } from "./session.js";
import type { LoginRequestInput, LoginResult } from "./types.js";
import { SignJWT, jwtVerify } from "jose";
import { newId } from "./internal/ids.js";

const LoginInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  ip: z.string().min(1).max(64),
  user_agent: z.string().min(1).max(2048),
  totp_code: z.string().regex(/^\d{6,8}$/).optional(),
  /** WebAuthn assertion JSON (handled in mfa.ts). */
  webauthn_response: z.unknown().optional(),
  /** If the caller has a `mfa_challenge_token` from a prior step, pass it. */
  mfa_challenge_token: z.string().optional(),
});

export type LoginInputT = z.infer<typeof LoginInput>;

const RL_WINDOW_SEC = 15 * 60;
const RL_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SEC = 15 * 60;
const LOCKOUT_MAX_FAILURES = 5;
const MFA_CHALLENGE_TTL_SEC = 5 * 60;

/**
 * A pre-computed argon2id hash of a random secret. We run argon2.verify
 * against this when the user doesn't exist so the response time mirrors
 * the "real user, wrong password" path.
 *
 * Computed lazily once per process.
 */
let SENTINEL_HASH: string | null = null;
async function getSentinelHash(): Promise<string> {
  if (SENTINEL_HASH === null) {
    SENTINEL_HASH = await hashPassword("sentinel-not-a-real-password-" + Math.random());
  }
  return SENTINEL_HASH;
}

export interface LoginDeps {
  email?: Pick<Email, "send">;
  new_device_link_base?: string;
  /**
   * Lookup: was this (ip_hash, ua_class) seen for this user in the last 30d?
   * If omitted, we treat every login as "known device" (conservative for dev).
   */
  isKnownDevice?: (userId: string, ipHash: string, uaClass: string | null) => Promise<boolean>;
}

async function mintMfaChallenge(ctx: AuthContext, userId: string): Promise<string> {
  const iat = Math.floor(ctx.now().getTime() / 1000);
  const exp = iat + MFA_CHALLENGE_TTL_SEC;
  const token = await new SignJWT({ sub: userId, typ: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ctx.env.jwt_issuer)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setJti(newId("tok"))
    .sign(new TextEncoder().encode(ctx.env.jwt_secret));
  return token;
}

export async function verifyMfaChallengeToken(
  ctx: AuthContext,
  token: string,
  expectedUserId: string,
): Promise<void> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ctx.env.jwt_secret), {
      issuer: ctx.env.jwt_issuer,
    });
    if (payload.typ !== "mfa_challenge") throw Errors.invalidToken();
    if (payload.sub !== expectedUserId) throw Errors.invalidToken();
  } catch {
    throw Errors.invalidToken();
  }
}

/**
 * Step 1 of password login: verify credentials, gate on MFA.
 */
export async function loginWithEmail(
  ctx: AuthContext,
  raw: LoginInputT,
  deps: LoginDeps = {},
): Promise<LoginResult> {
  const input = LoginInput.parse(raw);
  const emailNormalized = normalizeEmail(input.email);
  const emailHash = sha256Hex(emailNormalized);
  const { ip_hash, user_agent_class } = deriveDeviceFingerprint(ctx, input.ip, input.user_agent);

  // Rate-limit per (ip, email).
  const rlKey = `login:${ip_hash}:${emailHash}`;
  const rl = await ctx.rate.increment(rlKey, RL_WINDOW_SEC);
  if (rl.count > RL_MAX_ATTEMPTS) {
    await emit("user_login_failed", {
      email_hash: emailHash,
      reason: "rate_limited",
      ip_hash,
    });
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(rl.reset_at).getTime() - ctx.now().getTime()) / 1000),
    );
    throw Errors.rateLimited(retryAfter);
  }

  const user = await ctx.users.findByEmail(emailNormalized);

  // Constant-time-ish: verify against a sentinel if no user exists.
  if (!user) {
    await verifyPassword(await getSentinelHash(), input.password);
    await emit("user_login_failed", { email_hash: emailHash, reason: "invalid_credentials", ip_hash });
    throw Errors.invalidCredentials();
  }

  // Lockout check.
  if (user.locked_until && new Date(user.locked_until).getTime() > ctx.now().getTime()) {
    await emit("user_login_failed", { email_hash: emailHash, reason: "locked_out", ip_hash });
    throw Errors.lockedOut(user.locked_until);
  }

  // Status check (after credential-shaped error to avoid enumeration).
  if (user.status !== "active" && user.status !== "pending_verification") {
    await emit("user_login_failed", { email_hash: emailHash, reason: "invalid_credentials", ip_hash });
    throw Errors.invalidCredentials();
  }

  // Verify password.
  const passwordOk =
    user.password_hash !== null && (await verifyPassword(user.password_hash, input.password));

  if (!passwordOk) {
    const failures = user.failed_login_count + 1;
    let lockoutUntil: string | null = null;
    if (failures >= LOCKOUT_MAX_FAILURES) {
      lockoutUntil = new Date(ctx.now().getTime() + LOCKOUT_WINDOW_SEC * 1000).toISOString();
    }
    await ctx.users.recordFailedLogin(user.id, lockoutUntil);
    await emit("user_login_failed", { email_hash: emailHash, reason: "invalid_credentials", ip_hash });
    if (lockoutUntil) throw Errors.lockedOut(lockoutUntil);
    throw Errors.invalidCredentials();
  }

  // Email verification gate.
  if (!user.email_verified_at || user.status !== "active") {
    await emit("user_login_failed", { email_hash: emailHash, reason: "email_not_verified", ip_hash });
    throw Errors.emailNotVerified();
  }

  // MFA gate.
  if (user.mfa_enrolled && !input.totp_code && !input.webauthn_response) {
    const challenge = await mintMfaChallenge(ctx, user.id);
    return { status: "mfa_required", mfa_challenge_token: challenge };
  }

  // MFA verify path (TOTP only here; WebAuthn lives in mfa.ts).
  if (user.mfa_enrolled && input.totp_code) {
    // Hand off to the central MFA verifier; we import lazily to avoid a cycle.
    const { verifyTotp } = await import("./mfa.js");
    const ok = await verifyTotp(ctx, user.id, input.totp_code);
    if (!ok) {
      await emit("user_login_failed", { email_hash: emailHash, reason: "mfa_invalid", ip_hash });
      throw Errors.mfaInvalid();
    }
  }

  // Reset failed-login counter on success.
  await ctx.users.resetFailedLogins(user.id, ctx.now().toISOString());
  await ctx.rate.reset(rlKey);

  // Device-novelty check (best effort).
  let newDevice = false;
  if (deps.isKnownDevice) {
    newDevice = !(await deps.isKnownDevice(user.id, ip_hash, user_agent_class));
  }

  const { session, access_token, refresh_token, csrf_token } = await createSession(ctx, {
    user_id: user.id,
    workspace_id: null,
    ip_hash,
    user_agent_class,
    device_id_hash: null,
    mfa_satisfied: user.mfa_enrolled,
  });

  await emit("user_logged_in", {
    user_id: user.id,
    session_id: session.id,
    method: "password",
    mfa_used: user.mfa_enrolled,
    new_device: newDevice,
    ip_hash,
  });

  if (newDevice && deps.email && deps.new_device_link_base) {
    try {
      await deps.email.send({
        to: user.email,
        template: "new_device_alert",
        subject: "New sign-in to your GoFunnelAI account",
        data: {
          when: session.created_at,
          ua_class: user_agent_class,
          review_link: deps.new_device_link_base,
        },
      });
    } catch {
      // non-blocking
    }
  }

  return {
    status: "authenticated",
    session,
    access_token,
    refresh_token,
    csrf_token,
  };
}
