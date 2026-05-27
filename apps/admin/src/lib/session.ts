/**
 * Server-side admin session helpers.
 *
 * The admin app sits behind Google Workspace SSO + WebAuthn (per
 * @funnel/auth.completeAdminLogin). Every render and every server action
 * pulls the session through `getAdminSession()` which performs the gate:
 *
 *   1. Cookie present + verifies as a real session.
 *   2. User row has `is_internal=true` and `mfa_enrolled=true`.
 *   3. An active, non-revoked `admin_session_id` is bound to the JWT.
 *   4. A current `admin_role_grant` exists (not revoked).
 *
 * Anything missing -> redirect to /signin. We never throw to the client.
 *
 * This file is intentionally thin — the heavy lifting lives in
 * @funnel/auth.session and @funnel/auth.admin-roles. The point here is
 * to keep the gate uniform across every page/action in the admin app.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAMES,
  getAdminRole,
  verifyAccessToken,
  type AdminRole,
} from "@funnel/auth";
import { getAuthContext } from "./auth-context";

export interface AdminSession {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AdminRole;
  scopes: string[];
  admin_session_id: string;
  /** Hashed remote address — never the raw IP. */
  ip_hash: string;
  user_agent_class: string | null;
}

/**
 * Returns the current admin's session, or redirects to the SSO start page.
 * Use this at the top of every server component and server action.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const cookieStore = cookies();
  const access = cookieStore.get(COOKIE_NAMES.access)?.value;
  if (!access) redirect("/signin");

  const ctx = getAuthContext();
  let claims;
  try {
    claims = await verifyAccessToken(ctx, access);
  } catch {
    redirect("/signin");
  }
  if (!claims.admin_sid) redirect("/signin");

  const user = await ctx.users.findById(claims.sub);
  if (!user || !user.is_internal || !user.mfa_enrolled) redirect("/signin");

  const grant = await getAdminRole(ctx, claims.sub);
  if (!grant) redirect("/signin");

  const hdrs = headers();
  return {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name ?? null,
    role: grant.role,
    scopes: grant.scopes,
    admin_session_id: claims.admin_sid,
    ip_hash: hdrs.get("x-forwarded-for-hash") ?? "unknown",
    user_agent_class: hdrs.get("x-ua-class") ?? null,
  };
}

/**
 * Soft variant — for layouts that want to show "no session" UI rather than
 * redirect. Returns null instead of redirecting.
 */
export async function tryAdminSession(): Promise<AdminSession | null> {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}
