"use client";

/**
 * Image gallery — grid + filter bar + bulk select + lightbox.
 *
 * Layout: 3-col on mobile / 4-col on desktop. Click a tile to open the
 * lightbox with prompt + license + Regenerate + Edit prompt + Download.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Loader2,
  Pencil,
  RefreshCcw,
  X,
} from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Asset {
  id: string;
  url: string;
  thumbnailUrl: string;
  type: string;
  format: string | null;
  prompt: string | null;
  brandScore: number | null;
  qualityScore: number | null;
  platform: string | null;
  angle: string | null;
  status: string;
  license: Record<string, unknown>;
  complianceFlags: Array<{ severity: string; message: string }>;
}

export function ImageGallery({
  campaignId,
  assets,
  platformLabels,
}: {
  campaignId: string;
  assets: Asset[];
  platformLabels: Record<string, string>;
}) {
  const { run, pending } = useLaunchMutation();
  const [platform, setPlatform] = useState<string>("all");
  const [angle, setAngle] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Asset | null>(null);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (platform !== "all" && a.platform !== platform) return false;
      if (angle !== "all" && a.angle !== angle) return false;
      if (status !== "all" && a.status !== status) return false;
      return true;
    });
  }, [assets, platform, angle, status]);

  const allPlatforms = Array.from(
    new Set(assets.map((a) => a.platform).filter((x): x is string => !!x)),
  );
  const allAngles = Array.from(
    new Set(assets.map((a) => a.angle).filter((x): x is string => !!x)),
  );
  const allStatuses = Array.from(new Set(assets.map((a) => a.status)));

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function exportZip() {
    const ids = Array.from(selected).join(",");
    window.location.href = `/api/launch/campaigns/${campaignId}/images.zip?ids=${ids}`;
  }

  async function regenerate(asset: Asset, newPrompt?: string) {
    await run(`/campaigns/${campaignId}/images/${asset.id}/regenerate`, {
      promptOverride: newPrompt ?? null,
    });
    setOpen(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill label="Platform" value={platform} onChange={setPlatform} options={["all", ...allPlatforms]} labels={platformLabels} />
        <Pill label="Angle" value={angle} onChange={setAngle} options={["all", ...allAngles]} />
        <Pill label="Status" value={status} onChange={setStatus} options={["all", ...allStatuses]} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {filtered.length} shown · {selected.size} selected
          </span>
          <button
            type="button"
            onClick={exportZip}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export ZIP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((a) => (
          <div
            key={a.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
          >
            <button
              type="button"
              onClick={() => setOpen(a)}
              className="block h-full w-full"
              aria-label="Open image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.thumbnailUrl}
                alt={a.prompt ?? "Generated creative"}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </button>
            <label className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() => toggleSelect(a.id)}
                className="h-3 w-3"
              />
              <span className="sr-only">Select</span>
            </label>
            <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
              {a.brandScore !== null ? (
                <ScoreChip label="Brand" score={a.brandScore} />
              ) : null}
              {a.qualityScore !== null ? (
                <ScoreChip label="Quality" score={a.qualityScore} />
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/80 to-transparent px-2 py-1.5 text-[10px] text-white">
              <span className="truncate">
                {a.platform ? platformLabels[a.platform] ?? a.platform : "—"}
                {a.format ? ` · ${a.format}` : ""}
              </span>
              {a.complianceFlags.length > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 font-semibold">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {a.complianceFlags.length}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <Lightbox
          asset={open}
          pending={pending}
          onClose={() => setOpen(null)}
          onRegenerate={(p) => regenerate(open, p)}
          platformLabels={platformLabels}
        />
      ) : null}
    </div>
  );
}

function Pill({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-slate-800 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? "All" : labels[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoreChip({ label, score }: { label: string; score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/90"
      : score >= 50
        ? "bg-amber-500/90"
        : "bg-rose-500/90";
  return (
    <span className={`rounded px-1 py-0.5 text-[9px] font-semibold text-white ${tone}`}>
      {label} {Math.round(score)}
    </span>
  );
}

function Lightbox({
  asset,
  pending,
  onClose,
  onRegenerate,
  platformLabels,
}: {
  asset: Asset;
  pending: boolean;
  onClose: () => void;
  onRegenerate: (prompt?: string) => Promise<void>;
  platformLabels: Record<string, string>;
}) {
  const [editPrompt, setEditPrompt] = useState(false);
  const [draft, setDraft] = useState(asset.prompt ?? "");

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="grid w-full max-w-5xl grid-cols-1 gap-0 overflow-hidden rounded-xl bg-white shadow-xl md:grid-cols-[1.4fr_1fr]">
        <div className="relative bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={asset.prompt ?? ""} className="h-full max-h-[80vh] w-full object-contain" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-slate-700 shadow-sm hover:bg-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform</p>
            <p className="text-sm font-medium text-slate-900">
              {asset.platform ? platformLabels[asset.platform] ?? asset.platform : "—"}
              {asset.format ? ` · ${asset.format}` : ""}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</p>
              <button
                type="button"
                onClick={() => setEditPrompt((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-signal-700 hover:underline"
              >
                <Pencil className="h-3 w-3" />
                {editPrompt ? "Cancel" : "Edit prompt"}
              </button>
            </div>
            {editPrompt ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
              />
            ) : (
              <p className="mt-1 whitespace-pre-line text-xs text-slate-700">
                {asset.prompt ?? <span className="italic text-slate-400">No prompt recorded.</span>}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">License</p>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
              {JSON.stringify(asset.license, null, 2)}
            </pre>
          </div>

          {asset.complianceFlags.length > 0 ? (
            <ul className="space-y-1">
              {asset.complianceFlags.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2">
            <a
              href={asset.url}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              type="button"
              onClick={() => onRegenerate(editPrompt ? draft : undefined)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
