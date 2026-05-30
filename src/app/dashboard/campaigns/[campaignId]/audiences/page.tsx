/**
 * Audiences tab — per-platform AudienceProfile cards.
 *
 * Renders Meta / Google / LinkedIn / TikTok / etc. with the platform-native
 * targeting fields surfaced in the orchestrator's `audience-targeting`
 * output (locations, interests, behaviours, lookalikes, keyword sets,
 * job titles, interest clusters, ...).
 *
 * Each card supports "Regenerate audience" with an optional steering
 * reason captured from the user.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard, PLATFORM_LABEL } from "../_shared/state";
import { AudienceCard } from "../_clients/AudienceCard.client";

export const metadata = { title: "Audiences | GoFunnelAI" };

export default async function AudiencesPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        audienceProfiles: { orderBy: [{ platform: "asc" }, { createdAt: "desc" }] },
      },
    }),
  );
  if (!campaign) notFound();

  const cards = campaign.audienceProfiles.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformLabel: PLATFORM_LABEL[a.platform] ?? a.platform,
    targeting: (a.targeting ?? {}) as Record<string, unknown>,
    exclusions: Array.isArray(a.exclusions) ? (a.exclusions as unknown[]) : [],
    lookalikeSource: a.lookalikeSource,
    estimatedReach: a.estimatedReach ? Number(a.estimatedReach) : null,
  }));

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Audiences"
        description="The targeting GoFunnelAI built per platform. Edit, regenerate, or steer with a quick note."
      />
      {cards.length === 0 ? (
        <EmptyCard
          title="No audiences yet"
          description="Audiences appear once the plan finishes. Approve the strategy to kick things off."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cards.map((c) => (
            <AudienceCard key={c.id} campaignId={campaign.id} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}
