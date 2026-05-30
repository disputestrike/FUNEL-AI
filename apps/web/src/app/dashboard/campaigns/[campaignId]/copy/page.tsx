/**
 * Copy tab — AdVariant grid grouped by platform.
 *
 * Each variant card surfaces: angle, primary text, headline, description,
 * CTA, character counts against the platform's published limits (red if
 * exceeded), and inline policy warnings drawn from the ad-policy agent's
 * output (stored on the variant as compliance flags).
 *
 * Per-variant actions: Approve / Regenerate (with reason) / Edit /
 * Duplicate / Copy-to-clipboard. Per-platform action: Export CSV.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";
import { PLATFORM_META } from "@funnel/shared/launch";

import { SectionHeading, EmptyCard, PLATFORM_LABEL } from "../_shared/state";
import { CopyVariantCard } from "../_clients/CopyVariantCard.client";
import { PlatformCsvButton } from "../_clients/PlatformCsvButton.client";

export const metadata = { title: "Copy | GoFunnelAI" };

export default async function CopyPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        adVariants: { orderBy: [{ platform: "asc" }, { createdAt: "desc" }] },
        complianceReviews: { take: 200, orderBy: { createdAt: "desc" } },
      },
    }),
  );
  if (!campaign) notFound();

  // Group variants by platform.
  const byPlatform = new Map<string, typeof campaign.adVariants>();
  for (const v of campaign.adVariants) {
    const list = byPlatform.get(v.platform) ?? [];
    list.push(v);
    byPlatform.set(v.platform, list);
  }

  // Build a quick lookup: variant-id -> compliance flags.
  const flagsByAsset = new Map<
    string,
    Array<{ severity: string; category: string; message: string }>
  >();
  for (const r of campaign.complianceReviews) {
    if (!r.assetId) continue;
    const list = flagsByAsset.get(r.assetId) ?? [];
    list.push({ severity: r.severity, category: r.category, message: r.message });
    flagsByAsset.set(r.assetId, list);
  }

  if (campaign.adVariants.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="Copy"
          description="Per-platform ad variants across the 8 angles GoFunnelAI tests."
        />
        <EmptyCard
          title="No ad copy yet"
          description="Once the plan is approved we'll draft headlines, primary text, descriptions, and CTAs per platform."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Copy"
        description="Per-platform ad variants across the 8 angles GoFunnelAI tests. Character counts are checked against each platform's policy."
      />
      {Array.from(byPlatform.entries()).map(([platform, variants]) => {
        const limits = PLATFORM_META[platform as keyof typeof PLATFORM_META]?.characterLimits ?? {
          primaryText: 0,
          headline: 0,
          description: null,
        };
        return (
          <section key={platform}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {PLATFORM_LABEL[platform] ?? platform}{" "}
                <span className="font-normal text-slate-500">
                  · {variants.length} variant{variants.length === 1 ? "" : "s"}
                </span>
              </h3>
              <PlatformCsvButton campaignId={campaign.id} platform={platform} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {variants.map((v) => (
                <CopyVariantCard
                  key={v.id}
                  campaignId={campaign.id}
                  variant={{
                    id: v.id,
                    platform: v.platform,
                    angle: v.angle,
                    primaryText: v.primaryText,
                    headline: v.headline,
                    description: v.description ?? null,
                    ctaText: v.ctaText ?? null,
                    status: v.status,
                  }}
                  limits={limits}
                  flags={flagsByAsset.get(v.id) ?? []}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
