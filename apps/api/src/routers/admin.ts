/**
 * Admin router — internal-only operations.
 *
 * Every procedure in here is gated by `requireAdminCapability` from
 * @funnel/auth. Read-only ops are still gated; write ops are also wrapped
 * in `withAdminContext` so RLS is bypassed.
 *
 * Doc 12 PRD-5 §7 enumerates capabilities by role.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withAdminContext } from "@funnel/db/rls";
import { router, adminProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

export const adminRouter = router({
  // --- Search -----------------------------------------------------------
  searchUsers: adminProcedure
    .input(z.object({ q: z.string().min(2).max(120), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      return withAdminContext(async (tx) =>
        tx.user.findMany({
          where: {
            OR: [
              { email_normalized: { contains: input.q.toLowerCase() } },
              { full_name: { contains: input.q, mode: "insensitive" } },
            ],
            deleted_at: null,
          },
          select: { id: true, email: true, full_name: true, created_at: true, last_login_at: true, is_internal: true },
          take: input.limit,
        }),
      );
    }),

  searchWorkspaces: adminProcedure
    .input(z.object({ q: z.string().min(2).max(120), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      return withAdminContext(async (tx) =>
        tx.workspace.findMany({
          where: {
            OR: [{ slug: { contains: input.q.toLowerCase() } }, { name: { contains: input.q, mode: "insensitive" } }],
            deleted_at: null,
          },
          select: { id: true, slug: true, name: true, plan: true, region: true, created_at: true, closed_at: true },
          take: input.limit,
        }),
      );
    }),

  // --- Workspace actions ------------------------------------------------
  suspendWorkspace: adminProcedure
    .input(z.object({ workspace_id: z.string(), reason: z.string().min(10).max(2000), ticket_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      await withAdminContext(async (tx) =>
        tx.workspace.update({ where: { id: input.workspace_id }, data: { closed_at: null, closed_reason: input.reason } }),
      );
      await writeAuditLog(ctx.req, {
        workspace_id: null,
        action: "update",
        resource: "workspace",
        resource_id: input.workspace_id,
        metadata: { suspend_reason: input.reason, ticket_id: input.ticket_id },
      });
      await emitEvent("account_suspended", {
        workspace_id: input.workspace_id,
        admin_user_id: ctx.req.actor.user_id,
        reason: input.reason,
        justification_ticket_id: input.ticket_id,
      });
      return { ok: true };
    }),

  restoreWorkspace: adminProcedure
    .input(z.object({ workspace_id: z.string(), ticket_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      await withAdminContext(async (tx) =>
        tx.workspace.update({ where: { id: input.workspace_id }, data: { closed_at: null, closed_reason: null } }),
      );
      await emitEvent("account_restored", {
        workspace_id: input.workspace_id,
        admin_user_id: ctx.req.actor.user_id,
        justification_ticket_id: input.ticket_id,
      });
      return { ok: true };
    }),

  // --- Credits + refunds ------------------------------------------------
  applyCredit: adminProcedure
    .input(
      z.object({
        workspace_id: z.string(),
        amount_micros: z.number().int().positive(),
        currency: z.string().length(3),
        ticket_id: z.string(),
        justification: z.string().min(20).max(2000),
        expires_at: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { applyCredit } = await import("@funnel/billing").catch(() => ({ applyCredit: null as never }));
      if (!applyCredit) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await applyCredit({
        workspace_id: input.workspace_id,
        amount_micros: input.amount_micros,
        currency: input.currency,
        actor_user_id: ctx.req.actor.user_id,
        justification_ticket_id: input.ticket_id,
        expires_at: input.expires_at,
      });
      await emitEvent("admin_credit_applied", {
        workspace_id: input.workspace_id,
        admin_user_id: ctx.req.actor.user_id,
        amount_micros: input.amount_micros,
        currency: input.currency,
        justification_ticket_id: input.ticket_id,
      });
      return result;
    }),

  issueRefund: adminProcedure
    .input(
      z.object({
        workspace_id: z.string(),
        payment_id: z.string(),
        amount_micros: z.number().int().positive(),
        currency: z.string().length(3),
        ticket_id: z.string(),
        reason_code: z.string().max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { issueRefund } = await import("@funnel/billing").catch(() => ({ issueRefund: null as never }));
      if (!issueRefund) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await issueRefund({
        workspace_id: input.workspace_id,
        payment_id: input.payment_id,
        amount_micros: input.amount_micros,
        currency: input.currency,
        actor_user_id: ctx.req.actor.user_id,
        justification_ticket_id: input.ticket_id,
        reason_code: input.reason_code,
      });
      await emitEvent("admin_refund_issued", {
        workspace_id: input.workspace_id,
        admin_user_id: ctx.req.actor.user_id,
        amount_micros: input.amount_micros,
        currency: input.currency,
        justification_ticket_id: input.ticket_id,
      });
      return result;
    }),

  // --- Impersonation ----------------------------------------------------
  startImpersonation: adminProcedure
    .input(
      z.object({
        target_user_id: z.string(),
        workspace_id: z.string(),
        ticket_id: z.string(),
        reason: z.string().min(20).max(2000),
        scope: z.array(z.string()).default([]),
        duration_min: z.number().int().min(5).max(60).default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const expiresAt = new Date(Date.now() + input.duration_min * 60_000).toISOString();
      await emitEvent("impersonation_started", {
        admin_user_id: ctx.req.actor.user_id,
        target_user_id: input.target_user_id,
        workspace_id: input.workspace_id,
        justification_ticket_id: input.ticket_id,
        reason: input.reason,
        expires_at: expiresAt,
      });
      return { expires_at: expiresAt };
    }),

  // --- Webhook + job retry ---------------------------------------------
  retryWebhook: adminProcedure
    .input(z.object({ webhook_event_id: z.string(), reason: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const raw = await ctx.env.WEBHOOK_BODIES.get(`raw/${input.webhook_event_id}`);
      if (!raw) throw new TRPCError({ code: "NOT_FOUND", message: "Raw body not retained" });
      await ctx.env.Q_WEBHOOKS.send({
        webhookEventId: input.webhook_event_id,
        provider: "replay",
        receivedAt: new Date().toISOString(),
        rawBodyKey: `raw/${input.webhook_event_id}`,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: null,
        action: "webhook_replay",
        resource: "webhook",
        resource_id: input.webhook_event_id,
        metadata: { reason: input.reason },
      });
      return { ok: true };
    }),

  retryJob: adminProcedure
    .input(z.object({ queue: z.enum(["webhooks", "generation", "email", "revtry", "dunning"]), job_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Queues are one-way in Workers; "retry" means re-enqueue from the DLQ.
      // The reconciler reads the DLQ row by id and re-emits. Here we just
      // audit + emit; the reconciler picks it up on next tick.
      await writeAuditLog(ctx.req, {
        workspace_id: null,
        action: "job_retry",
        resource: input.queue,
        resource_id: input.job_id,
      });
      return { queued: true };
    }),

  // --- Audit log access ------------------------------------------------
  recentAuditLog: adminProcedure
    .input(z.object({ workspace_id: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      return withAdminContext(async (tx) =>
        tx.auditLog.findMany({
          where: input.workspace_id ? { workspace_id: input.workspace_id } : {},
          orderBy: { created_at: "desc" },
          take: input.limit,
        }),
      );
    }),
});
