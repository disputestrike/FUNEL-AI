"use client";

/**
 * Cockpit live side-channel.
 *
 * Sketch of the SSE bridge — opens `/api/launch/campaigns/{id}/stream`
 * (a server-sent-events endpoint backed by the orchestrator's `events`
 * module) and dispatches typed window events that the various tab pages
 * can subscribe to without coupling to this component.
 *
 * Event types (mirror packages/orchestrator/src/launch/events.ts):
 *
 *   - launch.score.updated     → updates the sticky readiness badge
 *   - launch.status.changed    → triggers a server-component refresh
 *   - launch.tracking.event    → appended to the live tracking feed
 *   - launch.export.ready      → flips the Export tab CTA
 *
 * Keeping this purely a "bridge" means the tab pages stay as plain server
 * components: they re-fetch via router.refresh() when a relevant event
 * fires, instead of mirroring server state into client state.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: string;
}

interface ScoreUpdatedPayload {
  campaignId: string;
  readiness: number;
}

interface StatusChangedPayload {
  campaignId: string;
  status: string;
}

export function CockpitLiveBridge({ campaignId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/launch/campaigns/${campaignId}/stream`, {
      withCredentials: true,
    });

    es.addEventListener("score.updated", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as ScoreUpdatedPayload;
        updateReadinessBadge(data.readiness);
      } catch {
        /* ignore malformed frames */
      }
    });

    es.addEventListener("status.changed", () => {
      router.refresh();
    });

    es.addEventListener("tracking.event", (ev) => {
      window.dispatchEvent(
        new CustomEvent("launch.tracking.event", {
          detail: safeParse((ev as MessageEvent).data),
        }),
      );
    });

    es.addEventListener("export.ready", () => {
      router.refresh();
    });

    es.onerror = () => {
      // Browser will auto-reconnect. If the server is genuinely down the
      // tab pages will display their normal stale-data states until the
      // user navigates.
    };

    return () => {
      es.close();
    };
  }, [campaignId, router]);

  return null;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateReadinessBadge(score: number) {
  const host = document.querySelector<HTMLElement>("[data-launch-readiness]");
  if (!host) return;
  const tone =
    score >= 80
      ? { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "bg-emerald-500" }
      : score >= 50
        ? { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", dot: "bg-amber-500" }
        : { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", dot: "bg-rose-500" };
  host.innerHTML = `
    <span class="inline-flex items-center gap-2 rounded-full ${tone.bg} px-3 py-1.5 text-xs font-semibold ${tone.text} ring-1 ring-inset ${tone.ring}">
      <span class="h-1.5 w-1.5 rounded-full ${tone.dot}"></span>
      Readiness ${Math.round(score)} / 100
    </span>
  `;
}
