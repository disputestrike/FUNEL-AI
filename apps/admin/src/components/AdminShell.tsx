/**
 * Top-level admin chrome.
 *
 *  - Red "ADMIN ” restricted" stripe across the top (always visible).
 *  - Impersonation banner immediately below (only when a session is live).
 *  - Left sidebar with the full navigation tree.
 *  - Role badge with the operator's email + role.
 *
 * If no session is present this still renders the chrome but the body
 * is replaced with a sign-in prompt. Individual pages call
 * `requireAdminSession()` which redirects, so the unsigned state is
 * only ever the bare /signin page itself.
 */

import Link from "next/link";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { Sidebar } from "./Sidebar";
import type { AdminSession } from "@/lib/session";

const ROLE_COLOR: Record<string, string> = {
  super_admin: "bg-error-600 text-white",
  engineering: "bg-info-600 text-white",
  billing_admin: "bg-warning-500 text-slate-900",
  support: "bg-aqua-500 text-slate-900",
  read_only: "bg-slate-400 text-white",
};

export function AdminShell({
  session,
  impersonationId,
  children,
}: {
  session: AdminSession | null;
  impersonationId: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top admin bar ” never hidden, even on the sign-in page */}
      <div className="admin-bar flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-3">
          <span className="font-mono uppercase tracking-wider text-caption">
            GoFunnelAI Admin
          </span>
          <span className="text-caption opacity-90">
            Restricted ” staff only. Every action is logged.
          </span>
        </div>
        {session ? (
          <div className="flex items-center gap-2 text-caption">
            <span className="font-mono">{session.email}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono uppercase tracking-wider ${
                ROLE_COLOR[session.role] ?? "bg-slate-400 text-white"
              }`}
            >
              {session.role}
            </span>
            <Link
              href="/signout"
              className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
            >
              Sign out
            </Link>
          </div>
        ) : (
          <span className="text-caption">Not signed in</span>
        )}
      </div>

      {impersonationId ? (
        <ImpersonationBanner impersonationId={impersonationId} />
      ) : null}

      <div className="flex flex-1">
        {session ? <Sidebar role={session.role} /> : null}
        <main id="main" className="flex-1 overflow-x-hidden p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
