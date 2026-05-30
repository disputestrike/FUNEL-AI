/**
 * Videos tab — VideoAsset list with expandable script + storyboard.
 *
 * Statuses mirror the orchestrator's video pipeline:
 *   script_ready → storyboard_ready → voiceover_ready → rendered
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard } from "../_shared/state";
import { VideoList } from "../_clients/VideoList.client";

export const metadata = { title: "Videos | GoFunnelAI" };

function deriveStatus(v: {
  finalUrl: string | null;
  voiceoverUrl: string | null;
  storyboard: unknown;
  scriptText: string | null;
}): "script_ready" | "storyboard_ready" | "voiceover_ready" | "rendered" | "pending" {
  if (v.finalUrl) return "rendered";
  if (v.voiceoverUrl) return "voiceover_ready";
  if (v.storyboard && typeof v.storyboard === "object" && Object.keys(v.storyboard as object).length > 0) {
    return "storyboard_ready";
  }
  if (v.scriptText) return "script_ready";
  return "pending";
}

export default async function VideosPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        videoAssets: { orderBy: { createdAt: "desc" } },
      },
    }),
  );
  if (!campaign) notFound();

  const rows = campaign.videoAssets.map((v) => {
    const sb = (v.storyboard ?? {}) as Record<string, unknown>;
    const scenes = Array.isArray(sb.scenes)
      ? (sb.scenes as Array<Record<string, unknown>>).map((s, i) => ({
          index: i,
          visual: typeof s.visual === "string" ? s.visual : "",
          caption: typeof s.caption === "string" ? s.caption : "",
          voiceover: typeof s.voiceover === "string" ? s.voiceover : "",
        }))
      : [];
    return {
      id: v.id,
      type: v.type,
      format: v.aspectRatio ?? null,
      durationSec: v.durationSec ?? null,
      finalUrl: v.finalUrl ?? null,
      posterUrl:
        typeof sb.posterUrl === "string" ? sb.posterUrl : null,
      scriptText: v.scriptText ?? null,
      voiceoverUrl: v.voiceoverUrl ?? null,
      captionsUrl: v.captionsUrl ?? null,
      scenes,
      status: deriveStatus(v),
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Videos"
        description="Scripts, storyboards, voiceovers, and rendered clips for each platform format."
      />
      {rows.length === 0 ? (
        <EmptyCard
          title="No videos yet"
          description="Video assets are drafted once the plan is approved."
        />
      ) : (
        <VideoList campaignId={campaign.id} rows={rows} />
      )}
    </div>
  );
}
