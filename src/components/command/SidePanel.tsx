"use client";

/**
 * GoFunnelAI — Command Center side panel.
 *
 * Slides in from the right while the AI is generating something. Three
 * tabs auto-switch based on the active panelTab the SSE stream emits:
 *
 *   funnel    → live FunnelPreviewRenderer fed from streaming JSON
 *   campaign  → mini Launch Center with the 11 sub-views
 *   asset     → single asset regeneration preview
 *
 * The 11 Launch Center sub-views (Strategy → Platforms → Audiences → Copy
 * → Images → Videos → Links → Follow-Up → Tracking → Compliance → Score)
 * progressively fill as preview events arrive. A header CTA jumps the user
 * to the full Launch Center detail page once a campaignId is known.
 */
import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------
 * Public types
 * ----------------------------------------------------------------------- */

export type SidePanelTab = "funnel" | "campaign" | "asset" | "analytics";

export interface SidePanelState {
  open: boolean;
  activeTab: SidePanelTab;
  /** Sparse map: panelTab.slot → last preview payload. */
  previews: Record<string, unknown>;
  /** Agents currently running (display in header). */
  runningAgents: Array<{ agent: string; label: string; emoji: string }>;
  /** When known, lets us deep-link "Open in full Launch Center". */
  campaignId?: string;
  funnelId?: string;
}

export interface SidePanelProps extends SidePanelState {
  onClose: () => void;
  onTabChange: (tab: SidePanelTab) => void;
}

/* -------------------------------------------------------------------------
 * Launch Center sub-view spec
 * ----------------------------------------------------------------------- */

const LAUNCH_TABS: Array<{
  slot: string;
  label: string;
  emoji: string;
}> = [
  { slot: "strategy", label: "Strategy", emoji: "🎯" },
  { slot: "platforms", label: "Platforms", emoji: "📡" },
  { slot: "audiences", label: "Audiences", emoji: "👥" },
  { slot: "copy", label: "Copy", emoji: "✍️" },
  { slot: "images", label: "Images", emoji: "🎨" },
  { slot: "videos", label: "Videos", emoji: "🎬" },
  { slot: "links", label: "Links", emoji: "🔗" },
  { slot: "followup", label: "Follow-Up", emoji: "📬" },
  { slot: "tracking", label: "Tracking", emoji: "📊" },
  { slot: "compliance", label: "Compliance", emoji: "🛡️" },
  { slot: "score", label: "Score", emoji: "⭐" },
];

/* -------------------------------------------------------------------------
 * Component
 * ----------------------------------------------------------------------- */

