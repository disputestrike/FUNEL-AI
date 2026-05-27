/**
 * CRM router — contacts, leads, pipelines, bookings.
 *
 * Lead capture from a rendered funnel arrives via `/webhooks/funnels/:funnelId/submit`
 * (see `webhooks/form-submit.ts`); that endpoint creates rows directly and is
 * NOT routed through tRPC. tRPC handlers below are for dashboard CRUD by
 * authenticated workspace members.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ulid } from "ulid";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

// ---- shared filter shape ----------------------------------------------------
const ListFilters = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  q: z.string().max(100).optional(),
  status: z.string().optional(),
});

// ============================================================================
// Contacts
// ============================================================================
const ContactCreate = z.object({
  email: z.string().email().optional(),
  phone_e164: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
  full_name: z.string().max(200).optional(),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(40)).max(50).optional(),
  consent: z
    .object({
      marketing: z.boolean().optional(),
      sms: z.boolean().optional(),
      calls: z.boolean().optional(),
    })
    .optional(),
});

const contactRouter = router({
  list: workspaceProcedure.input(ListFilters).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const items = await tx.crmContact.findMany({
        where: {
          workspace_id: ctx.req.workspaceId!,
          deleted_at: null,
          ...(input.q ? { OR: [{ full_name: { contains: input.q, mode: "insensitive" } }, { email_normalized: { contains: input.q.toLowerCase() } }] } : {}),
          ...(input.cursor ? { id: { gt: input.cursor } } : {}),
        },
        take: input.limit + 1,
        orderBy: { last_activity_at: "desc" },
      });
      return {
        items: items.slice(0, input.limit),
        next_cursor: items.length > input.limit ? items[input.limit]!.id : undefined,
      };
    });
  }),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const c = await tx.crmContact.findFirst({
        where: { id: input.id, workspace_id: ctx.req.workspaceId! },
      });
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      return c;
    });
  }),

  create: workspaceProcedure.input(ContactCreate).mutation(async ({ ctx, input }) => {
    const id = `crm_${ulid()}`;
    const created = await ctx.withTx(async (tx) =>
      tx.crmContact.create({
        data: {
          id,
          workspace_id: ctx.req.workspaceId!,
          email_normalized: input.email?.toLowerCase(),
          phone_e164: input.phone_e164,
          full_name: input.full_name,
          first_name: input.first_name,
          last_name: input.last_name,
          company: input.company,
          custom_fields: input.custom_fields ?? {},
          tags: input.tags ?? [],
          consent: input.consent ?? {},
          primary_source: "manual",
        },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "create",
      resource: "contact",
      resource_id: id,
    });
    return created;
  }),

  update: workspaceProcedure
    .input(z.object({ id: z.string(), patch: ContactCreate.partial() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) =>
        tx.crmContact.update({
          where: { id: input.id },
          data: { ...input.patch, updated_at: new Date() },
        }),
      );
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "update",
        resource: "contact",
        resource_id: input.id,
        diff: input.patch,
      });
      return updated;
    }),

  delete: workspaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.withTx(async (tx) =>
      tx.crmContact.update({ where: { id: input.id }, data: { deleted_at: new Date() } }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "delete",
      resource: "contact",
      resource_id: input.id,
    });
    return { ok: true };
  }),

  setDoNotContact: workspaceProcedure
    .input(z.object({ id: z.string(), do_not_contact: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) =>
        tx.crmContact.update({ where: { id: input.id }, data: { do_not_contact: input.do_not_contact } }),
      );
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "update",
        resource: "contact",
        resource_id: input.id,
        diff: { do_not_contact: input.do_not_contact },
      });
      return updated;
    }),
});

// ============================================================================
// Leads
// ============================================================================
const LeadStatus = z.enum(["new", "contacted", "qualified", "disqualified", "booked", "converted", "closed"]);

const leadRouter = router({
  list: workspaceProcedure
    .input(ListFilters.extend({ funnel_id: z.string().optional(), status: LeadStatus.optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        const items = await tx.lead.findMany({
          where: {
            workspace_id: ctx.req.workspaceId!,
            deleted_at: null,
            ...(input.funnel_id ? { funnel_id: input.funnel_id } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.cursor ? { id: { gt: input.cursor } } : {}),
          },
          take: input.limit + 1,
          orderBy: { created_at: "desc" },
        });
        return {
          items: items.slice(0, input.limit),
          next_cursor: items.length > input.limit ? items[input.limit]!.id : undefined,
        };
      });
    }),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const l = await tx.lead.findFirst({
        where: { id: input.id, workspace_id: ctx.req.workspaceId! },
      });
      if (!l) throw new TRPCError({ code: "NOT_FOUND" });
      return l;
    });
  }),

  setStatus: workspaceProcedure
    .input(z.object({ id: z.string(), status: LeadStatus, notes: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) =>
        tx.lead.update({
          where: { id: input.id },
          data: {
            status: input.status,
            updated_at: new Date(),
            ...(input.status === "qualified" ? { qualified_at: new Date() } : {}),
            ...(input.status === "disqualified" ? { disqualified_at: new Date() } : {}),
            ...(input.status === "converted" ? { converted_at: new Date() } : {}),
          },
        }),
      );
      if (input.status === "qualified") {
        await emitEvent("lead_qualified", {
          lead_id: input.id,
          qualifier: ctx.req.actor.user_id ?? "system",
          qualifier_method: "manual",
        });
      } else if (input.status === "disqualified") {
        await emitEvent("lead_disqualified", {
          lead_id: input.id,
          reason_code: "manual",
          disqualifier: ctx.req.actor.user_id ?? "system",
        });
      }
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "update",
        resource: "lead",
        resource_id: input.id,
        diff: { status: input.status },
      });
      return updated;
    }),

  /** Reassign lead to a different pipeline stage. */
  setStage: workspaceProcedure
    .input(z.object({ id: z.string(), pipeline_stage_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) =>
        tx.lead.update({
          where: { id: input.id },
          data: { attribution_blob: { stage: input.pipeline_stage_id }, updated_at: new Date() },
        }),
      );
      return updated;
    }),

  bulkAssign: workspaceProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(500), assignee_user_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.withTx(async (tx) =>
        tx.lead.updateMany({
          where: { id: { in: input.ids }, workspace_id: ctx.req.workspaceId! },
          data: { attribution_blob: { assignee_user_id: input.assignee_user_id } },
        }),
      );
      return { affected: result.count };
    }),
});

