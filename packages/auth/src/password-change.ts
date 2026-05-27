/**
 * Authenticated password change.
 *
 * Requires:
 *  - the current password (re-verified server-side)
 *  - a logged-in session
 *
 * On success:
 *  - hash + persist new password
 *  - revoke ALL OTHER sessions (the one making the change is kept)
 *  - emit `user_password_changed` { via: "self" }
 *  - notify the user via email
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { hashPassword, verifyPassword } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { assertPasswordOk } from "./internal/password-policy.js";

const Input = z.object({
  user_id: z.string().min(1),
  current_password: z.string().min(1).max(256),
  new_password: z.string().min(1).max(256),
  current_session_id: z.string().min(1),
});

export async function changePassword(
  ctx: AuthContext,
  raw: z.infer<typeof Input>,
  deps?: { email?: Pick<Email, "send"> },
): Promise<{ sessions_invalidated: number }> {
  const input = Input.parse(raw);
  const user = await ctx.users.findById(input.user_id);
  if (!user || !user.password_hash) throw Errors.invalidCredentials();
  if (!(await verifyPassword(user.password_hash, input.current_password))) {
    throw Errors.invalidCredentials();
  }
  if (input.new_password === input.current_password) {
    throw Errors.weakPassword("New password must be different from the current password.");
  }
  assertPasswordOk(input.new_password, { email: user.email_normalized });

  const newHash = await hashPassword(input.new_password);
  await ctx.users.update(user.id, {
    password_hash: newHash,
    password_changed_at: ctx.now().toISOString(),
  });

  const invalidated = await ctx.sessions.revokeAllForUser(
    user.id,
    input.current_session_id,
    "password_changed",
    ctx.now().toISOString(),
  );

  await emit("user_password_changed", {
    user_id: user.id,
    via: "self",
    sessions_invalidated: invalidated,
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

  return { sessions_invalidated: invalidated };
}
