/**
 * Email-change flow.
 *
 * Two-step (this is the standard pattern for sensitive identity changes):
 *
 *  1. `emailChangeRequest(user_id, new_email, current_password)` â†’
 *     verifies password, checks the new email isn't already taken,
 *     issues a 24-hour single-use token sent to the NEW address.
 *  2. `emailChangeConfirm(token)` â†’ swaps the email atomically, marks
 *     `email_verified_at` to the new timestamp, sends a notification
 *     to the OLD address ("your email was changed"), and revokes other
 *     sessions.
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { sha256Hex, verifyPassword } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { generateRawToken, hashToken, ttlForPurpose } from "./internal/tokens.js";
import { newId } from "./internal/ids.js";
import { normalizeEmail } from "./internal/email.js";

const RequestInput = z.object({
  user_id: z.string().min(1),
  new_email: z.string().email().max(320),
  current_password: z.string().min(1).max(256),
});

export async function emailChangeRequest(
  ctx: AuthContext,
  raw: z.infer<typeof RequestInput>,
  deps: { email: Pick<Email, "send">; verify_link_base: string },
): Promise<{ pending: true }> {
  const input = RequestInput.parse(raw);
  const newEmailNormalized = normalizeEmail(input.new_email);

  const user = await ctx.users.findById(input.user_id);
  if (!user || !user.password_hash) throw Errors.invalidCredentials();
  if (!(await verifyPassword(user.password_hash, input.current_password))) {
    throw Errors.invalidCredentials();
  }
  if (newEmailNormalized === user.email_normalized) {
    throw Errors.weakPassword("New email is the same as the current one.");
  }

  const conflict = await ctx.users.findByEmail(newEmailNormalized);
  if (conflict && conflict.id !== user.id) throw Errors.emailInUse();

  const token = generateRawToken();
  const ttl = ttlForPurpose("email_change");
  await ctx.tokens.create({
    id: newId("tok"),
    purpose: "email_change",
    user_id: user.id,
    workspace_id: null,
    token_hash: hashToken(token),
    payload: { new_email: input.new_email, new_email_normalized: newEmailNormalized },
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + ttl * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });

  const link = `${deps.verify_link_base}?token=${encodeURIComponent(token)}`;
  try {
    await deps.email.send({
      to: input.new_email,
      template: "email_change_verify",
      subject: "Verify your new GoFunnelAI email",
      data: { verify_link: link, ttl_hours: ttl / 3600 },
    });
  } catch {
    // non-blocking
  }
  return { pending: true };
}

const ConfirmInput = z.object({
  token: z.string().min(10).max(256),
});

export async function emailChangeConfirm(
  ctx: AuthContext,
  raw: z.infer<typeof ConfirmInput>,
  deps?: { email?: Pick<Email, "send"> },
): Promise<{ user_id: string; new_email: string }> {
  const input = ConfirmInput.parse(raw);
  const row = await ctx.tokens.findByHash(hashToken(input.token), "email_change");
  if (!row) throw Errors.invalidToken();
  if (row.consumed_at) throw Errors.consumedToken();
  if (new Date(row.expires_at).getTime() < ctx.now().getTime()) throw Errors.expiredToken();
  if (!row.user_id || !row.payload) throw Errors.invalidToken();

  const user = await ctx.users.findById(row.user_id);
  if (!user) throw Errors.invalidToken();
  const newEmail = (row.payload as { new_email: string }).new_email;
  const newEmailNormalized = (row.payload as { new_email_normalized: string }).new_email_normalized;

  // Last-moment conflict check (someone else may have grabbed the address).
  const conflict = await ctx.users.findByEmail(newEmailNormalized);
  if (conflict && conflict.id !== user.id) throw Errors.emailInUse();

  const oldEmail = user.email;
  await ctx.users.update(user.id, {
    email: newEmail,
    email_normalized: newEmailNormalized,
    email_verified_at: ctx.now().toISOString(),
  });
  await ctx.tokens.markConsumed(row.id, ctx.now().toISOString());

  await ctx.sessions.revokeAllForUser(user.id, null, "email_changed", ctx.now().toISOString());

  await emit("user_email_verified", { user_id: user.id, email_hash: sha256Hex(newEmailNormalized) });

  if (deps?.email) {
    try {
      await deps.email.send({
        to: oldEmail,
        template: "email_changed",
        subject: "Your GoFunnelAI email was changed",
        data: { new_email: newEmail, when: ctx.now().toISOString() },
      });
    } catch {
      // non-blocking
    }
  }
  return { user_id: user.id, new_email: newEmail };
}
