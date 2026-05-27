/**
 * Impersonation start/end — wraps @funnel/auth.startImpersonation /
 * endImpersonation with the admin-app gates:
 *
 *  - Reason min 20 chars (auth lib also enforces, we duplicate for the
 *    UI so we don't bother the lib with bad input).
 *  - Ticket id required (Linear/Plain/Pylon).
 *  - 30-minute soft cap (auth lib caps at 60 min hard; we enforce 30 by
 *    default for visibility), refreshable with new reason.
 *  - On start, a cookie is set so the impersonation banner shows.
 *  - On end, both the impersonated session and the cookie are cleared.
 *
 * The actual session token issuance happens in @funnel/auth. This file is
 * the admin-app's policy wrapper around it.
 */

import { cookies } from "next/headers";
import {
  endImpersonation as _endImpersonation,
  startImpersonation as _startImpersonation,
} from "@funnel/auth";
import { getAuthContext } from "./auth-context";
import type { AdminSession } from "./session";

const IMPERSONATION_COOKIE = "fa_imp";
export const IMPERSONATION_SOFT_CAP_SEC = 30 * 60;
const HIGH_RISK_REASON_HINTS = [
  "billing",
  "refund",
  "owner",
  "delete",
  "export",
  "transfer",
];

export interface BeginImpersonationArgs {
  session: AdminSession;
  target_user_id: string;
  workspace_id: string;
  reason: string;
  ticket_id: string;
  /** Optional co-signer for high-risk targets. */
  cosigner_user_id?: string;
  high_risk?: boolean;
}

export async function beginImpersonation(args: BeginImpersonationArgs) {
  if (!args.reason || args.reason.trim().length < 20) {
    throw new Error("Impersonation reason must be at least 20 characters.");
  }
  if (!args.ticket_id || args.ticket_id.trim().length === 0) {
    throw new Error("Impersonation requires a ticket id (Linear/Plain/Pylon).");
  }
  const inferHighRisk =
    args.high_risk ??
    HIGH_RISK_REASON_HINTS.some((kw) =>
      args.reason.toLowerCase().includes(kw),
    );

  const ctx = getAuthContext();
  const result = await _startImpersonation(ctx, {
    admin_user_id: args.session.user_id,
    target_user_id: args.target_user_id,
    workspace_id: args.workspace_id,
    justification: args.reason.trim(),
    justification_ticket_id: args.ticket_id.trim(),
    cosigner_user_id: args.cosigner_user_id,
    high_risk: inferHighRisk,
    ip_hash: args.session.ip_hash,
    user_agent_class: args.session.user_agent_class,
  });

  // Banner cookie — readable by both apps so the customer-facing UI shows
  // the red bar to the impersonated user.
  cookies().set(IMPERSONATION_COOKIE, result.impersonation_id, {
    httpOnly: false, // banner JS in web/ reads it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_SOFT_CAP_SEC,
  });

  return result;
}

export interface EndImpersonationArgs {
  session: AdminSession;
  impersonation_id: string;
  target_user_id: string;
  workspace_id: string;
  session_id: string;
  ended_reason?: "self" | "expired" | "force_terminated" | "dsar";
  actions_summary?: string[];
}

export async function endImpersonationFlow(args: EndImpersonationArgs) {
  const ctx = getAuthContext();
  await _endImpersonation(ctx, {
    impersonation_id: args.impersonation_id,
    admin_user_id: args.session.user_id,
    target_user_id: args.target_user_id,
    workspace_id: args.workspace_id,
    session_id: args.session_id,
    ended_reason: args.ended_reason ?? "self",
    actions_summary: args.actions_summary ?? [],
  });
  cookies().delete(IMPERSONATION_COOKIE);
}

/** Server-side helper: is an impersonation cookie currently set? */
export function readImpersonationId(): string | null {
  return cookies().get(IMPERSONATION_COOKIE)?.value ?? null;
}
