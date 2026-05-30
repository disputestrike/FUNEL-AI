/**
 * POST /api/publish
 *   { funnel_id, slug?, custom_domain?, vanity_short_code? }
 *
 * Calls the apps/api publish.publishFunnel router via the internal HTTP
 * bridge. This thin route exists so the Next.js dashboard can use a
 * cookie-authenticated session and a single fetch() call.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspaceContext } from "@funnel/db";
import { ulid } from "ulid";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "auth", "edge", "assets", "static", "cdn",
  "mail", "smtp", "imap", "pop", "ftp", "ssh", "vpn",
  "status", "docs", "help", "support", "blog", "community", "partners",
  "grader", "grader-agents", "marketplace", "feed", "rss",
  "staging", "preview", "qa", "dev", "test",
]);

const Body = z.object({
  funnel_id: z.string().min(1),
  slug: z.string().min(3).max(32).regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/).optional(),
  custom_domain: z.string().min(4).max(253).optional(),
  vanity_short_code: z.string().min(3).max(32).regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/i).optional(),
});

const APEX = "gofunnelai.com";
const SHORT_APEX = "gofnl.co";

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const input = parsed.data;
  if (input.slug && RESERVED_SLUGS.has(input.slug)) {
    return NextResponse.json({ error: "reserved_slug" }, { status: 400 });
  }

  try {
    const result = await withWorkspaceContext(session.workspace.id, async (tx) => {
      const funnel = await tx.funnel.findFirst({
        where: { id: input.funnel_id, deleted_at: null },
        include: { current_version: true },
      });
      if (!funnel) throw new HttpError(404, "funnel_not_found");
      if (!funnel.current_version_id || !funnel.current_version) {
        throw new HttpError(400, "no_current_version");
      }

      // Resolve slug.
      const desired = input.slug ?? autoSlug(funnel.vertical ?? "funnel");
      const slug = await uniqueSlug(tx, desired, session.workspace.id);

      // Vanity gating.
      if (input.vanity_short_code && !["growth", "scale", "enterprise"].includes(session.workspace.plan)) {
        throw new HttpError(403, "vanity_requires_growth");
      }

      // Custom domain check.
      let customDomain: string | null = null;
      if (input.custom_domain) {
        const cd = await tx.customDomain.findFirst({
          where: {
            hostname: input.custom_domain.toLowerCase(),
            deleted_at: null,
            status: { in: ["verified", "active"] },
          },
        });
        if (!cd) throw new HttpError(400, "custom_domain_not_verified");
        customDomain = cd.hostname;
      }

      // Next version number.
      const last = await tx.publishedFunnel.findFirst({
        where: { funnel_id: funnel.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (last?.version ?? 0) + 1;
      const subdomainUrl = `https://${slug}.${APEX}`;

      const snapshot = {
        funnel_id: funnel.id,
        funnel_version_id: funnel.current_version_id,
        version,
        copy_blob: funnel.current_version.copy_blob,
        design_blob: funnel.current_version.design_blob,
        config_blob: funnel.current_version.config_blob,
        compliance_blob: funnel.current_version.compliance_blob,
        ai_disclosure: funnel.ai_disclosure,
      };

      const pubId = `pub_${ulid()}`;
      const pub = await tx.publishedFunnel.create({
        data: {
          id: pubId,
          workspace_id: session.workspace.id,
          funnel_id: funnel.id,
          funnel_version_id: funnel.current_version_id,
          slug,
          subdomain_url: subdomainUrl,
          custom_domain: customDomain,
          status: "active",
          snapshot: snapshot as never,
          version,
          published_at: new Date(),
          published_by: session.user.id,
        },
      });

      await tx.funnelVersion.update({
        where: { id: funnel.current_version_id },
        data: { is_published: true, published_at: new Date(), published_by: session.user.id },
      });

      await tx.funnel.update({
        where: { id: funnel.id },
        data: { status: "live", slug, live_url: subdomainUrl, updated_at: new Date() },
      });

      const shortCode = await uniqueShortCode(tx, input.vanity_short_code);
      const shortUrl = `https://${SHORT_APEX}/${shortCode}`;
      await tx.shortLink.create({
        data: {
          id: `sl_${ulid()}`,
          code: shortCode,
          target_url: subdomainUrl,
          funnel_id: funnel.id,
          published_id: pub.id,
          workspace_id: session.workspace.id,
          vanity: !!input.vanity_short_code,
          created_by: session.user.id,
        },
      });

      return {
        published_id: pub.id,
        version,
        slug,
        subdomain_url: subdomainUrl,
        short_url: shortUrl,
        short_code: shortCode,
        custom_url: customDomain ? `https://${customDomain}` : null,
        published_at: pub.published_at.toISOString(),
      };
    });

    // Fire-and-forget cache purge — non-blocking.
    purgeRendererCache([`${result.slug}.${APEX}`, ...(result.custom_url ? [new URL(result.custom_url).hostname] : [])]).catch(
      () => undefined
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    console.error("[publish] failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function autoSlug(vertical: string): string {
  return (
    vertical
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "funnel"
  );
}

async function uniqueSlug(
  tx: { publishedFunnel: { findFirst: (args: unknown) => Promise<unknown> } },
  desired: string,
  workspaceId: string
): Promise<string> {
  void workspaceId;
  const taken = await tx.publishedFunnel.findFirst({
    where: { slug: desired, status: { not: "archived" } },
  });
  if (!taken) return desired;
  for (let i = 0; i < 5; i++) {
    const candidate = `${desired}-${randomBase32(3).toLowerCase()}`;
    const exists = await tx.publishedFunnel.findFirst({
      where: { slug: candidate, status: { not: "archived" } },
    });
    if (!exists) return candidate;
  }
  throw new HttpError(500, "slug_collision");
}

async function uniqueShortCode(
  tx: { shortLink: { findFirst: (args: unknown) => Promise<unknown> } },
  vanity?: string
): Promise<string> {
  if (vanity) {
    const taken = await tx.shortLink.findFirst({ where: { code: vanity, deleted_at: null } });
    if (taken) throw new HttpError(409, "vanity_taken");
    return vanity;
  }
  for (let i = 0; i < 8; i++) {
    const code = randomBase32(6).toLowerCase();
    const exists = await tx.shortLink.findFirst({ where: { code, deleted_at: null } });
    if (!exists) return code;
  }
  throw new HttpError(500, "short_code_collision");
}

const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomBase32(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += BASE32[buf[i]! % BASE32.length];
  return out;
}

async function purgeRendererCache(hostnames: string[]): Promise<void> {
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.INTERNAL_INGEST_SECRET;
  if (!apiBase || !secret || hostnames.length === 0) return;
  await fetch(`${apiBase.replace(/\/+$/, "")}/internal/renderer/purge`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ hostnames }),
  }).catch(() => undefined);
}
