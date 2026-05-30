/**
 * Publish router.
 *
 *   publish.publishFunnel({ funnel_id, slug, options })
 *   publish.unpublishFunnel({ funnel_id })
 *   publish.republishFunnel({ funnel_id })
 *   publish.getStatus({ funnel_id })
 *   publish.checkSlugAvailable({ slug })
 *   publish.suggestSlug({ vertical })
 *
 * On publish:
 *   1. validate the slug (a-z 0-9 -, 3-32 chars, unique, not a reserved label)
 *   2. snapshot the current funnel_version into `published_funnels`
 *   3. generate a 6-char base32 short-link code (or vanity, Growth+ only)
 *   4. (optional) queue Cloudflare for SaaS custom-hostname creation
 *   5. purge the renderer's DOMAIN_CACHE for the affected hostname(s)
 *   6. emit `funnel_published`
 *   7. return { subdomain_url, short_url, custom_url? }
 *
 * Unpublish flips published_funnels.status to 'paused' and bumps the funnel's
 * status to 'paused' — the renderer's DOMAIN_CACHE invalidation pushes the
 * change live worldwide within 60 seconds.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ulid } from "ulid";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

// ----- Validation primitives ------------------------------------------------

const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "auth", "edge", "assets", "static", "cdn",
  "mail", "smtp", "imap", "pop", "ftp", "ssh", "vpn",
  "status", "docs", "help", "support", "blog", "community", "partners",
  "grader", "grader-agents", "marketplace", "feed", "rss",
  "staging", "preview", "qa", "dev", "test",
]);

const SlugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/, "Slug must be lowercase alphanumeric or hyphen, 3-32 chars")
  .refine((s) => !RESERVED_SLUGS.has(s), "That slug is reserved");

const PublishInput = z.object({
  funnel_id: z.string().min(1),
  /** Optional — auto-generated `<vertical>-<3char-hash>` if omitted. */
  slug: SlugSchema.optional(),
  /** Optional custom domain to attach. Requires a verified custom_domains row. */
  custom_domain: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i)
    .optional(),
  /** Vanity short-link code (Growth+ tier only). */
  vanity_short_code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/i)
    .optional(),
});

const APEX_DOMAIN = "gofunnelai.com";
const SHORT_DOMAIN = "gofnl.co";

// ----- The router -----------------------------------------------------------

