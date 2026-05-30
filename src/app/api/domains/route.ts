/**
 * POST /api/domains  { domain }   — add a custom domain (creates pending row)
 * GET  /api/domains              — list this workspace's domains
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APEX = "gofunnelai.com";
const FALLBACK_ORIGIN = `edge.${APEX}`;

const Body = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i)
    .transform((s) => s.toLowerCase())
    .refine((s) => !s.endsWith("." + APEX) && s !== APEX, "Cannot use a gofunnelai.com domain"),
  default_funnel_id: z.string().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.findMany({
      where: { deleted_at: null, status: { not: "removed" } },
      orderBy: { created_at: "desc" },
    })
  );
  return NextResponse.json({
    domains: rows.map((r) => ({
      id: r.id,
      hostname: r.hostname,
      status: r.status,
      ssl_status: r.ssl_status,
      verification_token: r.verification_token,
      verified_at: r.verified_at,
      activated_at: r.activated_at,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const hostname = parsed.data.domain;
  const verificationToken = `funnel-verify=${randomToken(32)}`;

  const result = await withWorkspaceContext(session.workspace.id, async (tx) => {
    const existing = await tx.customDomain.findFirst({
      where: { hostname, deleted_at: null, status: { not: "removed" } },
    });
    if (existing) {
      if (existing.workspace_id !== session.workspace.id) {
        return { conflict: true as const };
      }
      return { row: existing };
    }
    const created = await tx.customDomain.create({
      data: {
        workspace_id: session.workspace.id,
        hostname,
        status: "pending",
        verification_token: verificationToken,
        ssl_status: "pending_validation",
        default_funnel_id: parsed.data.default_funnel_id ?? null,
      },
    });
    return { row: created };
  });

  if ("conflict" in result) {
    return NextResponse.json({ error: "domain_in_use_elsewhere" }, { status: 409 });
  }

  const cd = result.row;
  return NextResponse.json({
    id: cd.id,
    hostname: cd.hostname,
    status: cd.status,
    ssl_status: cd.ssl_status,
    verification_token: cd.verification_token,
    instructions: dnsInstructionsFor(cd.hostname, cd.verification_token),
  });
}

function dnsInstructionsFor(hostname: string, token: string) {
  const isApex = hostname.split(".").length === 2;
  return [
    isApex
      ? {
          type: "ANAME",
          name: "@",
          value: FALLBACK_ORIGIN,
          ttl: 300,
          description:
            "Apex domain — if your DNS provider does not support ANAME/ALIAS, switch to Cloudflare or any provider with CNAME flattening.",
        }
      : {
          type: "CNAME",
          name: hostname.split(".")[0],
          value: FALLBACK_ORIGIN,
          ttl: 300,
          description: `Add a CNAME for ${hostname.split(".")[0]} pointing to ${FALLBACK_ORIGIN}.`,
        },
    {
      type: "TXT",
      name: `_funnel-verify.${hostname}`,
      value: token,
      ttl: 300,
      description: "Ownership proof. May be removed after verification.",
    },
  ];
}

function randomToken(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
