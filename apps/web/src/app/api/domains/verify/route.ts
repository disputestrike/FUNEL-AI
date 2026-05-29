/**
 * POST /api/domains/verify   { domain }
 *
 * Convenience wrapper used by the LaunchClient — looks up the workspace's
 * custom domain row by hostname and delegates to
 * `/api/domains/[id]/verify`. Returns the same shape.
 *
 * Auth: session cookie (Clerk).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .transform((s) => s.toLowerCase().trim()),
});

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const hostname = parsed.data.domain;

  const row = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.findFirst({
      where: { hostname, deleted_at: null },
    })
  );
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "domain_not_found", failure_reason: "Add the domain first." },
      { status: 404 }
    );
  }

  // Re-issue the request against the canonical [id] endpoint by forwarding
  // the URL — preserves cookies & session.
  const targetUrl = new URL(req.url);
  targetUrl.pathname = `/api/domains/${row.id}/verify`;
  // Internal fetch keeps the cookie context.
  const cookies = req.headers.get("cookie") ?? "";
  const inner = await fetch(targetUrl.toString(), {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: "{}",
  });
  const text = await inner.text();
  return new Response(text, {
    status: inner.status,
    headers: { "content-type": inner.headers.get("content-type") ?? "application/json" },
  });
}
