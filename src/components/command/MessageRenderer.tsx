"use client";

/**
 * GoFunnelAI — assistant-message renderer for the Command Center chat.
 *
 * Assistant turns are arrays of typed blocks (see
 * `lib/command/conversation-store.ts:AssistantMessageBlock`). This component
 * dispatches each block to the right sub-renderer:
 *
 *   text             → mini markdown (bold/italic/code/lists/line-breaks)
 *   funnel_preview   → FunnelPreviewCard (title, score chip, open button)
 *   campaign_summary → CampaignSummaryCard (objective, platforms, score, open)
 *   asset_grid       → AssetThumbnailGrid (4-up, regen on hover)
 *   action_chips     → ActionChips (approve / regenerate / open / mark)
 *   readiness_score  → LaunchReadinessBadge (overall + sub-score hover)
 *
 * Action chip clicks are bubbled up via `onAction` so the parent can either
 * send the implied follow-up prompt back through /api/command or perform a
 * client-side navigation (e.g. "Open in Launch Center").
 */
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import type { AssistantMessageBlock } from "@/lib/command/conversation-store";
import { cn } from "@/lib/cn";

export interface MessageRendererProps {
  blocks: AssistantMessageBlock[];
  onAction?: (
    action: string,
    payload?: Record<string, unknown>,
  ) => void;
}

export function MessageRenderer({ blocks, onAction }: MessageRendererProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockSwitch key={i} block={block} onAction={onAction} />
      ))}
    </div>
  );
}

