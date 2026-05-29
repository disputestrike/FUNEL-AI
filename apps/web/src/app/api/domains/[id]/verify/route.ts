/**
 * POST /api/domains/[id]/verify
 *
 * State machine:
 *   pending → verifying → ssl_provisioning → active
 *   (or → failed at any step)
 *
 * Steps:
 *   1. DNS TXT lookup for `_funnel-verify.<hostname>` — must match
 *      `verification_token`.
 *   2. On TXT match, mark `verifying` → call Cloudflare for SaaS (via apps/api
 *      internal bridge) to add the custom hostname. Cloudflare provisions the
 *      cert.
 *   3. Poll Cloudflare for SSL status. If `active`, flip status to `active`
 *      and `ssl_status: active`.
 *
 * The client side polls this endpoint; it returns the current row + the next
 * suggested poll delay.
 */
import { NextResponse } from "next/server";
import { withWorkspaceContext } from "@funnel/db";
import { resolveTxt } from "node:dns/promises";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APEX = "gofunnelai.com";
const EDGE = `edge.${APEX}`;

export async function POST(
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

  // Already done.
  if (row.status === "active" && row.ssl_status === "active") {
    return NextResponse.json({
      ok: true,
      status: row.status,
      ssl_status: row.ssl_status,
      poll_after_ms: 0,
    });
  }

  const hostname = row.hostname;
  const expectedToken = row.verification_token;

  // ------------------------------------------------------------------ Step 1
  // DNS TXT lookup. If we don't find the token, surface a friendly error.
  let txtFound = false;
  let txtRecords: string[][] = [];
  try {
    txtRecords = await resolveTxt(`_funnel-verify.${hostname}`);
    txtFound = txtRecords.some((parts) => parts.join("").trim() === expectedToken);
  } catch (err) {
    // NXDOMAIN / ENODATA / propagation lag — surface a soft "waiting" error.
    const code = (err as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ENOENT") {
      await withWorkspaceContext(session.workspace.id, async (tx) => {
        await tx.customDomain.update({
          where: { id: row.id },
          data: {
            status: "verifying",
            last_checked_at: new Date(),
            failure_reason: "DNS TXT record not yet visible. Propagation usually takes 5-30 minutes.",
            updated_at: new Date(),
          },
        });
      });
      return NextResponse.json(
        {
          ok: false,
          status: "verifying",
          ssl_status: row.ssl_status,
          failure_reason: "DNS TXT record not yet visible. Try again in a few minutes.",
          poll_after_ms: 30_000,
        },
        { status: 200 }
      );
    }
    // Other errors — record + 500.
    await withWorkspaceContext(session.workspace.id, async (tx) => {
      await tx.customDomain.update({
        where: { id: row.id },
        data: {
          last_checked_at: new Date(),
          failure_reason: String((err as Error).message ?? err),
          updated_at: new Date(),
        },
      });
    });
    return NextResponse.json(
      { ok: false, error: "dns_lookup_failed", message: String((err as Error).message ?? err) },
      { status: 502 }
    );
  }

  if (!txtFound) {
    await withWorkspaceContext(session.workspace.id, async (tx) => {
      await tx.customDomain.update({
        where: { id: row.id },
        data: {
          status: "verifying",
          last_checked_at: new Date(),
          failure_reason: "TXT record found but value did not match. Re-check the value in your DNS settings.",
          updated_at: new Date(),
        },
      });
    });
    return NextResponse.json(
      {
        ok: false,
        status: "verifying",
        ssl_status: row.ssl_status,
        failure_reason:
          "TXT record found but value did not match. Re-check the value in your DNS settings.",
        poll_after_ms: 30_000,
      },
      { status: 200 }
    );
  }

  // ------------------------------------------------------------------ Step 2
  // TXT verified — kick off Cloudflare for SaaS provisioning (idempotent).
  await withWorkspaceContext(session.workspace.id, async (tx) => {
    await tx.customDomain.update({
      where: { id: row.id },
      data: {
        status: "verified",
        verified_at: row.verified_at ?? new Date(),
        ssl_status: row.ssl_status === "active" ? "active" : "pending_validation",
        last_checked_at: new Date(),
        failure_reason: null,
        updated_at: new Date(),
      },
    });
  });

  const cfStatus = await provisionCloudflareHostname(hostname, row.cloudflare_hostname_id ?? null);

  // ------------------------------------------------------------------ Step 3
  // Reflect the Cloudflare-reported status into the DB.
  const sslActive = cfStatus.ssl_status === "active";
  const fullyActive = sslActive && cfStatus.status === "active";

  const updated = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.update({
      where: { id: row.id },
      data: {
        cloudflare_hostname_id: cfStatus.cloudflare_hostname_id ?? row.cloudflare_hostname_id,
        ssl_status: cfStatus.ssl_status,
        status: fullyActive ? "active" : "verified",
        activated_at: fullyActive ? row.activated_at ?? new Date() : row.activated_at,
        last_checked_at: new Date(),
        failure_reason: cfStatus.failure_reason ?? null,
        updated_at: new Date(),
      },
    })
  );

  return NextResponse.json({
    ok: true,
    status: updated.status,
    ssl_status: updated.ssl_status,
    activated_at: updated.activated_at,
    failure_reason: updated.failure_reason,
    poll_after_ms: fullyActive ? 0 : 15_000,
    edge_target: EDGE,
  });
}

/**
 * Talks to apps/api which holds the Cloudflare API token. apps/api owns the
 * actual `POST /zones/:id/custom_hostnames` call so the token never leaves the
 * server. Returns a placeholder pending-state if the binding isn't configured.
 */
async function provisionCloudflareHostname(
  hostname: string,
  existingId: string | null
): Promise<{
  ssl_status: "pending_validation" | "active" | "failed";
  status: "pending" | "verifying" | "verified" | "active" | "failed";
  cloudflare_hostname_id?: string;
  failure_reason?: string;
}> {
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.INTERNAL_INGEST_SECRET;

  if (!apiBase || !secret) {
    // Local-dev fallback — pretend the cert is provisioning.
    return { ssl_status: "pending_validation", status: "verified" };
  }

  try {
    const res = await fetch(
      `${apiBase.replace(/\/+$/, "")}/internal/custom-domains/provision`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify({ hostname, cloudflare_hostname_id: existingId }),
      }
    );
    if (!res.ok) {
      return {
        ssl_status: "pending_validation",
        status: "verified",
        failure_reason: `apps/api returned ${res.status}`,
      };
    }
    return (await res.json()) as Awaited<ReturnType<typeof provisionCloudflareHostname>>;
  } catch (err) {
    return {
      ssl_status: "pending_validation",
      status: "verified",
      failure_reason: String((err as Error).message ?? err),
    };
  }
}