export function SidePanel({
  open,
  activeTab,
  previews,
  runningAgents,
  campaignId,
  funnelId,
  onClose,
  onTabChange,
}: SidePanelProps) {
  return (
    <aside
      aria-label="Currently building"
      data-testid="command-side-panel"
      data-open={open || undefined}
      className={cn(
        "fixed bottom-0 right-0 top-16 z-30 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl transition-transform",
        "sm:w-[420px] lg:w-[480px]",
        // Mobile: bottom-sheet — slide up. Desktop: side panel — slide left.
        "data-[open]:translate-x-0 data-[open]:translate-y-0",
        open ? "translate-x-0" : "translate-x-full sm:translate-x-full",
      )}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          {runningAgents.length > 0 && (
            <Loader2 className="size-4 animate-spin text-signal-600" />
          )}
          <span className="text-body-sm font-semibold text-slate-900">
            {runningAgents.length > 0
              ? (runningAgents.at(-1)?.label ?? "Working")
              : "Preview"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "campaign" && campaignId && (
            <Link
              href={`/dashboard/campaigns/${campaignId}`}
              data-testid="open-full-launch-center"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-caption font-medium text-slate-700 hover:bg-slate-50"
            >
              Open in full Launch Center <ExternalLink className="size-3.5" />
            </Link>
          )}
          {activeTab === "funnel" && funnelId && (
            <Link
              href={`/dashboard/funnels/${funnelId}/preview`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-caption font-medium text-slate-700 hover:bg-slate-50"
            >
              Open funnel <ExternalLink className="size-3.5" />
            </Link>
          )}
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Tab strip */}
      <div role="tablist" className="flex border-b border-slate-200 bg-slate-50">
        {(["funnel", "campaign", "asset"] as SidePanelTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => onTabChange(t)}
            className={cn(
              "flex-1 px-3 py-2 text-caption font-semibold capitalize transition",
              activeTab === t
                ? "border-b-2 border-signal-600 bg-white text-signal-700"
                : "text-slate-500 hover:bg-white hover:text-slate-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "funnel" && <FunnelTab previews={previews} />}
        {activeTab === "campaign" && (
          <CampaignTab previews={previews} runningAgents={runningAgents} />
        )}
        {activeTab === "asset" && <AssetTab previews={previews} />}
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------
 * Tab renderers
 * ----------------------------------------------------------------------- */

function FunnelTab({ previews }: { previews: Record<string, unknown> }) {
  const summary = previews["funnel.summary"] as
    | {
        funnelId?: string;
        title?: string;
        industry?: string;
        goal?: string;
        audience?: string;
        qualityScore?: number;
        previewUrl?: string;
      }
    | undefined;
  if (!summary) {
    return <EmptyHint text="Type a prompt to start building. The preview lands here as the agents finish." />;
  }
  return (
    <div className="space-y-4" data-testid="funnel-preview-tab">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
          Funnel
        </div>
        <div className="mt-1 text-h4 font-semibold text-slate-900">
          {summary.title}
        </div>
        {summary.qualityScore != null && (
          <div className="mt-2 inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-caption font-semibold text-emerald-700">
            Quality {summary.qualityScore}/100
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-caption">
          <div>
            <dt className="text-slate-500">Industry</dt>
            <dd className="font-medium text-slate-900">{summary.industry}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Goal</dt>
            <dd className="font-medium text-slate-900">{summary.goal}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500">Audience</dt>
            <dd className="font-medium text-slate-900">{summary.audience}</dd>
          </div>
        </dl>
      </div>
      <PreviewPlaceholder
        title="Hero preview"
        body="Live FunnelPreviewRenderer hot-reloads here as sections finish."
      />
    </div>
  );
}

function CampaignTab({
  previews,
  runningAgents,
}: {
  previews: Record<string, unknown>;
  runningAgents: SidePanelProps["runningAgents"];
}) {
  const runningSlots = new Set(runningAgents.map((a) => a.agent));
  return (
    <div className="space-y-2" data-testid="campaign-preview-tab">
      <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
        Mini Launch Center
      </div>
      <ul className="space-y-1.5">
        {LAUNCH_TABS.map((t) => {
          const payload = previews[`campaign.${t.slot}`];
          const done = payload != null;
          const running =
            !done &&
            runningSlots.has(slotToAgent(t.slot));
          return (
            <li
              key={t.slot}
              data-testid={`launch-tab-${t.slot}`}
              data-status={done ? "done" : running ? "running" : "pending"}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-caption",
                done
                  ? "border-emerald-200 bg-emerald-50"
                  : running
                    ? "border-signal-200 bg-signal-50"
                    : "border-slate-200 bg-white",
              )}
            >
              <span aria-hidden className="text-base leading-none">
                {t.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    {t.label}
                  </span>
                  <SlotStatus done={done} running={running} />
                </div>
                {done && (
                  <SlotPreview slot={t.slot} payload={payload} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssetTab({ previews }: { previews: Record<string, unknown> }) {
  const assets = previews["asset.asset_grid"] as
    | Array<{ id: string; url: string; kind: "image" | "video"; label?: string }>
    | undefined;
  if (!assets || assets.length === 0) {
    return (
      <EmptyHint text="Single-asset regenerations preview here — pick winners, then approve." />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {assets.map((a) => (
        <div
          key={a.id}
          className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        >
          {a.kind === "image" && a.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.url}
              alt={a.label ?? "asset"}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-caption text-slate-500">
              {a.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Small parts
 * ----------------------------------------------------------------------- */

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="text-body-sm text-slate-500">{text}</div>
    </div>
  );
}

function PreviewPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
      <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-body-sm text-slate-600">{body}</div>
    </div>
  );
}

function SlotStatus({ done, running }: { done: boolean; running: boolean }) {
  if (done) {
    return (
      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        Ready
      </span>
    );
  }
  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-signal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-700">
        <Loader2 className="size-2.5 animate-spin" /> Running
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      Queued
    </span>
  );
}

function SlotPreview({
  slot,
  payload,
}: {
  slot: string;
  payload: unknown;
}) {
  switch (slot) {
    case "strategy": {
      const p = payload as {
        campaignName?: string;
        objective?: string;
        primaryCta?: string;
      };
      return (
        <div className="mt-1 text-caption text-slate-600">
          <div className="font-medium text-slate-800">{p.campaignName}</div>
          <div>CTA: {p.primaryCta}</div>
        </div>
      );
    }
    case "platforms": {
      const p = payload as Array<{
        platform: string;
        fitScore: number;
        budgetDaily: number;
      }>;
      return (
        <ul className="mt-1 space-y-0.5 text-caption text-slate-600">
          {p.map((row) => (
            <li key={row.platform} className="flex justify-between">
              <span className="capitalize">{row.platform}</span>
              <span>
                {row.fitScore}/100 · ${row.budgetDaily}/d
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "score": {
      const p = payload as { overall: number };
      return (
        <div className="mt-1 text-h4 font-semibold text-emerald-700">
          {p.overall}/100
        </div>
      );
    }
    case "copy": {
      const p = payload as Array<{ headline: string }>;
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.length} ad variants ready
        </div>
      );
    }
    case "images": {
      const p = payload as unknown[];
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.length} image variants
        </div>
      );
    }
    case "videos": {
      const p = payload as unknown[];
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.length} video scripts
        </div>
      );
    }
    case "links": {
      const p = payload as unknown[];
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.length} UTM links
        </div>
      );
    }
    case "followup": {
      const p = payload as { steps?: unknown[] };
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.steps?.length ?? 0} follow-up steps
        </div>
      );
    }
    case "tracking": {
      const p = payload as { events?: unknown[] };
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.events?.length ?? 0} events wired
        </div>
      );
    }
    case "compliance": {
      const p = payload as { severity?: string };
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.severity === "info" ? "No blockers" : `Severity: ${p.severity}`}
        </div>
      );
    }
    case "audiences": {
      const p = payload as unknown[];
      return (
        <div className="mt-1 text-caption text-slate-600">
          {p.length} audience profiles
        </div>
      );
    }
    default:
      return null;
  }
}

function slotToAgent(slot: string): string {
  switch (slot) {
    case "platforms":
      return "platform-rec";
    case "audiences":
      return "audience-targeting";
    case "images":
      return "image-creative";
    case "videos":
      return "video-script";
    case "links":
      return "utm";
    case "tracking":
      return "tracking-setup";
    case "compliance":
      return "ad-policy";
    default:
      return slot;
  }
}
