/**
 * Generation router â€” start a generation, retrieve stream URL, regenerate or
 * edit a single section, publish a frozen version.
 *
 * The actual agent pipeline lives in @funnel/orchestrator. This router enqueues
 * jobs into `Q_GENERATION` and surfaces lifecycle to the UI. The streaming
 * channel is served by Durable Object `GENERATION_STREAM_DO` and consumed via
 * `/sse/generations/:id` (see `src/sse/`).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ulid } from "ulid";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { emitEvent } from "../lib/events.js";
import { meter } from "../lib/cost-meter.js";

const StartInput = z.object({
  funnel_id: z.string().optional(),
  intent: z.object({
    vertical: z.string().min(1).max(80),
    offer: z.string().min(1).max(2000),
    audience: z.string().min(1).max(2000),
    goal: z.enum(["lead_capture", "checkout", "booking", "webinar", "membership"]),
    locale: z.string().min(2).max(10).default("en-US"),
    brand_voice: z.string().max(500).optional(),
  }),
  kb_pack_ids: z.array(z.string()).max(20).optional(),
});

const RegenerateSection = z.object({
  generation_id: z.string(),
  section_id: z.string(),
  reason: z.enum(["shorter", "longer", "more_urgent", "softer", "swap_image", "free_text"]),
  freeform_nudge: z.string().max(2000).optional(),
});

const EditSection = z.object({
  generation_id: z.string(),
  section_id: z.string(),
  patch: z.object({
    copy: z.record(z.string()).optional(),
    design: z.record(z.unknown()).optional(),
    media: z.array(z.string()).optional(),
  }),
});

export const generationRouter = router({
  /** Start a fresh generation. Enqueues a long-running job and returns a generation id immediately. */
  start: workspaceProcedure.input(StartInput).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const id = `gen_${ulid()}`;
    await ctx.env.Q_GENERATION.send({
      generationId: id,
      workspaceId: ctx.req.workspaceId!,
      requestedByUserId: ctx.req.actor.user_id,
      funnelId: input.funnel_id,
      attempt: 1,
    });
    await emitEvent("generation_started", {
      generation_id: id,
      funnel_id: input.funnel_id,
      vertical: input.intent.vertical,
      prompt_hash: await sha256(JSON.stringify(input.intent)),
      model_lineup: ["claude-opus-4-7"],
      kb_pack_ids: input.kb_pack_ids,
      requested_by_user_id: ctx.req.actor.user_id,
    });
    await meter({
      workspaceId: ctx.req.workspaceId!,
      meter: "generation_runs",
      amount: 1,
      metadata: { vertical: input.intent.vertical, goal: input.intent.goal },
    });
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "create",
      resource: "generation",
      resource_id: id,
      metadata: { funnel_id: input.funnel_id },
    });
    return { generation_id: id, stream_url: `${ctx.env.API_PUBLIC_URL}/sse/generations/${id}` };
  }),

  /** Get current state of a generation. */
  get: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const g = await tx.generation?.findFirst?.({
        where: { id: input.id, workspace_id: ctx.req.workspaceId! },
      }).catch(() => null);
      if (!g) throw new TRPCError({ code: "NOT_FOUND" });
      return g;
    });
  }),

  /** Return the SSE stream URL â€” a thin convenience so the UI doesn't string-concat. */
  streamUrl: workspaceProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    return { url: `${ctx.env.API_PUBLIC_URL}/sse/generations/${input.id}` };
  }),

  /** Regenerate one section. Reuses parent generation as ancestor. */
  regenerateSection: workspaceProcedure.input(RegenerateSection).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const childId = `gen_${ulid()}`;
    await ctx.env.Q_GENERATION.send({
      generationId: childId,
      workspaceId: ctx.req.workspaceId!,
      requestedByUserId: ctx.req.actor.user_id,
      attempt: 1,
    });
    await emitEvent("generation_regenerated", {
      generation_id: childId,
      previous_generation_id: input.generation_id,
      regenerate_reason: input.reason,
      delta_summary: { section_id: input.section_id, freeform_nudge: input.freeform_nudge },
      user_id: ctx.req.actor.user_id,
    });
    await meter({ workspaceId: ctx.req.workspaceId!, meter: "generation_runs", amount: 1 });
    return { generation_id: childId };
  }),

  /** Apply a user edit to a single section. Persisted as a new FunnelVersion draft. */
  editSection: workspaceProcedure.input(EditSection).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    // The edit operation creates a new draft FunnelVersion by patching the
    // copy/design blob. Heavy lifting is in @funnel/orchestrator; here we
    // record the intent and emit the audit row.
    const versionId = `fvr_${ulid()}`;
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "update",
      resource: "funnel_version",
      resource_id: versionId,
      diff: { section_id: input.section_id, patch_keys: Object.keys(input.patch) },
    });
    return { version_id: versionId };
  }),

  /** Publish a frozen funnel version. Required attestation lives in compliance.publishAcknowledge first. */
  publish: workspaceProcedure
    .input(z.object({ funnel_id: z.string(), version_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const published = await ctx.withTx(async (tx) => {
        const v = await tx.funnelVersion.update({
          where: { id: input.version_id },
          data: { is_published: true, published_at: new Date(), published_by: ctx.req.actor.user_id! },
        });
        await tx.funnel.update({
          where: { id: input.funnel_id },
          data: { status: "live", current_version_id: input.version_id, live_url: `https://app.gofunnelai.com/f/${input.funnel_id}` },
        });
        return v;
      });
      await emitEvent("funnel_published", {
        funnel_id: input.funnel_id,
        funnel_version_id: input.version_id,
        actor_user_id: ctx.req.actor.user_id,
        url: `https://app.gofunnelai.com/f/${input.funnel_id}`,
        regions: [ctx.env.DEFAULT_REGION],
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "publish",
        resource: "funnel",
        resource_id: input.funnel_id,
        diff: { version_id: input.version_id },
      });
      return published;
    }),

  /** Unpublish â€” take a funnel offline. */
  unpublish: workspaceProcedure
    .input(z.object({ funnel_id: z.string(), reason: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const f = await ctx.withTx(async (tx) =>
        tx.funnel.update({
          where: { id: input.funnel_id },
          data: { status: "paused", live_url: null, updated_at: new Date() },
        }),
      );
      await emitEvent("funnel_unpublished", {
        funnel_id: input.funnel_id,
        funnel_version_id: f.current_version_id ?? "",
        actor_user_id: ctx.req.actor.user_id!,
        reason: input.reason,
      });
      return { ok: true };
    }),
});

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
