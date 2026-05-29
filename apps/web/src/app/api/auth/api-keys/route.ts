/**
 * POST /api/auth/api-keys — generate a fresh API key for the current
 * workspace. Returns the raw key once (it will never be shown again).
 *
 * Storage:
 *   - `keyPrefix` = first 12 chars, displayed as a fingerprint.
 *   - `keyHash`   = SHA-256(rawKey + pepper). Pepper from env.
 */
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { withWorkspaceContext, newId } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const form = await req.formData().catch(() => null);
  const name =
    (form?.get("name") as string | null) ??
    `Key created ${new Date().toLocaleDateString()}`;

  const rawSecret = randomBytes(24).toString("base64url");
  const rawKey = `gf_live_${rawSecret}`;
  const prefix = rawKey.slice(0, 12);
  const pepper = process.env.API_KEY_PEPPER ?? "";
  const hash = createHash("sha256").update(rawKey + pepper).digest("hex");

  await withWorkspaceContext(session.workspace.id, async (tx) => {
    await tx.apiKey.create({
      data: {
        id: newId("apiKey"),
        workspaceId: session.workspace.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        createdBy: session.user.id,
      },
    });
  });

  // Bounce back to the page with the raw key — client surfaces it via toast.
  const back = new URL("/settings/api-keys", req.url);
  back.searchParams.set("new", rawKey);
  return NextResponse.redirect(back, { status: 303 });
}
