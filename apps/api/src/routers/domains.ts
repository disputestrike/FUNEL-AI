/**
 * Custom domain router.
 *
 *   domains.add({ domain })            create a pending row, return DNS instructions
 *   domains.list()                     list workspace's domains
 *   domains.verify({ domain })         DNS TXT check + Cloudflare for SaaS provision
 *   domains.remove({ domain })         remove from Cloudflare + soft-delete
 *   domains.checkSsl({ domain })       poll SSL provisioning status
 *   domains.dnsInstructions({ domain })  return cached instructions for the UI
 *
 * Custom-domain lifecycle:
 *
 *   pending     row created; customer needs to add TXT + CNAME
 *      v
 *   verifying   we're actively polling DNS for the TXT record
 *      v
 *   verified    TXT record found — Cloudflare for SaaS POSTed
 *      v
 *   active      ssl_status = active, the renderer can serve the domain
 *      |
 *      +--→ failed (Cloudflare rejected / cert provisioning failed)
 *      +--→ removed (customer or admin removed it)
 *
 * Cloudflare for SaaS calls require:
 *   - CLOUDFLARE_API_TOKEN  (env secret, scoped to "SSL and Certificates: Edit")
 *   - CLOUDFLARE_ZONE_ID    (the apex zone — gofunnelai.com)
 *
 * In environments where those aren't set we fall through with status='verified'
 * but ssl_status='unknown' so the UI can show "manual provisioning required".
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

const APEX_DOMAIN = "gofunnelai.com";
const FALLBACK_ORIGIN = `edge.${APEX_DOMAIN}`;

const DomainSchema = z
  .string()
  .min(4)
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i,
    "Not a valid hostname"
  )
  .transform((s) => s.toLowerCase())
  .refine((s) => !s.endsWith("." + APEX_DOMAIN) && s !== APEX_DOMAIN, "Cannot use a gofunnelai.com domain");

export const domainsRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      const rows = await tx.customDomain.findMany({
        where: { workspace_id: ctx.req.workspaceId!, deleted_at: null },
        orderBy: { created_at: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        hostname: r.hostname,
        status: r.status,
        ssl_status: r.ssl_status,
        verified_at: r.verified_at,
        activated_at: r.activated_at,
        failure_reason: r.failure_reason,
        last_checked_at: r.last_checked_at,
        created_at: r.created_at,
      }));
    });
  }),

  /**
   * Add a custom domain. Validates not duplicate, generates verification token,
   * returns the DNS records the customer needs to add (CNAME + TXT).
   */
  add: workspaceProcedure
    .input(z.object({ domain: DomainSchema, default_funnel_id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const hostname = input.domain;

      // Globally unique — even across tenants.
      const existing = await ctx.withTx(async (tx) =>
        tx.customDomain.findFirst({
          where: { hostname, deleted_at: null, status: { not: "removed" } },
        })
      );
      if (existing) {
        if (existing.workspace_id !== ctx.req.workspaceId) {
          throw new TRPCError({ code: "CONFLICT", message: "Domain already in use by another workspace" });
        }
        // Reuse existing — return its current state + DNS instructions.
        return {
          id: existing.id,
          hostname: existing.hostname,
          status: existing.status,
          ssl_status: existing.ssl_status,
          verification_token: existing.verification_token,
          dns_instructions: dnsInstructionsFor(hostname, existing.verification_token),
        };
      }

      const verificationToken = `funnel-verify=${randomToken(32)}`;
      const created = await ctx.withTx(async (tx) =>
        tx.customDomain.create({
          data: {
            workspace_id: ctx.req.workspaceId!,
            hostname,
            status: "pending",
            verification_token: verificationToken,
            ssl_status: "pending_validation",
            default_funnel_id: input.default_funnel_id ?? null,
          },
        })
      );

      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "create",
        resource: "custom_domain",
        resource_id: created.id,
        diff: { hostname },
      });

      await emitEvent("custom_domain_added", {
        workspace_id: ctx.req.workspaceId!,
        domain_id: created.id,
        hostname,
        actor_user_id: ctx.req.actor.user_id,
      } as never);

      return {
        id: created.id,
        hostname,
        status: created.status,
        ssl_status: created.ssl_status,
        verification_token: verificationToken,
        dns_instructions: dnsInstructionsFor(hostname, verificationToken),
      };
    }),

  /** Get DNS records the customer needs (without mutating state). */
  dnsInstructions: workspaceProcedure
    .input(z.object({ domain: DomainSchema }))
    .query(async ({ ctx, input }) => {
      const cd = await ctx.withTx(async (tx) =>
        tx.customDomain.findFirst({
          where: { workspace_id: ctx.req.workspaceId!, hostname: input.domain, deleted_at: null },
        })
      );
      if (!cd) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        hostname: cd.hostname,
        verification_token: cd.verification_token,
        instructions: dnsInstructionsFor(cd.hostname, cd.verification_token),
      };
    }),

  /**
   * Run a DNS TXT lookup; if it matches, call Cloudflare for SaaS to provision
   * the custom hostname, then enqueue an SSL poll.
   */
  verify: workspaceProcedure
    .input(z.object({ domain: DomainSchema }))
    .mutation(async ({ ctx, input }) => {
      const cd = await ctx.withTx(async (tx) =>
        tx.customDomain.findFirst({
          where: { workspace_id: ctx.req.workspaceId!, hostname: input.domain, deleted_at: null },
        })
      );
      if (!cd) throw new TRPCError({ code: "NOT_FOUND" });
      if (cd.status === "active") {
        return { ok: true, status: cd.status, ssl_status: cd.ssl_status };
      }

      await ctx.withTx(async (tx) =>
        tx.customDomain.update({
          where: { id: cd.id },
          data: { status: "verifying", last_checked_at: new Date() },
        })
      );

      // 1. DNS TXT lookup via Cloudflare's DoH endpoint (Workers-compatible).
      const txtName = `_funnel-verify.${cd.hostname}`;
      const records = await dnsLookupTxt(txtName);
      const matched = records.some((r) => r.includes(cd.verification_token));

      if (!matched) {
        await ctx.withTx(async (tx) =>
          tx.customDomain.update({
            where: { id: cd.id },
            data: {
              status: "pending",
              failure_reason: `TXT record not found at ${txtName} (last checked: ${new Date().toISOString()})`,
            },
          })
        );
        return {
          ok: false,
          status: "pending" as const,
          ssl_status: cd.ssl_status,
          failure_reason: `TXT record not found at ${txtName}`,
        };
      }

      // 2. Provision via Cloudflare for SaaS.
      const cf = await provisionCustomHostname(ctx.env as never, cd.hostname);

      const next = await ctx.withTx(async (tx) =>
        tx.customDomain.update({
          where: { id: cd.id },
          data: {
            status: cf.ok ? "verified" : "failed",
            cloudflare_hostname_id: cf.ok ? cf.cloudflareHostnameId : null,
            ssl_status: cf.ok ? cf.sslStatus : "failed",
            failure_reason: cf.ok ? null : cf.error ?? "Cloudflare provisioning failed",
            verified_at: cf.ok ? new Date() : null,
          },
        })
      );

      await emitEvent("custom_domain_verified", {
        workspace_id: ctx.req.workspaceId!,
        domain_id: cd.id,
        hostname: cd.hostname,
        ssl_status: next.ssl_status,
      } as never);

      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "verify",
        resource: "custom_domain",
        resource_id: cd.id,
        diff: { ssl_status: next.ssl_status, cf_ok: cf.ok },
      });

      return {
        ok: cf.ok,
        status: next.status,
        ssl_status: next.ssl_status,
        cloudflare_hostname_id: next.cloudflare_hostname_id,
        failure_reason: next.failure_reason,
      };
    }),

  /**
   * Poll Cloudflare for SaaS for cert status. Called from the dashboard
   * every 30s while ssl_status is pending. Updates the row and returns the
   * latest state.
   */
  checkSsl: workspaceProcedure
    .input(z.object({ domain: DomainSchema }))
    .mutation(async ({ ctx, input }) => {
      const cd = await ctx.withTx(async (tx) =>
        tx.customDomain.findFirst({
          where: { workspace_id: ctx.req.workspaceId!, hostname: input.domain, deleted_at: null },
        })
      );
      if (!cd) throw new TRPCError({ code: "NOT_FOUND" });
      if (!cd.cloudflare_hostname_id) {
        return { status: cd.status, ssl_status: cd.ssl_status };
      }

      const status = await getCustomHostnameStatus(ctx.env as never, cd.cloudflare_hostname_id);
      const updated = await ctx.withTx(async (tx) =>
        tx.customDomain.update({
          where: { id: cd.id },
          data: {
            ssl_status: status.sslStatus,
            status: status.sslStatus === "active" ? "active" : cd.status,
            activated_at: status.sslStatus === "active" && !cd.activated_at ? new Date() : cd.activated_at,
            last_checked_at: new Date(),
            failure_reason: status.error ?? null,
          },
        })
      );

      if (updated.status === "active" && cd.status !== "active") {
        await emitEvent("custom_domain_activated", {
          workspace_id: ctx.req.workspaceId!,
          domain_id: cd.id,
          hostname: cd.hostname,
        } as never);
      }
      return { status: updated.status, ssl_status: updated.ssl_status, failure_reason: updated.failure_reason };
    }),

  /** Remove a custom domain — Cloudflare DELETE + soft-delete locally. */
  remove: workspaceProcedure
    .input(z.object({ domain: DomainSchema }))
    .mutation(async ({ ctx, input }) => {
      const cd = await ctx.withTx(async (tx) =>
        tx.customDomain.findFirst({
          where: { workspace_id: ctx.req.workspaceId!, hostname: input.domain, deleted_at: null },
        })
      );
      if (!cd) throw new TRPCError({ code: "NOT_FOUND" });

      if (cd.cloudflare_hostname_id) {
        await deleteCustomHostname(ctx.env as never, cd.cloudflare_hostname_id).catch((err) => {
          console.error("[domains] CF delete failed", { id: cd.id, err: String(err) });
        });
      }
      await ctx.withTx(async (tx) =>
        tx.customDomain.update({
          where: { id: cd.id },
          data: { status: "removed", deleted_at: new Date() },
        })
      );

      // Drop the renderer cache so the next request hits the marketing 404.
      await invalidateRendererDomainCache(ctx.env as never, [cd.hostname]);

      await emitEvent("custom_domain_removed", {
        workspace_id: ctx.req.workspaceId!,
        domain_id: cd.id,
        hostname: cd.hostname,
      } as never);
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "delete",
        resource: "custom_domain",
        resource_id: cd.id,
        diff: { hostname: cd.hostname },
      });

      return { ok: true };
    }),
});

