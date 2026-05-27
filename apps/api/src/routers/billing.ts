/**
 * Billing router — subscription lifecycle, plan changes, invoice access.
 *
 * Heavy lifting (proration math, processor calls, lifecycle state machine)
 * lives in @funnel/billing. This router is a thin façade that validates
 * input, calls into @funnel/billing, audits, and emits events.
 *
 * PayPal is primary processor; Stripe is secondary. Plan/processor selection
 * happens at signup based on region (see Doc 04 §B.5).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

const Plan = z.enum(["trial", "starter", "growth", "scale", "agency"]);

export const billingRouter = router({
  getSubscription: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      const sub = await tx.subscription.findFirst({
        where: { workspace_id: ctx.req.workspaceId! },
        orderBy: { created_at: "desc" },
      });
      return sub;
    });
  }),

  upgrade: workspaceProcedure
    .input(z.object({ to_plan: Plan, processor: z.enum(["paypal", "stripe"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { upgradeSubscription } = await import("@funnel/billing").catch(() => ({ upgradeSubscription: null as never }));
      if (!upgradeSubscription) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Billing not wired" });
      const result = await upgradeSubscription({
        workspace_id: ctx.req.workspaceId!,
        to_plan: input.to_plan,
        actor_user_id: ctx.req.actor.user_id,
        processor: input.processor,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "subscription_change",
        resource: "subscription",
        resource_id: result.subscription_id,
        diff: { to_plan: input.to_plan },
      });
      await emitEvent("plan_upgraded", {
        subscription_id: result.subscription_id,
        from_plan: result.from_plan,
        to_plan: input.to_plan,
        actor_user_id: ctx.req.actor.user_id,
        effective_at: new Date().toISOString(),
      });
      return result;
    }),

  downgrade: workspaceProcedure
    .input(z.object({ to_plan: Plan, reason_code: z.string().max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { downgradeSubscription } = await import("@funnel/billing").catch(() => ({ downgradeSubscription: null as never }));
      if (!downgradeSubscription) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await downgradeSubscription({
        workspace_id: ctx.req.workspaceId!,
        to_plan: input.to_plan,
        actor_user_id: ctx.req.actor.user_id,
        reason_code: input.reason_code,
      });
      await emitEvent("plan_downgraded", {
        subscription_id: result.subscription_id,
        from_plan: result.from_plan,
        to_plan: input.to_plan,
        actor_user_id: ctx.req.actor.user_id,
        effective_at: new Date().toISOString(),
        reason_code: input.reason_code,
      });
      return result;
    }),

  pause: workspaceProcedure
    .input(z.object({ resume_at: z.string().datetime().optional(), reason_code: z.string().max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { pauseSubscription } = await import("@funnel/billing").catch(() => ({ pauseSubscription: null as never }));
      if (!pauseSubscription) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await pauseSubscription({
        workspace_id: ctx.req.workspaceId!,
        actor_user_id: ctx.req.actor.user_id,
        resume_at: input.resume_at,
        reason_code: input.reason_code,
      });
      await emitEvent("plan_paused", {
        subscription_id: result.subscription_id,
        actor_user_id: ctx.req.actor.user_id,
        resume_at: input.resume_at,
        reason_code: input.reason_code,
      });
      return result;
    }),

  resume: workspaceProcedure.mutation(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const { resumeSubscription } = await import("@funnel/billing").catch(() => ({ resumeSubscription: null as never }));
    if (!resumeSubscription) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await resumeSubscription({
      workspace_id: ctx.req.workspaceId!,
      actor_user_id: ctx.req.actor.user_id,
    });
    await emitEvent("plan_resumed", {
      subscription_id: result.subscription_id,
      actor_user_id: ctx.req.actor.user_id,
    });
    return result;
  }),

  cancel: workspaceProcedure
    .input(z.object({ at_period_end: z.boolean().default(true), reason_code: z.string().max(120), feedback: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { cancelSubscription } = await import("@funnel/billing").catch(() => ({ cancelSubscription: null as never }));
      if (!cancelSubscription) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await cancelSubscription({
        workspace_id: ctx.req.workspaceId!,
        actor_user_id: ctx.req.actor.user_id,
        at_period_end: input.at_period_end,
        reason_code: input.reason_code,
        feedback: input.feedback,
      });
      await emitEvent("subscription_canceled", {
        subscription_id: result.subscription_id,
        actor_user_id: ctx.req.actor.user_id,
        effective_at: result.effective_at,
        reason_code: input.reason_code,
      });
      return result;
    }),

  listInvoices: workspaceProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        const items = await tx.invoice.findMany({
          where: {
            workspace_id: ctx.req.workspaceId!,
            ...(input.cursor ? { id: { lt: input.cursor } } : {}),
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

  getInvoice: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const inv = await tx.invoice.findFirst({
        where: { id: input.id, workspace_id: ctx.req.workspaceId! },
      });
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      return inv;
    });
  }),

  /** Open the processor-hosted customer portal (Stripe Billing Portal / PayPal subscription mgmt). */
  customerPortalUrl: workspaceProcedure.query(async ({ ctx }) => {
    const { customerPortalUrl } = await import("@funnel/billing").catch(() => ({ customerPortalUrl: null as never }));
    if (!customerPortalUrl) return { url: `${ctx.env.WEB_PUBLIC_URL}/settings/billing` };
    return { url: await customerPortalUrl({ workspace_id: ctx.req.workspaceId! }) };
  }),
});
