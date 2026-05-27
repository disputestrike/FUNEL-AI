/**
 * Funnel router — CRUD + clone / archive / restore / import / export / bulk.
 *
 * Publishing flows live in `generation.ts` (because publishing requires a
 * frozen FunnelVersion); this router only mutates funnel metadata + lifecycle.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ulid } from "ulid";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

const ListFilters = z.object({
  status: z.enum(["draft", "review", "live", "paused", "archived"]).optional(),
  q: z.string().min(1).max(100).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
  vertical: z.string().min(1).max(80).optional(),
});

const UpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  ai_disclosure: z.record(z.unknown()).optional(),
});

const BulkAction = z.enum(["archive", "restore", "delete"]);

export const funnelRouter = router({
  list: workspaceProcedure.input(ListFilters).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const items = await tx.funnel.findMany({
        where: {
          workspace_id: ctx.req.workspaceId!,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}),
          ...(input.cursor ? { id: { gt: input.cursor } } : {}),
        },
        take: input.limit + 1,
        orderBy: { created_at: "desc" },
      });
      const next = items.length > input.limit ? items[input.limit]!.id : undefined;
      return { items: items.slice(0, input.limit), next_cursor: next };
    });
  }),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const f = await tx.funnel.findFirst({
        where: { id: input.id, workspace_id: ctx.req.workspaceId!, deleted_at: null },
      });
      if (!f) throw new TRPCError({ code: "NOT_FOUND" });
      return f;
    });
  }),

  create: workspaceProcedure.input(CreateInput).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const id = `fnl_${ulid()}`;
    const created = await ctx.withTx(async (tx) =>
      tx.funnel.create({
        data: {
          id,
          workspace_id: ctx.req.workspaceId!,
          name: input.name,
          slug: input.slug,
          vertical: input.vertical ?? null,
          status: "draft",
          created_by: ctx.req.actor.user_id!,
        },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "create",
      resource: "funnel",
      resource_id: id,
      diff: input,
    });
    return created;
  }),

  update: workspaceProcedure.input(UpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    const updated = await ctx.withTx(async (tx) =>
      tx.funnel.update({
        where: { id },
        data: { ...patch, updated_at: new Date() },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "update",
      resource: "funnel",
      resource_id: id,
      diff: patch,
    });
    return updated;
  }),

  clone: workspaceProcedure
    .input(z.object({ source_id: z.string(), name: z.string().min(1).max(120), slug: z.string().min(3).max(80) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const id = `fnl_${ulid()}`;
      const cloned = await ctx.withTx(async (tx) => {
        const source = await tx.funnel.findFirst({
          where: { id: input.source_id, workspace_id: ctx.req.workspaceId! },
          include: { current_version: true },
        });
        if (!source) throw new TRPCError({ code: "NOT_FOUND" });
        const fresh = await tx.funnel.create({
          data: {
            id,
            workspace_id: ctx.req.workspaceId!,
            name: input.name,
            slug: input.slug,
            vertical: source.vertical,
            status: "draft",
            ai_disclosure: source.ai_disclosure,
            created_by: ctx.req.actor.user_id!,
          },
        });
        // Funnel version clone happens lazily on first edit — we copy the
        // bundle pointer but mark `source` = "clone".
        if (source.current_version_id) {
          const sv = await tx.funnelVersion.findUnique({ where: { id: source.current_version_id } });
          if (sv) {
            const newVid = `fvr_${ulid()}`;
            await tx.funnelVersion.create({
              data: {
                id: newVid,
                workspace_id: ctx.req.workspaceId!,
                funnel_id: fresh.id,
                version_number: 1,
                source: "clone",
                parent_version_id: sv.id,
                artifact_hash: sv.artifact_hash,
                bundle_s3_uri: sv.bundle_s3_uri,
                copy_blob: sv.copy_blob,
                design_blob: sv.design_blob,
                config_blob: sv.config_blob,
                compliance_blob: sv.compliance_blob,
              },
            });
            await tx.funnel.update({ where: { id: fresh.id }, data: { current_version_id: newVid } });
          }
        }
        return fresh;
      });
      await emitEvent("funnel_cloned", {
        source_funnel_id: input.source_id,
        target_funnel_id: id,
        actor_user_id: ctx.req.actor.user_id,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "clone",
        resource: "funnel",
        resource_id: id,
        diff: { source_id: input.source_id },
      });
      return cloned;
    }),

  archive: workspaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const archived = await ctx.withTx(async (tx) =>
      tx.funnel.update({
        where: { id: input.id },
        data: { status: "archived", archived_at: new Date() },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "archive",
      resource: "funnel",
      resource_id: input.id,
    });
    await emitEvent("funnel_archived", {
      funnel_id: input.id,
      actor_user_id: ctx.req.actor.user_id!,
    });
    return archived;
  }),

  restore: workspaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const restored = await ctx.withTx(async (tx) =>
      tx.funnel.update({
        where: { id: input.id },
        data: { status: "draft", archived_at: null },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "restore",
      resource: "funnel",
      resource_id: input.id,
    });
    return restored;
  }),

  delete: workspaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.withTx(async (tx) =>
      tx.funnel.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), status: "archived" },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "delete",
      resource: "funnel",
      resource_id: input.id,
    });
    return { ok: true };
  }),

  /** Bulk action on a set of funnel ids. */
  bulk: workspaceProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100), action: BulkAction }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.withTx(async (tx) => {
        const data =
          input.action === "archive"
            ? { status: "archived" as const, archived_at: new Date() }
            : input.action === "restore"
              ? { status: "draft" as const, archived_at: null }
              : { deleted_at: new Date(), status: "archived" as const };
        const r = await tx.funnel.updateMany({
          where: { id: { in: input.ids }, workspace_id: ctx.req.workspaceId! },
          data,
        });
        return r.count;
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: input.action === "delete" ? "delete" : input.action === "archive" ? "archive" : "restore",
        resource: "funnel",
        metadata: { ids: input.ids, affected: result },
      });
      return { affected: result };
    }),

  /** Import a funnel from JSON bundle. */
  import: workspaceProcedure
    .input(z.object({ source: z.enum(["json", "url", "clickfunnels", "kajabi"]), payload: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const id = `fnl_${ulid()}`;
      // The actual transform pipeline lives in @funnel/orchestrator's import-svc.
      // Here we record the import row + stage a job; importing is async.
      const f = await ctx.withTx(async (tx) =>
        tx.funnel.create({
          data: {
            id,
            workspace_id: ctx.req.workspaceId!,
            name: `Imported ${input.source}`,
            slug: `imported-${id.slice(-8).toLowerCase()}`,
            status: "draft",
            created_by: ctx.req.actor.user_id!,
          },
        }),
      );
      const artifactHash = await sha256(input.payload);
      await emitEvent("funnel_imported", {
        funnel_id: id,
        actor_user_id: ctx.req.actor.user_id,
        import_source: input.source,
        source_artifact_hash: artifactHash,
      });
      return f;
    }),

  /** Export a funnel as JSON bundle. */
  export: workspaceProcedure
    .input(z.object({ id: z.string(), format: z.enum(["json", "html_zip"]).default("json") }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        const f = await tx.funnel.findFirst({
          where: { id: input.id, workspace_id: ctx.req.workspaceId! },
          include: { current_version: true },
        });
        if (!f) throw new TRPCError({ code: "NOT_FOUND" });
        return {
          funnel: { id: f.id, name: f.name, slug: f.slug, status: f.status, vertical: f.vertical },
          version: f.current_version
            ? {
                id: f.current_version.id,
                version_number: f.current_version.version_number,
                bundle_s3_uri: f.current_version.bundle_s3_uri,
              }
            : null,
          format: input.format,
        };
      });
    }),
});

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