// ---------------------------------------------------------------------------
// DNS / Cloudflare for SaaS helpers
// ---------------------------------------------------------------------------

interface DnsInstruction {
  type: "CNAME" | "TXT" | "ANAME";
  name: string;
  value: string;
  ttl: number;
  description: string;
}

function dnsInstructionsFor(hostname: string, verificationToken: string): DnsInstruction[] {
  const isApex = hostname.split(".").length === 2;
  const out: DnsInstruction[] = [];

  if (isApex) {
    out.push({
      type: "ANAME",
      name: "@",
      value: FALLBACK_ORIGIN,
      ttl: 300,
      description:
        "Point the apex (@) to our edge. If your DNS provider does not support ANAME/ALIAS, switch DNS to Cloudflare (free) or any provider with CNAME flattening.",
    });
  } else {
    const sub = hostname.split(".")[0]!;
    out.push({
      type: "CNAME",
      name: sub,
      value: FALLBACK_ORIGIN,
      ttl: 300,
      description: `Add a CNAME from ${sub} to ${FALLBACK_ORIGIN}.`,
    });
  }

  out.push({
    type: "TXT",
    name: `_funnel-verify.${hostname}`,
    value: verificationToken,
    ttl: 300,
    description:
      "Ownership proof. May be removed after the domain is verified, but we recommend leaving it in place.",
  });

  return out;
}

