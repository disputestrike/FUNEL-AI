"use client";

/**
 * Live-updating recent-calls feed for a single contact.
 *
 * Polls `/v1/voice-calls?lead_id=…` every 2s. In production this swaps for a
 * server-sent events feed off the call-status webhook fan-out, but polling
 * is fine for the dashboard's "post-capture, watching it ring" use case.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, Volume2 } from "lucide-react";

interface CallRow {
  id: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  direction: "inbound" | "outbound";
  duration_sec: number | null;
  recording_url: string | null;
  transcript_ready: boolean;
  started_at: string | null;
  ended_at: string | null;
}

const STATUS_LABELS: Record<CallRow["status"], string> = {
  queued: "Queued",
  ringing: "Dialing…",
  "in-progress": "Connected",
  completed: "Completed",
  failed: "Failed",
  "no-answer": "No answer",
};

const STATUS_DOT: Record<CallRow["status"], string> = {
  queued: "bg-slate-400",
  ringing: "bg-amber-500 animate-pulse",
  "in-progress": "bg-emerald-500 animate-pulse",
  completed: "bg-emerald-600",
  failed: "bg-rose-500",
  "no-answer": "bg-slate-400",
};

export function CallActivity({ contactId }: { contactId: string }) {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/v1/voice-calls?lead_id=${encodeURIComponent(contactId)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const body = (await res.json()) as { data?: CallRow[] };
        if (!cancelled) {
          setRows(body.data ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void poll();
    const iv = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [contactId]);

  async function playRecording(callId: string) {
    const res = await fetch(`/v1/voice-calls/${encodeURIComponent(callId)}/recording`);
    if (!res.ok) return;
    const body = (await res.json()) as { url?: string };
    if (body.url) window.open(body.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading call history…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No calls yet. Capture a lead with a phone number to trigger speed-to-lead.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[row.status]}`} />
            <div>
              <p className="text-sm font-medium text-ink-900">
                {STATUS_LABELS[row.status]}{" "}
                <Badge variant="neutral" className="ml-1">
                  {row.direction}
                </Badge>
              </p>
              <p className="text-xs text-slate-500">
                {row.started_at ? new Date(row.started_at).toLocaleString() : "—"}
                {row.duration_sec ? ` • ${row.duration_sec}s` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {row.recording_url && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => playRecording(row.id)}
                title="Listen to recording"
              >
                <Volume2 className="h-3 w-3" />
                Recording
              </Button>
            )}
            {row.transcript_ready && (
              <Button asChild variant="tertiary" size="sm">
                <a href={`/v1/voice-calls/${row.id}/transcript`} target="_blank" rel="noreferrer">
                  <Mic className="h-3 w-3" />
                  Transcript
                </a>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