function BlockSwitch({
  block,
  onAction,
}: {
  block: AssistantMessageBlock;
  onAction?: MessageRendererProps["onAction"];
}) {
  switch (block.type) {
    case "text":
      return <TextBlock markdown={block.markdown} />;
    case "funnel_preview":
      return <FunnelPreviewCard {...block} onAction={onAction} />;
    case "campaign_summary":
      return <CampaignSummaryCard {...block} onAction={onAction} />;
    case "asset_grid":
      return <AssetThumbnailGrid assets={block.assets} onAction={onAction} />;
    case "action_chips":
      return <ActionChips chips={block.chips} onAction={onAction} />;
    case "readiness_score":
      return <LaunchReadinessBadge {...block} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------
 * Text — minimal markdown (no external dep)
 * ----------------------------------------------------------------------- */

function TextBlock({ markdown }: { markdown: string }) {
  // Tiny markdown: **bold**, *italic*, `code`, bullet lines, paragraph
  // breaks. We avoid pulling in a markdown library to keep the chat
  // bundle skinny — assistant outputs are kept simple by design.
  const html = renderInlineMarkdown(markdown);
  return (
    <div
      className="prose prose-sm max-w-none text-body text-slate-900 leading-relaxed [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderInlineMarkdown(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Split into paragraphs on blank lines.
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      // Bullet list block?
      const lines = p.split("\n");
      const allBullet = lines.every((l) => /^\s*-\s+/.test(l));
      if (allBullet && lines.length > 0) {
        return (
          "<ul class='list-disc pl-5 space-y-1'>" +
          lines
            .map((l) => `<li>${inlineMd(l.replace(/^\s*-\s+/, ""))}</li>`)
            .join("") +
          "</ul>"
        );
      }
      return `<p>${inlineMd(p).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function inlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/* -------------------------------------------------------------------------
 * Funnel preview card
 * ----------------------------------------------------------------------- */

function FunnelPreviewCard({
  funnelId,
  title,
  qualityScore,
  previewUrl,
  thumbnailUrl,
  onAction,
}: Extract<AssistantMessageBlock, { type: "funnel_preview" }> & {
  onAction?: MessageRendererProps["onAction"];
}) {
  return (
    <div
      data-testid="funnel-preview-card"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-signal-50 text-signal-600">
          <Target className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-body font-semibold text-slate-900">
              {title}
            </div>
            {qualityScore != null && (
              <ScoreChip score={qualityScore} label="Quality" />
            )}
          </div>
          <div className="mt-0.5 text-caption text-slate-500">
            Draft funnel · ready to review
          </div>
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="mt-3 aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {previewUrl && (
              <Link
                href={previewUrl}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-caption font-medium text-slate-700 hover:bg-slate-50"
              >
                Open preview <ArrowRight className="size-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => onAction?.("regenerate", { funnelId })}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-caption font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="size-3.5" /> Try another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Campaign summary card
 * ----------------------------------------------------------------------- */

function CampaignSummaryCard({
  campaignId,
  name,
  objective,
  platforms,
  readinessScore,
  onAction,
}: Extract<AssistantMessageBlock, { type: "campaign_summary" }> & {
  onAction?: MessageRendererProps["onAction"];
}) {
  return (
    <div
      data-testid="campaign-summary-card"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-body font-semibold text-slate-900">
              {name}
            </div>
            {readinessScore != null && (
              <ScoreChip score={readinessScore} label="Readiness" />
            )}
          </div>
          <div className="mt-0.5 text-caption text-slate-500">
            Objective: <span className="font-medium text-slate-700">{objective}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-caption font-medium text-slate-700"
              >
                {p}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="open-launch-center"
              onClick={() =>
                onAction?.("open_launch_center", { campaignId })
              }
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-caption font-medium text-white hover:bg-slate-800"
            >
              Open in Launch Center <ExternalLink className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Asset grid (4-up)
 * ----------------------------------------------------------------------- */

function AssetThumbnailGrid({
  assets,
  onAction,
}: {
  assets: Array<{
    id: string;
    url: string;
    kind: "image" | "video";
    label?: string;
  }>;
  onAction?: MessageRendererProps["onAction"];
}) {
  return (
    <div
      data-testid="asset-thumbnail-grid"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {assets.map((a) => (
        <div
          key={a.id}
          className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
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
              {a.kind === "video" ? "Video script" : "Asset"}
            </div>
          )}
          {a.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-caption font-medium text-white">
              {a.label}
            </div>
          )}
          <button
            type="button"
            onClick={() => onAction?.("regenerate", { assetId: a.id })}
            className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-1 bg-white/90 py-1 text-caption font-medium text-slate-700 transition group-hover:translate-y-0"
          >
            <RefreshCcw className="size-3" /> Regenerate
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Action chips
 * ----------------------------------------------------------------------- */

function ActionChips({
  chips,
  onAction,
}: {
  chips: Extract<AssistantMessageBlock, { type: "action_chips" }>["chips"];
  onAction?: MessageRendererProps["onAction"];
}) {
  return (
    <div
      data-testid="action-chips"
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Suggested actions"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          data-action={chip.action}
          onClick={() => onAction?.(chip.action, chip.payload)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-caption font-medium transition",
            chip.action === "approve"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : chip.action === "regenerate"
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : chip.action === "mark_launched_externally"
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          {chip.action === "approve" && <CheckCircle2 className="size-3.5" />}
          {chip.action === "regenerate" && <RefreshCcw className="size-3.5" />}
          {chip.action === "open_launch_center" && (
            <ExternalLink className="size-3.5" />
          )}
          {chip.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Readiness badge with hover breakdown
 * ----------------------------------------------------------------------- */

function LaunchReadinessBadge({
  overall,
  breakdown,
}: Extract<AssistantMessageBlock, { type: "readiness_score" }>) {
  const [showBreakdown, setShow] = React.useState(false);
  const tone =
    overall >= 80
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : overall >= 60
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <button
        type="button"
        data-testid="readiness-badge"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-caption font-semibold",
          tone,
        )}
        aria-haspopup="true"
        aria-expanded={showBreakdown}
      >
        Launch readiness {overall}/100
      </button>
      {showBreakdown && (
        <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
            Sub-scores
          </div>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(breakdown).map(([k, v]) => (
              <li
                key={k}
                className="flex items-center justify-between text-caption text-slate-700"
              >
                <span>{formatAxisLabel(k)}</span>
                <span className="font-semibold text-slate-900">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreChip({ score, label }: { score: number; label: string }) {
  const tone =
    score >= 80
      ? "bg-emerald-50 text-emerald-700"
      : score >= 60
        ? "bg-amber-50 text-amber-800"
        : "bg-rose-50 text-rose-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold",
        tone,
      )}
      aria-label={`${label} ${score} out of 100`}
    >
      {score}
    </span>
  );
}

function formatAxisLabel(axis: string): string {
  return axis
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
