"use client";

/**
 * Video asset list — expandable rows reveal script + storyboard + audio.
 */
import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Download,
  Film,
  Loader2,
  Pencil,
  Play,
  RefreshCcw,
} from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Scene {
  index: number;
  visual: string;
  caption: string;
  voiceover: string;
}

interface Row {
  id: string;
  type: string;
  format: string | null;
  durationSec: number | null;
  finalUrl: string | null;
  posterUrl: string | null;
  scriptText: string | null;
  voiceoverUrl: string | null;
  captionsUrl: string | null;
  scenes: Scene[];
  status: "script_ready" | "storyboard_ready" | "voiceover_ready" | "rendered" | "pending";
}

const STATUS_LABEL: Record<Row["status"], string> = {
  pending: "Drafting",
  script_ready: "Script ready",
  storyboard_ready: "Storyboard ready",
  voiceover_ready: "Voiceover ready",
  rendered: "Rendered",
};

const STATUS_TONE: Record<Row["status"], string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  script_ready: "bg-sky-50 text-sky-700 ring-sky-200",
  storyboard_ready: "bg-violet-50 text-violet-700 ring-violet-200",
  voiceover_ready: "bg-amber-50 text-amber-700 ring-amber-200",
  rendered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function VideoList({ campaignId, rows }: { campaignId: string; rows: Row[] }) {
  const { run, pending } = useLaunchMutation();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [scriptDraft, setScriptDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function action(path: string, body: unknown) {
    setError(null);
    try {
      await run(path, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the video");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => {
          const open = openIds.has(r.id);
          return (
            <li key={r.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {r.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Film className="h-5 w-5" />
                    </div>
                  )}
                  {r.finalUrl ? (
                    <Play
                      className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {r.type.replace(/_/g, " ")}
                    {r.format ? ` · ${r.format}` : ""}
                    {r.durationSec ? ` · ${r.durationSec}s` : ""}
                  </p>
                  <p className="mt-0.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-expanded={open}
                  aria-label={open ? "Collapse" : "Expand"}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {open ? (
                <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4">
                  {r.finalUrl ? (
                    <video
                      className="mb-4 w-full max-w-2xl rounded-md bg-slate-900"
                      controls
                      preload="metadata"
                      poster={r.posterUrl ?? undefined}
                    >
                      <source src={r.finalUrl} />
                    </video>
                  ) : (
                    <div className="mb-4 flex h-32 max-w-2xl items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white text-xs text-slate-500">
                      Render queued — preview will appear here when ready.
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Script
                      </h4>
                      <textarea
                        value={scriptDraft[r.id] ?? r.scriptText ?? ""}
                        onChange={(e) =>
                          setScriptDraft((s) => ({ ...s, [r.id]: e.target.value }))
                        }
                        rows={8}
                        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Storyboard
                      </h4>
                      {r.scenes.length === 0 ? (
                        <p className="mt-1 text-xs italic text-slate-400">
                          Storyboard scenes appear after the script is approved.
                        </p>
                      ) : (
                        <ol className="mt-1 space-y-2">
                          {r.scenes.map((s) => (
                            <li
                              key={s.index}
                              className="rounded-md border border-slate-200 bg-white p-2 text-xs"
                            >
                              <p className="font-semibold text-slate-700">Scene {s.index + 1}</p>
                              {s.visual ? (
                                <p className="mt-1 text-slate-600">
                                  <span className="font-medium">Visual:</span> {s.visual}
                                </p>
                              ) : null}
                              {s.caption ? (
                                <p className="mt-1 text-slate-600">
                                  <span className="font-medium">Caption:</span> {s.caption}
                                </p>
                              ) : null}
                              {s.voiceover ? (
                                <p className="mt-1 text-slate-600">
                                  <span className="font-medium">VO:</span> {s.voiceover}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>

                  {r.voiceoverUrl ? (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Voiceover
                      </h4>
                      <audio controls className="mt-1 w-full max-w-md">
                        <source src={r.voiceoverUrl} />
                      </audio>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => action(`/campaigns/${campaignId}/videos/${r.id}/approve`, {})}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        action(`/campaigns/${campaignId}/videos/${r.id}/regenerate`, {})
                      }
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        action(`/campaigns/${campaignId}/videos/${r.id}/script`, {
                          script: scriptDraft[r.id] ?? r.scriptText ?? "",
                        })
                      }
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Save script
                    </button>
                    {r.captionsUrl ? (
                      <a
                        href={r.captionsUrl}
                        download
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Captions (SRT)
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
