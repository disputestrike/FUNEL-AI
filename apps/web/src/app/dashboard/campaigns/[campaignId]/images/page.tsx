/**
 * Images tab — generated creative asset grid.
 *
 * Server component fetches CreativeAsset rows. The grid + lightbox +
 * filter + bulk-select live in a single client component so we can keep
 * the keyboard accessibility (arrow-key navigation, Escape-to-close) in
 * one place.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard, PLATFORM_LABEL } from "../_shared/state";
import { ImageGallery } from "../_clients/ImageGallery.client";

export const metadata = { title: "Images | GoFunnelAI" };

export default async function ImagesPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        creativeAssets: { orderBy: { createdAt: "desc" } },
      },
    }),
  );
  if (!campaign) notFound();

  const assets = campaign.creativeAssets.map((c) => {
    const license = (c.licenseMetadata ?? {}) as Record<string, unknown>;
    const flags = Array.isArray(c.complianceFlags)
      ? (c.complianceFlags as Array<Record<string, unknown>>)
      : [];
    return {
      id: c.id,
      url: c.url,
      thumbnailUrl: c.thumbnailUrl ?? c.url,
      type: c.type,
      format: c.format ?? null,
      prompt: c.prompt ?? null,
      brandScore: c.brandScore !== null ? Number(c.brandScore) : null,
      qualityScore: c.qualityScore !== null ? Number(c.qualityScore) : null,
      platform: typeof license.platform === "string" ? license.platform : null,
      angle: typeof license.angle === "string" ? license.angle : null,
      status: typeof license.status === "string" ? license.status : "draft",
      license: license,
      complianceFlags: flags.map((f) => ({
        severity: String(f.severity ?? "info"),
        message: String(f.message ?? ""),
      })),
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Images"
        description="AI-generated creative across the platform formats GoFunnelAI recommended."
      />
      {assets.length === 0 ? (
        <EmptyCard
          title="No images yet"
          description="Image creative is drafted from the approved plan. Approve to kick off generation."
        />
      ) : (
        <ImageGallery
          campaignId={campaign.id}
          assets={assets}
          platformLabels={PLATFORM_LABEL}
        />
      )}
    </div>
  );
}
