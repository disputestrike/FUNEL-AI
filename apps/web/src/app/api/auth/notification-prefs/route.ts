/**
 * POST /api/auth/notification-prefs — persists the channel × event matrix.
 *
 * Stored on `workspaces.feature_flags.notification_prefs` as a flat map of
 * `event.channel → boolean`. Read-side helpers in `@funnel/notifications`
 * consume the same shape.
 */
import { NextResponse } from "next/server";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const form = await req.formData();
  const prefs: Record<string, boolean> = {};
  for (const [key, value] of form.entries()) {
    if (key === "workspace_id") continue;
    if (typeof value !== "string") continue;
    prefs[key] = value === "on" || value === "true";
  }

  await withWorkspaceContext(session.workspace.id, async (tx) => {
    const current = await tx.workspace.findUniqueOrThrow({
      where: { id: session.workspace.id },
      select: { featureFlags: true },
    });
    const flags =
      (current.featureFlags as Record<string, unknown> | null) ?? {};
    await tx.workspace.update({
      where: { id: session.workspace.id },
      data: {
        featureFlags: { ...flags, notification_prefs: prefs },
      },
    });
  });

  return NextResponse.redirect(
    new URL("/settings/notifications?saved=1", req.url),
    { status: 303 },
  );
}
