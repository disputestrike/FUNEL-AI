/**
 * GET /api/publish/check-slug?slug=foo
 * Used by the launch form for live availability checking.
 */
import { NextResponse } from "next/server";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const RESERVED = new Set([
  "www", "app", "api", "admin", "auth", "edge", "assets", "static", "cdn",
  "mail", "smtp", "imap", "pop", "ftp", "ssh", "vpn",
  "status", "docs", "help", "support", "blog", "community", "partners",
  "grader", "grader-agents", "marketplace", "feed", "rss",
  "staging", "preview", "qa", "dev", "test",
]);

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").toLowerCase();
  if (!slug || !SLUG_RX.test(slug) || RESERVED.has(slug)) {
    return NextResponse.json({ available: false, owned_by_current_workspace: false, invalid: true });
  }
  const taken = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.publishedFunnel.findFirst({
      where: { slug, status: { not: "archived" } },
      select: { id: true, workspace_id: true },
    })
  );
  return NextResponse.json({
    available: !taken,
    owned_by_current_workspace: taken?.workspace_id === session.workspace.id,
  });
}