// ============================================================================
// Pipelines
// ============================================================================
const pipelineRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      // The `pipeline` model may not be in the active prisma schema; the package
      // ships pipelines as a soft model. Guard with optional chaining.
      const list = await tx.pipeline?.findMany?.({
        where: { workspace_id: ctx.req.workspaceId! },
        orderBy: { created_at: "asc" },
      }).catch(() => []);
      return list ?? [];
    });
  }),

  create: workspaceProcedure
    .input(z.object({ name: z.string().min(1).max(120), stages: z.array(z.string().min(1).max(80)).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const id = `pip_${ulid()}`;
      await ctx.withTx(async (tx) =>
        tx.pipeline?.create?.({
          data: {
            id,
            workspace_id: ctx.req.workspaceId!,
            name: input.name,
            stages: input.stages.map((label, i) => ({ id: `pst_${ulid()}`, label, position: i })),
          },
        }),
      );
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "create",
        resource: "pipeline",
        resource_id: id,
        diff: { name: input.name, stage_count: input.stages.length },
      });
      return { id };
    }),
});

// ============================================================================
// Bookings
// ============================================================================
const BookingCreate = z.object({
  lead_id: z.string(),
  funnel_id: z.string(),
  host_user_id: z.string().optional(),
  scheduled_for: z.string().datetime(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  timezone: z.string().default("UTC"),
});

const bookingRouter = router({
  list: workspaceProcedure.input(ListFilters).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const items = await tx.booking.findMany({
        where: { workspace_id: ctx.req.workspaceId!, deleted_at: null },
        take: input.limit,
        orderBy: { scheduled_for: "asc" },
      });
      return { items };
    });
  }),

  create: workspaceProcedure.input(BookingCreate).mutation(async ({ ctx, input }) => {
    const id = `bkg_${ulid()}`;
    const created = await ctx.withTx(async (tx) =>
      tx.booking.create({
        data: {
          id,
          workspace_id: ctx.req.workspaceId!,
          lead_id: input.lead_id,
          funnel_id: input.funnel_id,
          host_user_id: input.host_user_id,
          scheduled_for: new Date(input.scheduled_for),
          duration_minutes: input.duration_minutes,
          timezone: input.timezone,
          external_calendar: "funnel_native",
          status: "confirmed",
        },
      }),
    );
    await emitEvent("lead_booking_created", {
      lead_id: input.lead_id,
      booking_id: id,
      calendar_event_id: id,
      scheduled_for: input.scheduled_for,
      host_user_id: input.host_user_id ?? "",
    });
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "create",
      resource: "booking",
      resource_id: id,
    });
    return created;
  }),

  cancel: workspaceProcedure
    .input(z.object({ id: z.string(), reason: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.withTx(async (tx) =>
        tx.booking.update({
          where: { id: input.id },
          data: {
            status: "canceled",
            canceled_at: new Date(),
            canceled_by: ctx.req.actor.user_id ?? "system",
            cancel_reason: input.reason,
          },
        }),
      );
      await emitEvent("lead_booking_canceled", {
        booking_id: input.id,
        canceled_by: ctx.req.actor.user_id ?? "system",
        cancel_reason: input.reason,
      });
      return updated;
    }),
});

// ============================================================================
// Root CRM router
// ============================================================================
export const crmRouter = router({
  contact: contactRouter,
  lead: leadRouter,
  pipeline: pipelineRouter,
  booking: bookingRouter,
});
