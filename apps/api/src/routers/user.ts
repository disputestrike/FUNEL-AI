/**
 * User router — profile, MFA, sessions, notification preferences.
 *
 * MFA enrollment + verification are delegated to @funnel/auth (TOTP +
 * WebAuthn). Session revocation reaches into the session store.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  changePassword,
  totpEnrollBegin,
  totpEnrollConfirm,
  totpDisable,
  webauthnRegistrationBegin,
  webauthnRegistrationVerify,
  revokeSession,
  revokeAllOtherSessions,
} from "@funnel/auth";
import { withAdminContext } from "@funnel/db/rls";
import { router, authedProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";

const ProfileUpdate = z.object({
  full_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(80).optional(),
});

const NotificationPrefs = z.object({
  product_updates: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
  lead_alerts: z.boolean().optional(),
  billing_alerts: z.boolean().optional(),
  security_alerts: z.boolean().optional(),
});

const ctxAuth = (env: { JWT_SECRET: string }) => ({
  env: { jwt_secret: env.JWT_SECRET },
  now: () => new Date(),
  random: () => crypto.randomUUID(),
}) as never;

export const userRouter = router({
  me: authedProcedure.query(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return withAdminContext(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: ctx.req.actor.user_id! },
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          locale: true,
          timezone: true,
          mfa_enrolled: true,
          mfa_factors: true,
          last_login_at: true,
          created_at: true,
        },
      });
      if (!u) throw new TRPCError({ code: "NOT_FOUND" });
      return u;
    });
  }),

  updateProfile: authedProcedure.input(ProfileUpdate).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const updated = await withAdminContext(async (tx) =>
      tx.user.update({
        where: { id: ctx.req.actor.user_id! },
        data: { ...input, updated_at: new Date() },
      }),
    );
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "update",
      resource: "user",
      resource_id: ctx.req.actor.user_id,
      diff: input,
    });
    return updated;
  }),

  changePassword: authedProcedure
    .input(z.object({ current_password: z.string().min(1), new_password: z.string().min(12).max(256) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const r = await changePassword(ctxAuth(ctx.env), {
        user_id: ctx.req.actor.user_id,
        current_password: input.current_password,
        new_password: input.new_password,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "password_change",
        resource: "user",
        resource_id: ctx.req.actor.user_id,
      });
      await emitEvent("user_password_changed", {
        user_id: ctx.req.actor.user_id,
        change_method: "self_service",
      });
      return r;
    }),

  // --- MFA -------------------------------------------------------------
  mfaTotpBegin: authedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return totpEnrollBegin(ctxAuth(ctx.env), { user_id: ctx.req.actor.user_id });
  }),

  mfaTotpConfirm: authedProcedure
    .input(z.object({ secret_id: z.string().min(1), otp: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const r = await totpEnrollConfirm(ctxAuth(ctx.env), {
        user_id: ctx.req.actor.user_id,
        secret_id: input.secret_id,
        otp: input.otp,
      });
      await emitEvent("user_mfa_enrolled", {
        user_id: ctx.req.actor.user_id,
        factor_type: "totp",
      });
      return r;
    }),

  mfaTotpDisable: authedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const r = await totpDisable(ctxAuth(ctx.env), {
        user_id: ctx.req.actor.user_id,
        password: input.password,
      });
      await emitEvent("user_mfa_disabled", {
        user_id: ctx.req.actor.user_id,
        factor_type: "totp",
      });
      return r;
    }),

  mfaWebauthnRegister: authedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return webauthnRegistrationBegin(ctxAuth(ctx.env), { user_id: ctx.req.actor.user_id });
  }),

  mfaWebauthnVerify: authedProcedure
    .input(z.object({ challenge_id: z.string(), attestation: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      return webauthnRegistrationVerify(ctxAuth(ctx.env), {
        user_id: ctx.req.actor.user_id,
        challenge_id: input.challenge_id,
        attestation: input.attestation,
      });
    }),

  // --- Sessions ---------------------------------------------------------
  listSessions: authedProcedure.query(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return withAdminContext(async (tx) =>
      tx.session.findMany({
        where: { user_id: ctx.req.actor.user_id!, revoked_at: null },
        select: {
          id: true,
          ip_hash: true,
          user_agent_class: true,
          created_at: true,
          last_seen_at: true,
          expires_at: true,
        },
        orderBy: { last_seen_at: "desc" },
      }),
    );
  }),

  revokeSession: authedProcedure.input(z.object({ session_id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return revokeSession(ctxAuth(ctx.env), {
      session_id: input.session_id,
      user_id: ctx.req.actor.user_id,
      reason: "user_action",
    });
  }),

  revokeAllOtherSessions: authedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return revokeAllOtherSessions(ctxAuth(ctx.env), {
      user_id: ctx.req.actor.user_id,
      keep_session_id: ctx.req.session?.id ?? "",
    });
  }),

  // --- Notification preferences -----------------------------------------
  getNotificationPrefs: authedProcedure.query(async ({ ctx }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return withAdminContext(async (tx) => {
      const prefs = await tx.userNotificationPreference?.findUnique?.({
        where: { user_id: ctx.req.actor.user_id! },
      }).catch(() => null);
      return (
        prefs ?? {
          user_id: ctx.req.actor.user_id,
          product_updates: true,
          weekly_digest: true,
          lead_alerts: true,
          billing_alerts: true,
          security_alerts: true,
        }
      );
    });
  }),

  setNotificationPrefs: authedProcedure.input(NotificationPrefs).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    return withAdminContext(async (tx) =>
      tx.userNotificationPreference?.upsert?.({
        where: { user_id: ctx.req.actor.user_id! },
        update: { ...input, updated_at: new Date() },
        create: { user_id: ctx.req.actor.user_id!, ...input },
      }),
    );
  }),
});
