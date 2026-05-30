/**
 * Signup flow.
 *
 * 1. Validate email + password (zod + password-policy).
 * 2. If a row already exists at `email_normalized`, return `email_already_in_use`
 *    UNLESS the existing row is in `pending_verification` and older than 1h —
 *    in that case we re-issue a verification email but keep the row.
 * 3. argon2id-hash the password.
 * 4. Insert the user row in `pending_verification`.
 * 5. Issue a single-use verification token (24h TTL).
 * 6. Queue the verification email through @funnel/email.
 * 7. Emit `user_signed_up`.
 *
 * IMPORTANT: We do NOT log in the user at this step. They must verify their
 * email first. This is a deliberate trade-off — slightly more friction in
 * exchange for a clean signal that bots can't easily fake.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { hashPassword, sha256Hex } from "./internal/hash.js";
import { newId } from "./internal/ids.js";
import type { AuthContext } from "./internal/ports.js";
import { generateRawToken, hashToken, ttlForPurpose } from "./internal/tokens.js";
import { normalizeEmail } from "./internal/email.js";
import { assertPasswordOk } from "./internal/password-policy.js";
import type { SignupResult } from "./types.js";

const SignupInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  full_name: z.string().trim().min(1).max(120).optional(),
  /** Optional invite token — auto-binds the signup to a workspace invite. */
  invite_token: z.string().min(1).max(256).optional(),
});

export type SignupInputT = z.infer<typeof SignupInput>;

export interface SignupDeps {
  email: Pick<Email, "send">;
  verification_link_base: string;
}

export async function signupWithEmail(
  ctx: AuthContext,
  raw: SignupInputT,
  deps: SignupDeps,
): Promise<SignupResult> {
  const input = SignupInput.parse(raw);
  const emailNormalized = normalizeEmail(input.email);
  assertPasswordOk(input.password, { email: emailNormalized });

  const existing = await ctx.users.findByEmail(emailNormalized);
  if (existing && existing.status !== "pending_verification") {
    throw Errors.emailInUse();
  }

  const userId = existing?.id ?? newId("usr");
  const passwordHash = await hashPassword(input.password);

  if (!existing) {
    await ctx.users.create({
      id: userId,
      email: input.email,
      email_normalized: emailNormalized,
      password_hash: passwordHash,
      full_name: input.full_name ?? null,
    });
  } else {
    // Re-roll the password hash so we don't keep stale credentials.
    await ctx.users.update(existing.id, { password_hash: passwordHash });
  }

  const rawToken = generateRawToken();
  const ttl = ttlForPurpose("email_verify");
  const now = ctx.now();
  const tokenId = newId("tok");
  await ctx.tokens.create({
    id: tokenId,
    purpose: "email_verify",
    user_id: userId,
    workspace_id: null,
    token_hash: hashToken(rawToken),
    payload: input.invite_token ? { invite_token_hash: sha256Hex(input.invite_token) } : null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttl * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });

  const link = `${deps.verification_link_base}?token=${encodeURIComponent(rawToken)}`;
  let queued = true;
  try {
    await deps.email.send({
      to: input.email,
      template: "verify_email",
      subject: "Verify your GoFunnelAI email",
      data: { verify_link: link, ttl_hours: Math.round(ttl / 3600) },
    });
  } catch {
    // We do NOT fail the signup if email queuing fails — we expose `resend`.
    queued = false;
  }

  await emit("user_signed_up", {
    user_id: userId,
    email_domain: emailNormalized.split("@")[1] ?? "",
    email_hash: sha256Hex(emailNormalized),
    source: "email",
  });

  return {
    user_id: userId,
    email: input.email,
    verification_required: true,
    verification_email_queued: queued,
  };
}

/**
 * Re-issue a verification email. Idempotent against the user row, rate-limited
 * by caller (typically once per minute per email).
 */
export async function resendVerification(
  ctx: AuthContext,
  emailRaw: string,
  deps: SignupDeps,
): Promise<{ sent: boolean }> {
  const emailNormalized = normalizeEmail(emailRaw);
  const user = await ctx.users.findByEmail(emailNormalized);
  // Always return `sent:true` to the outside world (don't leak whether the
  // address is registered). The caller can use that consistently.
  if (!user || user.status !== "pending_verification") return { sent: true };

  const rawToken = generateRawToken();
  const ttl = ttlForPurpose("email_verify");
  const now = ctx.now();
  await ctx.tokens.create({
    id: newId("tok"),
    purpose: "email_verify",
    user_id: user.id,
    workspace_id: null,
    token_hash: hashToken(rawToken),
    payload: null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttl * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });

  const link = `${deps.verification_link_base}?token=${encodeURIComponent(rawToken)}`;
  try {
    await deps.email.send({
      to: user.email,
      template: "verify_email",
      subject: "Verify your GoFunnelAI email",
      data: { verify_link: link, ttl_hours: Math.round(ttl / 3600) },
    });
  } catch {
    return { sent: false };
  }
  return { sent: true };
}