async function dnsLookupTxt(name: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: "application/dns-json" } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ data: string }> };
    return (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

interface CfEnv {
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_FALLBACK_ORIGIN?: string;
  INTERNAL_INGEST_SECRET?: string;
  API_PUBLIC_URL?: string;
}

interface ProvisionResult {
  ok: boolean;
  cloudflareHostnameId?: string;
  sslStatus: "pending_validation" | "active" | "failed" | "unknown";
  error?: string;
}

/**
 * POST /zones/:zone_id/custom_hostnames
 * Cloudflare for SaaS docs:
 *   https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 */
async function provisionCustomHostname(env: CfEnv, hostname: string): Promise<ProvisionResult> {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    // Cloudflare API not configured — return verified but with unknown SSL.
    return { ok: true, sslStatus: "unknown" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: { min_tls_version: "1.2", http2: "on" },
            wildcard: false,
            bundle_method: "ubiquitous",
          },
        }),
      }
    );
    const j = (await res.json()) as {
      success?: boolean;
      result?: { id?: string; ssl?: { status?: string } };
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || !j.success) {
      return {
        ok: false,
        sslStatus: "failed",
        error: j.errors?.[0]?.message ?? `Cloudflare ${res.status}`,
      };
    }
    return {
      ok: true,
      cloudflareHostnameId: j.result?.id,
      sslStatus: mapSslStatus(j.result?.ssl?.status),
    };
  } catch (err) {
    return { ok: false, sslStatus: "failed", error: String(err) };
  }
}

