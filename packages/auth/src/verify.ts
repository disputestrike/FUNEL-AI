/**
 * Email verification.
 *
 * Consumes a single-use token, transitions the user from
 * `pending_verification` → `active`, and stamps `email_verified_at`.
 *
 * The token row is marked consumed in the SAME logical transaction
 * (the SingleUseTokenStore implementation is responsible for atomicity).
 */

import { emit } from "@funnel/events";
import { Errors } from "./errors.js";
import { sha256Hex } from "./internal/hash.js";
import { hashToken } from "./internal/tokens.js";
import type { AuthContext } from "./internal/ports.js";

export async function verifyEmail(
  ctx: AuthContext,
  rawToken: string,
): Promise<{ user_id: string; was_already_verified: boolean }> {
  if (!rawToken || rawToken.length < 8) throw Errors.invalidToken();

  const row = await ctx.tokens.findByHash(hashToken(rawToken), "email_verify");
  if (!row) throw Errors.invalidToken();
  if (row.consumed_at) throw Errors.consumedToken();
  const now = ctx.now();
  if (new Date(row.expires_at).getTime() < now.getTime()) throw Errors.expiredToken();
  if (!row.user_id) throw Errors.invalidToken();

  const user = await ctx.users.findById(row.user_id);
  if (!user) throw Errors.invalidToken();

  const wasAlready = user.email_verified_at !== null && user.status === "active";

  if (!wasAlready) {
    await ctx.users.update(user.id, {
      email_verified_at: now.toISOString(),
      status: "active",
    });
    await emit("user_email_verified", {
      user_id: user.id,
      email_hash: sha256Hex(user.email_normalized),
    });
  }

  await ctx.tokens.markConsumed(row.id, now.toISOString());

  return { user_id: user.id, was_already_verified: wasAlready };
}
