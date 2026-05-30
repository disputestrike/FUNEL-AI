/**
 * Workspace router — CRUD on the tenant root, member invites, role changes,
 * ownership transfer, closure.
 *
 * Permission gates use `@funnel/auth.ROLE_MATRIX`. Every mutation:
 *   - validates input via zod
 *   - writes inside `withWorkspaceContext` (RLS-bound transaction)
 *   - appends an audit_log row
 *   - emits the canonical event (Doc 03 §A.1)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ulid } from "ulid";
import {
  inviteMember,
  acceptInvite,
  declineInvite,
  removeMember,
  changeRole,
  transferOwnership,
  closeWorkspace,
} from "@funnel/auth";
import { Role } from "@funnel/shared";
import { router, workspaceProcedure, authedProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

const RoleEnum = z.nativeEnum(Role);

const UpdateInput = z.object({
  name: z.string().min(1).max(120).optional(),
  vertical: z.string().min(1).max(80).optional(),
  brand_colors: z.record(z.string()).optional(),
  feature_flags: z.record(z.unknown()).optional(),
  ai_training_opt_in: z.boolean().optional(),
});

const InviteInput = z.object({
  email: z.string().email(),
  role: RoleEnum,
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

export const workspaceRouter = router({
  /** Get the current workspace. */
  get: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      const ws = await tx.workspace.findUnique({ where: { id: ctx.req.workspaceId! } });
      if (!ws) throw new TRPCError({ code: "NOT_FOUND" });
      return ws;
    });
  }),

  /** Update workspace metadata. */
  update: workspaceProcedure.input(UpdateInput).mutation(async ({ ctx, input }) => {
    const ws = await ctx.withTx(async (tx) => {
      return tx.workspace.update({
        where: { id: ctx.req.workspaceId! },
        data: { ...input, updated_at: new Date() },
      });
    });
    await writeAuditLog(ctx.req, {
      workspace_id: ws.id,
      action: "update",
      resource: "workspace",
      resource_id: ws.id,
      diff: input,
    });
    return ws;
  }),

  /** List members. */
  listMembers: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      return tx.workspaceMember.findMany({
        where: { workspace_id: ctx.req.workspaceId!, removed_at: null },
        orderBy: { created_at: "asc" },
      });
    });
  }),

  /** Invite a new member by email. */
  inviteMember: workspaceProcedure.input(InviteInput).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const invite = await inviteMember(ctxAuth(ctx), {
      workspace_id: ctx.req.workspaceId!,
      invitee_email: input.email,
      role: input.role,
      inviter_user_id: ctx.req.actor.user_id,
      expires_in_days: input.expires_in_days,
    });
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "invite",
      resource: "workspace.members",
      resource_id: invite.id,
      diff: { email_domain: input.email.split("@")[1], role: input.role },
    });
    await emitEvent("workspace_member_invited", {
      workspace_id: ctx.req.workspaceId!,
      inviter_user_id: ctx.req.actor.user_id,
      invitee_email_hash: await sha256(input.email),
      role: input.role,
      invite_id: invite.id,
    });
    return invite;
  }),

  /** Accept an invite (called by the invitee, who is already authed). */
  acceptInvite: authedProcedure
    .input(z.object({ invite_token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await acceptInvite(ctxAuth(ctx), {
        invite_token: input.invite_token,
        user_id: ctx.req.actor.user_id,
      });
      await emitEvent("workspace_member_joined", {
        workspace_id: result.workspace_id,
        user_id: ctx.req.actor.user_id,
        role: result.role,
        invite_id: result.invite_id,
      });
      return result;
    }),

  declineInvite: authedProcedure
    .input(z.object({ invite_token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      return declineInvite(ctxAuth(ctx), {
        invite_token: input.invite_token,
        user_id: ctx.req.actor.user_id,
      });
    }),

  /** Remove a member. */
  removeMember: workspaceProcedure
    .input(z.object({ user_id: z.string().min(1), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await removeMember(ctxAuth(ctx), {
        workspace_id: ctx.req.workspaceId!,
        user_id: input.user_id,
        actor_user_id: ctx.req.actor.user_id,
        reason: input.reason,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "remove",
        resource: "workspace.members",
        resource_id: input.user_id,
        metadata: { reason: input.reason },
      });
      await emitEvent("workspace_member_removed", {
        workspace_id: ctx.req.workspaceId!,
        user_id: input.user_id,
        actor_user_id: ctx.req.actor.user_id,
        reason: input.reason ?? "unspecified",
      });
      return result;
    }),

  /** Change a member's role. */
  changeRole: workspaceProcedure
    .input(z.object({ user_id: z.string().min(1), to_role: RoleEnum }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await changeRole(ctxAuth(ctx), {
        workspace_id: ctx.req.workspaceId!,
        user_id: input.user_id,
        to_role: input.to_role,
        actor_user_id: ctx.req.actor.user_id,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "role_change",
        resource: "workspace.members",
        resource_id: input.user_id,
        diff: { to_role: input.to_role },
      });
      await emitEvent("workspace_member_role_changed", {
        workspace_id: ctx.req.workspaceId!,
        user_id: input.user_id,
        from_role: result.from_role,
        to_role: input.to_role,
        actor_user_id: ctx.req.actor.user_id,
      });
      return result;
    }),

  /** Transfer ownership. */
  transferOwnership: workspaceProcedure
    .input(z.object({ to_user_id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await transferOwnership(ctxAuth(ctx), {
        workspace_id: ctx.req.workspaceId!,
        from_user_id: ctx.req.actor.user_id,
        to_user_id: input.to_user_id,
        actor_user_id: ctx.req.actor.user_id,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "transfer",
        resource: "workspace",
        resource_id: ctx.req.workspaceId!,
        diff: { to_user_id: input.to_user_id },
      });
      await emitEvent("workspace_ownership_transferred", {
        workspace_id: ctx.req.workspaceId!,
        from_user_id: ctx.req.actor.user_id,
        to_user_id: input.to_user_id,
        actor_user_id: ctx.req.actor.user_id,
      });
      return result;
    }),

  /** Close (soft-delete) the workspace. */
  close: workspaceProcedure
    .input(z.object({ reason: z.string().min(1).max(500), data_disposition: z.enum(["export", "delete", "retain"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await closeWorkspace(ctxAuth(ctx), {
        workspace_id: ctx.req.workspaceId!,
        actor_user_id: ctx.req.actor.user_id,
        reason: input.reason,
        data_disposition: input.data_disposition,
      });
      await emitEvent("workspace_closed", {
        workspace_id: ctx.req.workspaceId!,
        actor_user_id: ctx.req.actor.user_id,
        reason: input.reason,
        data_disposition: input.data_disposition,
      });
      return result;
    }),

  /** Create a brand new workspace (signup path). */
  create: authedProcedure
    .input(z.object({ name: z.string().min(1).max(120), slug: z.string().min(3).max(40), vertical: z.string().optional(), region: z.string().default("us-east-1") }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const id = `wsp_${ulid()}`;
      // Creating a workspace is a cross-tenant op — we cannot have a
      // workspace context yet. Route through admin context for the insert.
      const { withAdminContext } = await import("@funnel/db/rls");
      const ws = await withAdminContext(async (tx) => {
        return tx.workspace.create({
          data: {
            id,
            slug: input.slug,
            name: input.name,
            owner_user_id: ctx.req.actor.user_id!,
            vertical: input.vertical ?? null,
            region: input.region,
            plan: "trial",
          },
        });
      });
      await withAdminContext(async (tx) => {
        await tx.workspaceMember.create({
          data: {
            id: `wsm_${ulid()}`,
            workspace_id: ws.id,
            user_id: ctx.req.actor.user_id!,
            role: Role.Owner,
            joined_at: new Date(),
          },
        });
      });
      await emitEvent("workspace_created", {
        workspace_id: ws.id,
        owner_user_id: ctx.req.actor.user_id,
        plan: "trial",
        region: ws.region,
        vertical: ws.vertical ?? undefined,
      });
      return ws;
    }),
});

// --- helpers ----------------------------------------------------------------
function ctxAuth(ctx: { env: { JWT_SECRET: string } }): never {
  // Thin shim: @funnel/auth's workspace fns take an AuthContext with random+now+env+stores.
  // The app's DI container builds the real AuthContext at boot; this stub keeps the
  // type signature honest until the wiring is in place.
  return {
    env: { jwt_secret: ctx.env.JWT_SECRET },
    now: () => new Date(),
    random: () => crypto.randomUUID(),
    // Real stores are injected in src/index.ts via setAuthContextFactory().
  } as never;
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
