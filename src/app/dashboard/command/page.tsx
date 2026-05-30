/**
 * GoFunnelAI — AI Command Center page (primary interaction model).
 *
 * Full-screen, chat-first layout:
 *   LEFT (collapsible)  → workspace context: funnels, campaigns, pin to chat
 *   CENTER              → CommandChat — free-form input + streamed turns
 *   RIGHT (slide-in)    → SidePanel — live preview of whatever's being built
 *
 * No drag-drop. No block builder. The user types what they want; the
 * orchestrator decides which agents to run.
 *
 * The page is a server component that hydrates the auth context, loads
 * the workspace's recent funnels + campaigns + last-active conversation,
 * then hands off to the CommandPageClient island.
 */
import { redirect } from "next/navigation";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";
import { listConversations } from "@/lib/command/conversation-store";
import { CommandPageClient } from "./CommandPageClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Command Center · GoFunnelAI",
  description:
    "Type what you want. GoFunnelAI orchestrates funnels, campaigns, creative, tracking, and launches.",
};

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams?: { conversation?: string; funnelId?: string; campaignId?: string };
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?callbackUrl=/dashboard/command");

  const [recentFunnels, recentCampaigns, recentConversations] =
    await Promise.all([
      withWorkspaceContext(session.workspace.id, (tx) =>
        tx.funnel.findMany({
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, name: true, status: true, updatedAt: true },
        }),
      ),
      withWorkspaceContext(session.workspace.id, (tx) =>
        tx.campaign.findMany({
          where: { archivedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, name: true, status: true, updatedAt: true },
        }),
      ),
      listConversations(session.workspace.id, { limit: 12 }),
    ]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <CommandPageClient
        workspaceId={session.workspace.id}
        workspaceName={session.workspace.name}
        initialContext={{
          funnelId: searchParams?.funnelId,
          campaignId: searchParams?.campaignId,
        }}
        recentFunnels={recentFunnels.map((f) => ({
          id: f.id,
          name: f.name,
          status: f.status,
          updatedAt: f.updatedAt.toISOString(),
        }))}
        recentCampaigns={recentCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        recentConversations={recentConversations.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