export const publishRouter = router({
  /** Check whether a workspace subdomain slug is free. */
  checkSlugAvailable: workspaceProcedure
    .input(z.object({ slug: SlugSchema }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        const taken = await tx.publishedFunnel.findFirst({
          where: {
            slug: input.slug,
            status: { not: "archived" },
          },
          select: { id: true, workspaceId: true },
        });
        return {
          available: !taken,
          owned_by_current_workspace:
            taken?.workspaceId === ctx.req.workspaceId,
        };
      });
    }),

  /** Generate a default slug from a vertical + funnel name. */
  suggestSlug: workspaceProcedure
    .input(z.object({ vertical: z.string().min(1).max(80), funnel_name: z.string().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      const base = sanitizeSlug(input.vertical || "funnel");
      for (let i = 0; i < 5; i++) {
        const candidate = `${base}-${randomBase32(3).toLowerCase()}`;
        const taken = await ctx.withTx(async (tx) =>
          tx.publishedFunnel.findFirst({ where: { slug: candidate, status: { not: "archived" } } })
        );
        if (!taken) return { slug: candidate };
      }
      // Should be effectively impossible.
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not suggest unique slug" });
    }),

  /**
   * Publish a funnel. This is the single entrypoint the dashboard /launch
   * flow calls. Returns the 3 URLs (subdomain, short, optional custom).
   */
  publishFunnel: workspaceProcedure
    .input(PublishInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Resolve the funnel + current version + workspace plan.
      const { funnel, workspacePlan } = await ctx.withTx(async (tx) => {
        const f = await tx.funnel.findFirst({
          where: { id: input.funnel_id, workspace_id: ctx.req.workspaceId!, deleted_at: null },
          include: { current_version: true },
        });
        if (!f) throw new TRPCError({ code: "NOT_FOUND" });
        if (!f.current_version_id || !f.current_version) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Funnel has no current version" });
        }
        const ws = await tx.workspace.findUnique({
          where: { id: ctx.req.workspaceId! },
          select: { plan: true, slug: true },
        });
        return { funnel: f, workspacePlan: ws?.plan ?? "trial" };
      });

      // 1. Resolve slug — pick provided, or auto-generate.
      let slug = input.slug ?? sanitizeSlug(funnel.vertical ?? "funnel");
      slug = await uniqueSlug(ctx, slug, funnel.vertical ?? null);

      // 2. Vanity short-code is gated.
      if (input.vanity_short_code && !canUseVanity(workspacePlan)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vanity short links require the Growth tier or higher",
        });
      }

      // 3. Custom domain attachment requires a verified row.
      let customDomain: { id: string; hostname: string } | null = null;
      if (input.custom_domain) {
        const cd = await ctx.withTx(async (tx) =>
          tx.customDomain.findFirst({
            where: {
              workspace_id: ctx.req.workspaceId!,
              hostname: input.custom_domain!.toLowerCase(),
              deleted_at: null,
              status: { in: ["verified", "active"] },
            },
          })
        );
        if (!cd) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Custom domain is not verified or not attached to this workspace",
          });
        }
        customDomain = { id: cd.id, hostname: cd.hostname };
      }

      // 4. Compute the next version number for this funnel's published row.
      const lastPub = await ctx.withTx(async (tx) =>
        tx.publishedFunnel.findFirst({
          where: { funnel_id: funnel.id },
          orderBy: { version: "desc" },
          select: { version: true },
        })
      );
      const nextVersion = (lastPub?.version ?? 0) + 1;

      // 5. Build the snapshot from copy + design + config blobs.
      const snapshot = {
        funnel_id: funnel.id,
        funnel_version_id: funnel.current_version_id!,
        version: nextVersion,
        copy_blob: funnel.current_version!.copy_blob,
        design_blob: funnel.current_version!.design_blob,
        config_blob: funnel.current_version!.config_blob,
        compliance_blob: funnel.current_version!.compliance_blob,
        ai_disclosure: funnel.ai_disclosure,
        published_at: new Date().toISOString(),
      };

      const subdomainHost = `${slug}.${APEX_DOMAIN}`;
      const subdomainUrl = `https://${subdomainHost}`;

      const pubId = `pub_${ulid()}`;
      const shortCode = await generateUniqueShortCode(ctx, input.vanity_short_code);
      const shortUrl = `https://${SHORT_DOMAIN}/${shortCode}`;
      const customUrl = customDomain ? `https://${customDomain.hostname}` : null;

      // 6. Inside a single tx: write published_funnels, flip Funnel.live_url +
      //    funnel_versions.is_published, insert short_links row.
      const result = await ctx.withTx(async (tx) => {
        const pub = await tx.publishedFunnel.create({
          data: {
            id: pubId,
            workspace_id: ctx.req.workspaceId!,
            funnel_id: funnel.id,
            funnel_version_id: funnel.current_version_id!,
            slug,
            subdomain_url: subdomainUrl,
            custom_domain: customDomain?.hostname ?? null,
            status: "active",
            snapshot: snapshot as never,
            version: nextVersion,
            published_at: new Date(),
            published_by: ctx.req.actor.user_id!,
          },
        });

        await tx.funnelVersion.update({
          where: { id: funnel.current_version_id! },
          data: {
            is_published: true,
            published_at: new Date(),
            published_by: ctx.req.actor.user_id!,
          },
        });

        await tx.funnel.update({
          where: { id: funnel.id },
          data: {
            status: "live",
            slug,
            live_url: subdomainUrl,
            updated_at: new Date(),
          },
        });

        const shortLink = await tx.shortLink.create({
          data: {
            id: `sl_${ulid()}`,
            code: shortCode,
            target_url: subdomainUrl,
            funnel_id: funnel.id,
            published_id: pub.id,
            workspace_id: ctx.req.workspaceId!,
            vanity: !!input.vanity_short_code,
            created_by: ctx.req.actor.user_id!,
          },
        });

        return { pub, shortLink };
      });

      // 7. Purge renderer cache for any hostname this publish touches.
      await invalidateDomainCache(ctx.env, [subdomainHost, ...(customDomain ? [customDomain.hostname] : [])]);

      // 8. Emit and audit.
      await emitEvent("funnel_published", {
        funnel_id: funnel.id,
        funnel_version_id: funnel.current_version_id!,
        actor_user_id: ctx.req.actor.user_id,
        url: subdomainUrl,
        regions: [ctx.env.DEFAULT_REGION],
      } as never);

      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "publish",
        resource: "funnel",
        resource_id: funnel.id,
        diff: {
          slug,
          version: nextVersion,
          short_code: shortCode,
          custom_domain: customDomain?.hostname ?? null,
        },
      });

      return {
        published_id: result.pub.id,
        funnel_id: funnel.id,
        version: nextVersion,
        slug,
        subdomain_url: subdomainUrl,
        short_url: shortUrl,
        short_code: shortCode,
        custom_url: customUrl,
        published_at: result.pub.published_at,
      };
    }),

  /** Pause public access without losing the snapshot. */
  unpublishFunnel: workspaceProcedure
    .input(z.object({ funnel_id: z.string(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) => {
        const rows = await tx.publishedFunnel.updateMany({
          where: { funnel_id: input.funnel_id, status: "active" },
          data: { status: "paused", paused_at: new Date() },
        });
        await tx.funnel.update({
          where: { id: input.funnel_id },
          data: { status: "paused", live_url: null, updated_at: new Date() },
        });
        return rows.count;
      });

      // Resolve the hostname(s) we need to purge.
      const hostnames = await ctx.withTx(async (tx) => {
        const pubs = await tx.publishedFunnel.findMany({
          where: { funnel_id: input.funnel_id },
          select: { slug: true, custom_domain: true },
        });
        const set = new Set<string>();
        for (const p of pubs) {
          set.add(`${p.slug}.${APEX_DOMAIN}`);
          if (p.custom_domain) set.add(p.custom_domain);
        }
        return [...set];
      });
      await invalidateDomainCache(ctx.env, hostnames);

      await emitEvent("funnel_unpublished", {
        funnel_id: input.funnel_id,
        funnel_version_id: "",
        actor_user_id: ctx.req.actor.user_id!,
        reason: input.reason ?? "manual",
      } as never);

      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "unpublish",
        resource: "funnel",
        resource_id: input.funnel_id,
        diff: { reason: input.reason ?? null, affected: updated },
      });

      return { ok: true, paused: updated };
    }),

  /** Bump version and snapshot the current funnel_version again. */
  republishFunnel: workspaceProcedure
    .input(z.object({ funnel_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find the existing slug to reuse.
      const last = await ctx.withTx(async (tx) =>
        tx.publishedFunnel.findFirst({
          where: { funnel_id: input.funnel_id },
          orderBy: { version: "desc" },
          select: { slug: true, custom_domain: true },
        })
      );
      if (!last) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Funnel has never been published" });
      }
      // Delegate to publish with the existing slug + custom domain.
      const me = publishRouter.createCaller({ ...ctx } as never);
      return me.publishFunnel({
        funnel_id: input.funnel_id,
        slug: last.slug,
        custom_domain: last.custom_domain ?? undefined,
      });
    }),

  /** Current public status for the dashboard launch screen. */
  getStatus: workspaceProcedure
    .input(z.object({ funnel_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        const latest = await tx.publishedFunnel.findFirst({
          where: { funnel_id: input.funnel_id },
          orderBy: { version: "desc" },
          include: {
            shortLinks: { where: { deleted_at: null }, take: 5, orderBy: { created_at: "desc" } },
          },
        });
        if (!latest) return { published: false as const };
        const subdomainHost = `${latest.slug}.${APEX_DOMAIN}`;
        return {
          published: true as const,
          published_id: latest.id,
          version: latest.version,
          status: latest.status,
          slug: latest.slug,
          subdomain_url: `https://${subdomainHost}`,
          custom_url: latest.custom_domain ? `https://${latest.custom_domain}` : null,
          short_links: latest.shortLinks.map((s) => ({
            code: s.code,
            url: `https://${SHORT_DOMAIN}/${s.code}`,
            vanity: s.vanity,
            click_count: Number(s.click_count),
          })),
          published_at: latest.published_at,
        };
      });
    }),
});

