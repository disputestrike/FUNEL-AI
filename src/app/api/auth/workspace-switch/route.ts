/**
 * POST /api/auth/workspace-switch — sets the active workspace cookie.
 *
 * The cookie is read by `getCurrentSession()` to pick which workspace's
 * RLS context to bind for the request. The route validates that the user
 * actually belongs to the target workspace before flipping the cookie.
 */
import { NextResponse } from "next/server";
import { withAdminContext } from "@funnel/db";
import { getCurrentSession, WORKSPACE_COOKIE } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const form = await req.formData();
  const target = String(form.get("workspace_id") ?? "");
  if (!target) {
    return NextResponse.json({ error: "missing_workspace_id" }, { status: 400 });
  }

  const membership = await withAdminContext((tx) =>
    tx.workspaceMember.findFirst({
      where: {
        workspaceId: target,
        userId: session.user.id,
        removedAt: null,
      },
    }),
  );
  if (!membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const back = String(form.get("redirect") ?? "/dashboard");
  const res = NextResponse.redirect(new URL(back, req.url), { status: 303 });
  res.cookies.set(WORKSPACE_COOKIE, target, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