async function getCustomHostnameStatus(
  env: CfEnv,
  hostnameId: string
): Promise<{ sslStatus: "pending_validation" | "active" | "failed" | "unknown"; error?: string }> {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    return { sslStatus: "unknown" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`,
      { headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } }
    );
    const j = (await res.json()) as {
      success?: boolean;
      result?: { ssl?: { status?: string; validation_errors?: Array<{ message: string }> } };
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || !j.success) {
      return { sslStatus: "failed", error: j.errors?.[0]?.message ?? `Cloudflare ${res.status}` };
    }
    const status = mapSslStatus(j.result?.ssl?.status);
    const error = j.result?.ssl?.validation_errors?.[0]?.message;
    return { sslStatus: status, error };
  } catch (err) {
    return { sslStatus: "unknown", error: String(err) };
  }
}

async function deleteCustomHostname(env: CfEnv, hostnameId: string): Promise<void> {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) return;
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    }
  );
}

function mapSslStatus(s?: string): "pending_validation" | "active" | "failed" | "unknown" {
  if (!s) return "unknown";
  if (s === "active") return "active";
  if (s.startsWith("pending")) return "pending_validation";
  if (s === "deleted") return "failed";
  if (s === "deactivated") return "failed";
  return "pending_validation";
}

async function invalidateRendererDomainCache(env: CfEnv, hostnames: string[]): Promise<void> {
  if (!env.API_PUBLIC_URL) return;
  await fetch(`${env.API_PUBLIC_URL.replace(/\/+$/, "")}/internal/renderer/purge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.INTERNAL_INGEST_SECRET ?? ""}`,
    },
    body: JSON.stringify({ hostnames }),
  }).catch(() => {});
}

function randomToken(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
