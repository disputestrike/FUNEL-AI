/**
 * GET    /api/domains/[id]    — fetch a single custom domain (with status)
 * DELETE /api/domains/[id]    — soft-remove a custom domain
 *
 * Auth: session cookie (Clerk) + the domain must belong to the workspace.
 */
import { NextResponse } from "next/server";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.findFirst({
      where: { id: params.id, deleted_at: null },
    })
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    hostname: row.hostname,
    status: row.status,
    ssl_status: row.ssl_status,
    verification_token: row.verification_token,
    verified_at: row.verified_at,
    activated_at: row.activated_at,
    failure_reason: row.failure_reason,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await withWorkspaceContext(session.workspace.id, async (tx) => {
    const existing = await tx.customDomain.findFirst({
      where: { id: params.id, deleted_at: null },
    });
    if (!existing) return null;

    await tx.customDomain.update({
      where: { id: params.id },
      data: {
        status: "removed",
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { id: existing.id, hostname: existing.hostname };
  });

  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Best-effort: ask apps/api to detach the Cloudflare for SaaS custom hostname.
  await detachCloudflareHostname(result.hostname).catch(() => undefined);

  return NextResponse.json({ ok: true, id: result.id });
}

async function detachCloudflareHostname(hostname: string): Promise<void> {
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.INTERNAL_INGEST_SECRET;
  if (!apiBase || !secret) return;
  await fetch(`${apiBase.replace(/\/+$/, "")}/internal/custom-domains/detach`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ hostname }),
  }).catch(() => undefined);
}
