/**
 * POST /api/funnels/[id]/sections/[sectionId]/edit
 *
 * Re-runs single-section regeneration via the orchestrator's `runInlineEdit`
 * and streams progress back to the client as Server-Sent Events. On
 * completion the parent FunnelVersion's copy_blob is patched in place so the
 * preview hot-reloads with the new content.
 *
 * Body: { action: EditAction, instruction: string }
 *   EditAction = "regenerate" | "edit-copy" | "swap-image" | "make-shorter" | "open"
 *
 * Auth: session cookie (Clerk) + funnel must belong to current workspace.
 *
 * Stream events:
 *   data: { type: "started", section_id }
 *   data: { type: "progress", phase: "rewriting" | "image" | "qa", pct }
 *   data: { type: "patch", section: <new section JSON> }
 *   data: { type: "done", version_id }
 *   data: { type: "error", error }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspaceContext } from "@funnel/db";
import { runInlineEdit } from "@funnel/orchestrator";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EditActionEnum = z.enum([
  "regenerate",
  "edit-copy",
  "swap-image",
  "make-shorter",
  "open",
]);

const Body = z.object({
  action: EditActionEnum,
  instruction: z.string().max(2000).optional().default(""),
});

type SectionLike = {
  id: string;
  type?: string;
  content?: Record<string, unknown>;
  style_overrides?: Record<string, unknown>;
};

type CopyBlob = {
  pages?: Array<{ id?: string; sections?: SectionLike[] }>;
};

function actionToOp(action: z.infer<typeof EditActionEnum>): string {
  switch (action) {
    case "make-shorter":
      return "shorten";
    case "edit-copy":
      return "rewrite";
    case "swap-image":
      return "swap_image";
    case "regenerate":
      return "regenerate";
    default:
      return "rewrite";
  }
}

function findSection(copy: CopyBlob, sectionId: string): {
  section: SectionLike | null;
  pageIdx: number;
  sectionIdx: number;
} {
  const pages = copy.pages ?? [];
  for (let p = 0; p < pages.length; p++) {
    const sections = pages[p]?.sections ?? [];
    for (let s = 0; s < sections.length; s++) {
      if (sections[s]?.id === sectionId) {
        return { section: sections[s]!, pageIdx: p, sectionIdx: s };
      }
    }
  }
  return { section: null, pageIdx: -1, sectionIdx: -1 };
}

function extractCurrentText(section: SectionLike): string {
  const content = (section.content ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["eyebrow", "headline", "subhead", "body_markdown", "body", "title", "description"]) {
    const v = content[key];
    if (typeof v === "string") parts.push(v);
  }
  return parts.filter(Boolean).join("\n\n");
}

function applyPatchToSection(section: SectionLike, patch: { copy: Record<string, unknown> }): SectionLike {
  const newContent = { ...(section.content ?? {}) } as Record<string, unknown>;
  const newText = patch.copy?.text;
  if (typeof newText === "string") {
    // Heuristic: if the section has a headline, replace subhead; otherwise body.
    if ("headline" in newContent) {
      newContent.subhead = newText;
    } else if ("body_markdown" in newContent) {
      newContent.body_markdown = newText;
    } else {
      newContent.body = newText;
    }
  }
  return { ...section, content: newContent };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { action, instruction } = parsed.data;

  // Load + ownership-check the funnel.
  const funnel = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.funnel.findFirst({
      where: { id: params.id, deleted_at: null },
      include: { current_version: true },
    })
  );
  if (!funnel) {
    return NextResponse.json({ error: "funnel_not_found" }, { status: 404 });
  }
  if (!funnel.current_version_id || !funnel.current_version) {
    return NextResponse.json({ error: "no_current_version" }, { status: 400 });
  }

  const copy = (funnel.current_version.copy_blob ?? {}) as CopyBlob;
  const { section, pageIdx, sectionIdx } = findSection(copy, params.sectionId);
  if (!section) {
    return NextResponse.json({ error: "section_not_found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        send({ type: "started", section_id: params.sectionId });

        send({ type: "progress", phase: "rewriting", pct: 15 });

        const currentText = extractCurrentText(section);
        const op = actionToOp(action);

        const result = await runInlineEdit({
          workspaceId: session.workspace.id,
          funnelId: funnel.id,
          versionId: funnel.current_version_id!,
          sectionId: params.sectionId,
          currentText,
          edit: { op, instruction },
        });

        send({ type: "progress", phase: "rewriting", pct: 60 });

        if (action === "swap-image") {
          send({ type: "progress", phase: "image", pct: 80 });
        }

        const newSection = applyPatchToSection(section, result.patch);

        // Persist the patched section back to copy_blob.
        const newCopy: CopyBlob = JSON.parse(JSON.stringify(copy));
        if (newCopy.pages && newCopy.pages[pageIdx]?.sections) {
          newCopy.pages[pageIdx]!.sections![sectionIdx] = newSection;
        }

        await withWorkspaceContext(session.workspace.id, async (tx) => {
          await tx.funnelVersion.update({
            where: { id: funnel.current_version_id! },
            data: {
              copy_blob: newCopy as never,
              updated_at: new Date(),
            },
          });
        });

        send({ type: "progress", phase: "qa", pct: 95 });
        send({ type: "patch", section: newSection });
        send({
          type: "done",
          version_id: funnel.current_version_id,
          tokens: result.tokens,
        });
      } catch (err) {
        send({ type: "error", error: String(err instanceof Error ? err.message : err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
