/**
 * Magic-link login.
 *
 * `magicLinkRequest` issues a 15-minute single-use token, sends an email
 * with a sign-in link. `magicLinkVerify` consumes the token and mints
 * a full session â€” same shape as `loginWithEmail`.
 *
 * Like password reset, we ALWAYS return success to the caller whether or
 * not the address is registered (no enumeration). The email is only sent
 * if the user actually exists and is active.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { sha256Hex } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { generateRawToken, hashToken } from "./internal/tokens.js";
import { newId } from "./internal/ids.js";
import { normalizeEmail } from "./internal/email.js";
import { createSession, deriveDeviceFingerprint } from "./session.js";
import type { LoginResult } from "./types.js";

const MAGIC_TTL_SEC = 15 * 60;

export async function magicLinkRequest(
  ctx: AuthContext,
  emailRaw: string,
  ipRaw: string,
  uaRaw: string,
  deps: { email: Pick<Email, "send">; link_base: string },
): Promise<{ accepted: true }> {
  const emailNormalized = normalizeEmail(emailRaw);
  const { ip_hash } = deriveDeviceFingerprint(ctx, ipRaw, uaRaw);

  // Rate-limit: 5 per 15 minutes per email.
  const rl = await ctx.rate.increment(`magic:${sha256Hex(emailNormalized)}`, 15 * 60);
  if (rl.count > 5) {
    // Silently swallow further attempts beyond the limit; we still return 202.
    return { accepted: true };
  }

  const user = await ctx.users.findByEmail(emailNormalized);
  if (!user || user.status !== "active") return { accepted: true };

  const raw = generateRawToken();
  await ctx.tokens.create({
    id: newId("tok"),
    purpose: "magic_link",
    user_id: user.id,
    workspace_id: null,
    token_hash: hashToken(raw),
    payload: null,
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + MAGIC_TTL_SEC * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: ip_hash,
  });

  const link = `${deps.link_base}?token=${encodeURIComponent(raw)}`;
  try {
    await deps.email.send({
      to: user.email,
      template: "magic_link",
      subject: "Your GoFunnelAI sign-in link",
      data: { sign_in_link: link, ttl_minutes: MAGIC_TTL_SEC / 60 },
    });
  } catch {
    // non-blocking; the user can request another link.
  }
  return { accepted: true };
}

const VerifyInput = z.object({
  token: z.string().min(10).max(256),
  ip: z.string().min(1),
  user_agent: z.string().min(1),
});

export async function magicLinkVerify(
  ctx: AuthContext,
  raw: { token: string; ip: string; user_agent: string },
): Promise<LoginResult> {
  const input = VerifyInput.parse(raw);
  const row = await ctx.tokens.findByHash(hashToken(input.token), "magic_link");
  if (!row) throw Errors.invalidToken();
  if (row.consumed_at) throw Errors.consumedToken();
  if (new Date(row.expires_at).getTime() < ctx.now().getTime()) throw Errors.expiredToken();
  if (!row.user_id) throw Errors.invalidToken();

  const user = await ctx.users.findById(row.user_id);
  if (!user || user.status !== "active") throw Errors.invalidToken();

  await ctx.tokens.markConsumed(row.id, ctx.now().toISOString());

  const { ip_hash, user_agent_class } = deriveDeviceFingerprint(ctx, input.ip, input.user_agent);

  // Magic-link bypasses password MFA: caller must enforce MFA gate again if
  // the user has MFA. We do NOT auto-skip MFA â€” request the challenge.
  if (user.mfa_enrolled) {
    // We mint a challenge token; caller completes via TOTP/WebAuthn.
    // Reuse session create deferred; for parity with login, expose mfa_required.
    const { default: mintMfaChallenge } = await import("./internal/mfa-challenge.js");
    const challenge = await mintMfaChallenge(ctx, user.id);
    return { status: "mfa_required", mfa_challenge_token: challenge };
  }

  const { session, access_token, refresh_token, csrf_token } = await createSession(ctx, {
    user_id: user.id,
    workspace_id: null,
    ip_hash,
    user_agent_class,
    device_id_hash: null,
    mfa_satisfied: false,
  });

  await emit("user_logged_in", {
    user_id: user.id,
    session_id: session.id,
    method: "magic_link",
    mfa_used: false,
    new_device: false,
    ip_hash,
  });

  return { status: "authenticated", session, access_token, refresh_token, csrf_token };
}
