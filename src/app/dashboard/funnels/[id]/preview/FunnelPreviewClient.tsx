"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FunnelPreviewRenderer,
  MobilePreviewToggle,
  SectionEditDialog,
  type EditAction,
  type FunnelRendererMode,
  type PreviewViewport,
} from "@funnel/ui";

import { automatedFunnelToRenderer } from "@/lib/funnels/automated-to-renderer";

type AnyAutomatedFunnel = Parameters<typeof automatedFunnelToRenderer>[0];

export interface FunnelPreviewClientProps {
  funnel: AnyAutomatedFunnel;
  /**
   * DB funnel id used by the section-edit endpoint. When absent (legacy
   * in-memory store), edits are no-ops on the server but the dialog still
   * opens for visual testing.
   */
  dbFunnelId?: string;
  mode: FunnelRendererMode;
}

export function FunnelPreviewClient({ funnel, dbFunnelId, mode }: FunnelPreviewClientProps) {
  const { funnel: rendererFunnel, pageIds } = useMemo(
    () => automatedFunnelToRenderer(funnel),
    [funnel]
  );
  // We keep an editable copy of the rendered funnel so we can hot-update
  // sections in place after an AI edit lands.
  const [hotFunnel, setHotFunnel] = useState(rendererFunnel);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionType, setEditingSectionType] = useState<string | undefined>(undefined);
  const [initialAction, setInitialAction] = useState<EditAction>("open");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [streaming, setStreaming] = useState<{ phase?: string; pct?: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleEditSection(sectionId: string, action: EditAction) {
    setEditingSectionId(sectionId);
    setInitialAction(action);
    // Find section type for the dialog header.
    const section = findSectionAcrossPages(hotFunnel, sectionId);
    setEditingSectionType(section?.type);
    setDialogOpen(true);
  }

  const applyPatchedSection = useCallback(
    (sectionId: string, newSection: Record<string, unknown>) => {
      setHotFunnel((cur) => {
        const next = { ...cur, pages: cur.pages.map((p) => ({ ...p, sections: [...p.sections] })) };
        for (const page of next.pages) {
          const idx = page.sections.findIndex((s) => s.id === sectionId);
          if (idx >= 0) {
            page.sections[idx] = {
              ...page.sections[idx],
              ...(newSection as Record<string, unknown>),
            } as (typeof page.sections)[number];
            break;
          }
        }
        return next;
      });
    },
    []
  );

  const submitEdit = useCallback(
    async ({
      sectionId,
      action,
      instruction,
    }: {
      sectionId: string;
      action: EditAction;
      instruction: string;
    }) => {
      setStreaming({ phase: "starting", pct: 0 });
      setErrorMsg(null);

      const funnelIdForApi = dbFunnelId ?? funnel.id;
      try {
        const res = await fetch(
          `/api/funnels/${encodeURIComponent(funnelIdForApi)}/sections/${encodeURIComponent(sectionId)}/edit`,
          {
            method: "POST",
            headers: { "content-type": "application/json", accept: "text/event-stream" },
            body: JSON.stringify({ action, instruction }),
          }
        );
        if (!res.ok || !res.body) {
          const fallback = await res.text().catch(() => "");
          setErrorMsg(`Edit failed (${res.status}). ${fallback.slice(0, 200)}`);
          setStreaming(null);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const ev of events) {
            const line = ev.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
              const type = payload.type as string;
              if (type === "progress") {
                setStreaming({
                  phase: String(payload.phase ?? ""),
                  pct: Number(payload.pct ?? 0),
                });
              } else if (type === "patch") {
                const newSection = payload.section as Record<string, unknown> | undefined;
                if (newSection && typeof newSection.id === "string") {
                  applyPatchedSection(newSection.id, newSection);
                }
              } else if (type === "error") {
                setErrorMsg(String(payload.error ?? "Edit failed"));
              } else if (type === "done") {
                setStreaming(null);
              }
            } catch {
              /* swallow malformed SSE frames */
            }
          }
        }
        setStreaming(null);
      } catch (err) {
        setErrorMsg(String(err));
        setStreaming(null);
      }
    },
    [applyPatchedSection, dbFunnelId, funnel.id]
  );

  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-marketing flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            {pageIds.length > 1 && (
              <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs">
                {pageIds.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePageIdx(i)}
                    className={
                      "rounded px-2 py-1 font-medium " +
                      (activePageIdx === i ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Page {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {streaming && (
              <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-medium text-signal-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-signal-500" />
                {streaming.phase ?? "rewriting"}
                {typeof streaming.pct === "number" ? ` · ${streaming.pct}%` : ""}
              </span>
            )}
            <MobilePreviewToggle value={viewport} onChange={setViewport} />
          </div>
        </div>
        {errorMsg && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            {errorMsg}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-marketing px-4 py-6">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
          <FunnelPreviewRenderer
            funnel={hotFunnel}
            mode={mode}
            activePageId={pageIds[activePageIdx]}
            mobileFrame={viewport === "mobile"}
            onEditSection={handleEditSection}
            brandTokens={hotFunnel.brand_tokens}
          />
        </div>
      </div>

      <SectionEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectionId={editingSectionId}
        sectionType={editingSectionType}
        initialAction={initialAction}
        onSubmit={submitEdit}
      />
    </>
  );
}

type RendererFunnelLike = ReturnType<typeof automatedFunnelToRenderer>["funnel"];

function findSectionAcrossPages(
  funnel: RendererFunnelLike,
  sectionId: string
): { id: string; type: string } | undefined {
  for (const page of funnel.pages) {
    const hit = page.sections.find((s) => s.id === sectionId);
    if (hit) return { id: hit.id, type: hit.type };
  }
  return undefined;
}
