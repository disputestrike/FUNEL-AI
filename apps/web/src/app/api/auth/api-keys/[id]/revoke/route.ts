import { NextResponse } from "next/server";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/api-keys/:id/revoke — soft-revoke a key by stamping
 * `revoked_at`. RLS guarantees the key belongs to the caller's workspace.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
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

  await withWorkspaceContext(session.workspace.id, async (tx) => {
    await tx.apiKey.updateMany({
      where: { id: params.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: session.user.id },
    });
  });

  return NextResponse.redirect(new URL("/settings/api-keys", req.url), {
    status: 303,
  });
}
