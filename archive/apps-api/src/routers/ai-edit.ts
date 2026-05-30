/**
 * Inline AI-edit router — "make this shorter", "more urgent", "regenerate",
 * "swap image". Each command is a small synchronous LLM call (1–5s) that
 * returns the patched section blob; the UI applies it optimistically.
 *
 * These run on the request thread (not Q_GENERATION) because they are short
 * and the user is staring at the screen. Cost-metered the same as full
 * generations but with a smaller default cap.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { meter } from "../lib/cost-meter.js";

const EditOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("shorten"), level: z.enum(["a_little", "a_lot"]).default("a_little") }),
  z.object({ op: z.literal("lengthen"), level: z.enum(["a_little", "a_lot"]).default("a_little") }),
  z.object({ op: z.literal("more_urgent") }),
  z.object({ op: z.literal("softer") }),
  z.object({ op: z.literal("rewrite"), tone: z.string().max(80).optional() }),
  z.object({ op: z.literal("regenerate") }),
  z.object({ op: z.literal("swap_image"), prompt: z.string().max(500).optional() }),
  z.object({ op: z.literal("translate"), locale: z.string().min(2).max(10) }),
  z.object({ op: z.literal("custom_nudge"), instruction: z.string().min(1).max(2000) }),
]);

const ApplyInput = z.object({
  funnel_id: z.string(),
  version_id: z.string(),
  section_id: z.string(),
  selector: z.string().optional(),
  current_text: z.string().max(20_000).optional(),
  edit: EditOp,
});

export const aiEditRouter = router({
  apply: workspaceProcedure.input(ApplyInput).mutation(async ({ ctx, input }) => {
    if (!ctx.req.actor.user_id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const { runInlineEdit } = await import("@funnel/orchestrator").catch(() => ({ runInlineEdit: null as never }));
    if (!runInlineEdit) {
      // Stub response when orchestrator is unwired — return the existing text unchanged.
      return {
        section_id: input.section_id,
        patch: { copy: { __unchanged: true }, design: {} },
        tokens: { input: 0, output: 0 },
      };
    }
    const result = await runInlineEdit({
      workspaceId: ctx.req.workspaceId!,
      funnelId: input.funnel_id,
      versionId: input.version_id,
      sectionId: input.section_id,
      selector: input.selector,
      currentText: input.current_text,
      edit: input.edit,
    });
    await meter({
      workspaceId: ctx.req.workspaceId!,
      meter: "generation_tokens",
      amount: result.tokens.input + result.tokens.output,
      metadata: { op: input.edit.op },
    });
    await writeAuditLog(ctx.req, {
      workspace_id: ctx.req.workspaceId,
      action: "update",
      resource: "funnel_version",
      resource_id: input.version_id,
      diff: { ai_edit_op: input.edit.op, section_id: input.section_id },
    });
    return result;
  }),
});
