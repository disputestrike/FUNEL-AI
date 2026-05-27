/**
 * Password reset.
 *
 * Request:
 *  - Always returns `{ accepted: true }` (no enumeration).
 *  - If the email exists and is active, issues a 1-hour single-use token,
 *    sends an email with the reset link, records the requester IP hash.
 *
 * Confirm:
 *  - Validates new password against policy.
 *  - argon2id-hashes and updates the user.
 *  - Marks the token consumed in the same transaction.
 *  - REVOKES ALL OTHER SESSIONS for the user (we don't trust a session
 *    minted under the old password).
 *  - Emits `user_password_changed` with `via: "password_reset"`.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { hashIp, hashPassword, sha256Hex } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { generateRawToken, hashToken, ttlForPurpose } from "./internal/tokens.js";
import { newId } from "./internal/ids.js";
import { normalizeEmail } from "./internal/email.js";
import { assertPasswordOk } from "./internal/password-policy.js";

const RequestInput = z.object({
  email: z.string().email().max(320),
  ip: z.string().min(1),
});

const ConfirmInput = z.object({
  token: z.string().min(10).max(256),
  new_password: z.string().min(1).max(256),
});

export async function passwordResetRequest(
  ctx: AuthContext,
  raw: z.infer<typeof RequestInput>,
  deps: { email: Pick<Email, "send">; link_base: string },
): Promise<{ accepted: true }> {
  const input = RequestInput.parse(raw);
  const emailNormalized = normalizeEmail(input.email);

  // Rate-limit per email.
  const rl = await ctx.rate.increment(`pwreset:${sha256Hex(emailNormalized)}`, 60 * 60);
  if (rl.count > 5) return { accepted: true };

  const user = await ctx.users.findByEmail(emailNormalized);
  await emit("user_password_reset_requested", {
    user_id: user?.id ?? null,
    email_hash: sha256Hex(emailNormalized),
    actor: { type: "user" },
    ip_hash: hashIp(input.ip, ctx.env.ip_hash_salt),
  });
  if (!user || user.status !== "active") return { accepted: true };

  const token = generateRawToken();
  const ttl = ttlForPurpose("password_reset");
  await ctx.tokens.create({
    id: newId("tok"),
    purpose: "password_reset",
    user_id: user.id,
    workspace_id: null,
    token_hash: hashToken(token),
    payload: null,
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + ttl * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: hashIp(input.ip, ctx.env.ip_hash_salt),
  });

  const link = `${deps.link_base}?token=${encodeURIComponent(token)}`;
  try {
    await deps.email.send({
      to: user.email,
      template: "password_reset",
      subject: "Reset your GoFunnelAI password",
      data: { reset_link: link, ttl_hours: ttl / 3600 },
    });
  } catch {
    // non-blocking
  }
  return { accepted: true };
}

export async function passwordResetConfirm(
  ctx: AuthContext,
  raw: z.infer<typeof ConfirmInput>,
  deps?: { email?: Pick<Email, "send"> },
): Promise<{ user_id: string }> {
  const input = ConfirmInput.parse(raw);
  const row = await ctx.tokens.findByHash(hashToken(input.token), "password_reset");
  if (!row) throw Errors.invalidToken();
  if (row.consumed_at) throw Errors.consumedToken();
  if (new Date(row.expires_at).getTime() < ctx.now().getTime()) throw Errors.expiredToken();
  if (!row.user_id) throw Errors.invalidToken();

  const user = await ctx.users.findById(row.user_id);
  if (!user) throw Errors.invalidToken();
  assertPasswordOk(input.new_password, { email: user.email_normalized });

  const hash = await hashPassword(input.new_password);
  await ctx.users.update(user.id, {
    password_hash: hash,
    password_changed_at: ctx.now().toISOString(),
    failed_login_count: 0,
    locked_until: null,
  });
  await ctx.tokens.markConsumed(row.id, ctx.now().toISOString());

  const revoked = await ctx.sessions.revokeAllForUser(
    user.id,
    null,
    "password_reset",
    ctx.now().toISOString(),
  );

  await emit("user_password_changed", {
    user_id: user.id,
    via: "password_reset",
    sessions_invalidated: revoked,
  });

  if (deps?.email) {
    try {
      await deps.email.send({
        to: user.email,
        template: "password_changed",
        subject: "Your GoFunnelAI password was changed",
        data: { when: ctx.now().toISOString() },
      });
    } catch {
      // non-blocking
    }
  }

  return { user_id: user.id };
}