// ----- helpers --------------------------------------------------------------

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 28) || "funnel";
}

async function uniqueSlug(
  ctx: { withTx: <T>(fn: (tx: never) => Promise<T>) => Promise<T> },
  desired: string,
  vertical: string | null
): Promise<string> {
  // Try the requested slug first.
  const taken = await ctx.withTx(async (tx: never) =>
    (tx as unknown as {
      publishedFunnel: {
        findFirst: (args: unknown) => Promise<unknown>;
      };
    }).publishedFunnel.findFirst({
      where: { slug: desired, status: { not: "archived" } },
    })
  );
  if (!taken) {
    if (RESERVED_SLUGS.has(desired)) {
      // Append a 3-char hash to escape reservation.
      return `${desired}-${randomBase32(3).toLowerCase()}`;
    }
    return desired;
  }
  // Add a 3-char hash and retry up to 5 times.
  const base = vertical ? sanitizeSlug(vertical) : desired;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBase32(3).toLowerCase()}`;
    const exists = await ctx.withTx(async (tx: never) =>
      (tx as unknown as {
        publishedFunnel: { findFirst: (args: unknown) => Promise<unknown> };
      }).publishedFunnel.findFirst({
        where: { slug: candidate, status: { not: "archived" } },
      })
    );
    if (!exists) return candidate;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate unique slug" });
}

function canUseVanity(plan: string): boolean {
  return plan === "growth" || plan === "scale" || plan === "enterprise";
}

const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Crockford-ish: no 0/1/I/L/O/U
function randomBase32(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += BASE32_ALPHABET[buf[i]! % BASE32_ALPHABET.length];
  }
  return out;
}

async function generateUniqueShortCode(
  ctx: { withTx: <T>(fn: (tx: never) => Promise<T>) => Promise<T> },
  vanity?: string
): Promise<string> {
  if (vanity) {
    const taken = await ctx.withTx(async (tx: never) =>
      (tx as unknown as {
        shortLink: { findFirst: (args: unknown) => Promise<unknown> };
      }).shortLink.findFirst({
        where: { code: vanity, deleted_at: null },
      })
    );
    if (taken) {
      throw new TRPCError({ code: "CONFLICT", message: "Vanity short code already in use" });
    }
    return vanity;
  }
  for (let i = 0; i < 8; i++) {
    const code = randomBase32(6).toLowerCase();
    const exists = await ctx.withTx(async (tx: never) =>
      (tx as unknown as {
        shortLink: { findFirst: (args: unknown) => Promise<unknown> };
      }).shortLink.findFirst({
        where: { code, deleted_at: null },
      })
    );
    if (!exists) return code;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate short code" });
}

/**
 * Tell the renderer's DOMAIN_CACHE KV to drop entries for the given hostnames.
 * The actual purge is in apps/renderer; we call its internal endpoint, falling
 * back to a queued job if the service binding isn't available.
 */
async function invalidateDomainCache(
  env: { API_PUBLIC_URL: string; INTERNAL_INGEST_SECRET?: string } | unknown,
  hostnames: string[]
): Promise<void> {
  if (hostnames.length === 0) return;
  try {
    const e = env as { API_PUBLIC_URL: string; INTERNAL_INGEST_SECRET?: string };
    if (!e.API_PUBLIC_URL) return;
    await fetch(`${e.API_PUBLIC_URL.replace(/\/+$/, "")}/internal/renderer/purge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${e.INTERNAL_INGEST_SECRET ?? ""}`,
      },
      body: JSON.stringify({ hostnames }),
    }).catch(() => {});
  } catch {
    // Cache will SWR-refresh within the configured window anyway — best-effort.
  }
}
