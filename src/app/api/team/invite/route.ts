/**
 * POST /api/team/invite — invite an email to the current workspace.
 *
 * Owners and admins only. Creates a pending WorkspaceMember row with a
 * `joinedAt = null` flag and queues an invite email via @funnel/email.
 * The actual accept-link page is at /settings/team/accept?token=... (not
 * yet wired — the row is what unblocks the seat count).
 */
import { NextResponse } from "next/server";
import { withWorkspaceContext, newId, WorkspaceRole } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Record<string, WorkspaceRole> = {
  admin: WorkspaceRole.admin,
  editor: WorkspaceRole.editor,
  analyst: WorkspaceRole.analyst,
  viewer: WorkspaceRole.viewer,
  billing: WorkspaceRole.billing,
};

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (
    session.workspaces[0]?.role !== "owner" &&
    session.workspaces[0]?.role !== "admin"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const rawEmail = String(form.get("email") ?? "").trim().toLowerCase();
  const role = ALLOWED[String(form.get("role") ?? "editor")] ?? WorkspaceRole.editor;
  if (!rawEmail || !rawEmail.includes("@")) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }

  await withWorkspaceContext(session.workspace.id, async (tx) => {
    // If they already exist as a User, attach directly; otherwise create a
    // placeholder User row so the invite can resolve to a stable id.
    let user = await tx.user.findFirst({
      where: { emailNormalized: rawEmail },
    });
    if (!user) {
      user = await tx.user.create({
        data: {
          id: newId("user"),
          email: rawEmail,
          emailNormalized: rawEmail,
        },
      });
    }

    const existing = await tx.workspaceMember.findFirst({
      where: { workspaceId: session.workspace.id, userId: user.id, removedAt: null },
    });
    if (existing) return; // idempotent

    await tx.workspaceMember.create({
      data: {
        id: newId("workspaceMember"),
        workspaceId: session.workspace.id,
        userId: user.id,
        role,
        invitedBy: session.user.id,
        invitedAt: new Date(),
      },
    });
  });

  return NextResponse.redirect(new URL("/settings/team", req.url), {
    status: 303,
  });
}
