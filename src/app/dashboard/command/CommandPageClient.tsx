"use client";

/**
 * GoFunnelAI — Command Center client island.
 *
 * Orchestrates three regions:
 *   1. Workspace panel (left)  — pinned funnels, recent campaigns, recent
 *                                conversations. Collapsible on desktop;
 *                                hides under a drawer button on mobile.
 *   2. Chat (center)            — CommandChat (free-form input + streamed
 *                                turns + quick actions).
 *   3. Side panel (right)       — SidePanel — slides in while AI generates,
 *                                displays funnel/campaign/asset previews.
 *
 * The chat and side panel share state via the `panel` SidePanelState. The
 * chat dispatches updates (open, activeTab, runningAgents, previews); the
 * panel reads them.
 */
import * as React from "react";
import Link from "next/link";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Sparkles,
} from "lucide-react";
import { CommandChat, type ChatTurn } from "@/components/command/CommandChat";
import { SidePanel, type SidePanelState } from "@/components/command/SidePanel";
import { cn } from "@/lib/cn";

interface RecentItem {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface CommandPageClientProps {
  workspaceId: string;
  workspaceName: string;
  initialContext: { funnelId?: string; campaignId?: string };
  recentFunnels: RecentItem[];
  recentCampaigns: RecentItem[];
  recentConversations: RecentConversation[];
}

const INITIAL_PANEL: SidePanelState = {
  open: false,
  activeTab: "campaign",
  previews: {},
  runningAgents: [],
};

export function CommandPageClient({
  workspaceId,
  workspaceName,
  initialContext,
  recentFunnels,
  recentCampaigns,
  recentConversations,
}: CommandPageClientProps) {
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [context, setContext] = React.useState(initialContext);
  const [panel, setPanel] = React.useState<SidePanelState>(INITIAL_PANEL);
  const [initialTurns] = React.useState<ChatTurn[]>([]);

  const pinFunnel = (funnelId: string) => {
    setContext((prev) => ({ ...prev, funnelId, campaignId: undefined }));
  };
  const pinCampaign = (campaignId: string) => {
    setContext((prev) => ({ ...prev, campaignId, funnelId: undefined }));
  };
  const unpin = () => setContext({});

  return (
    <div
      data-testid="command-center-root"
      className="relative flex flex-1 min-h-0 overflow-hidden"
    >
      {/* LEFT — workspace panel */}
      <aside
        data-testid="workspace-panel"
        data-open={leftOpen || undefined}
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all",
          leftOpen ? "w-72" : "w-12",
          // Mobile: full-width drawer behind a button.
          "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          {leftOpen ? (
            <div className="min-w-0">
              <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
                Workspace
              </div>
              <div className="truncate text-body-sm font-semibold text-slate-900">
                {workspaceName}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            aria-label={leftOpen ? "Collapse workspace panel" : "Expand workspace panel"}
            onClick={() => setLeftOpen((v) => !v)}
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            {leftOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>
        </div>

        {leftOpen && (
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <PinnedContextBanner
              context={context}
              recentFunnels={recentFunnels}
              recentCampaigns={recentCampaigns}
              onUnpin={unpin}
            />

            <Section title="Funnels">
              {recentFunnels.length === 0 ? (
                <EmptyLine href="/generate" label="Generate your first funnel" />
              ) : (
                recentFunnels.map((f) => (
                  <ContextRow
                    key={f.id}
                    name={f.name}
                    status={f.status}
                    pinned={context.funnelId === f.id}
                    onPin={() => pinFunnel(f.id)}
                    onUnpin={unpin}
                    openHref={`/dashboard/funnels/${f.id}/preview`}
                    testId={`workspace-funnel-${f.id}`}
                  />
                ))
              )}
            </Section>

            <Section title="Campaigns">
              {recentCampaigns.length === 0 ? (
                <EmptyLine
                  href="/dashboard/command"
                  label="Ask the chat to create one"
                />
              ) : (
                recentCampaigns.map((c) => (
                  <ContextRow
                    key={c.id}
                    name={c.name}
                    status={c.status}
                    pinned={context.campaignId === c.id}
                    onPin={() => pinCampaign(c.id)}
                    onUnpin={unpin}
                    openHref={`/dashboard/campaigns/${c.id}`}
                    testId={`workspace-campaign-${c.id}`}
                  />
                ))
              )}
            </Section>

            {recentConversations.length > 0 && (
              <Section title="Recent chats">
                {recentConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/command?conversation=${c.id}`}
                    className="block truncate rounded-md px-2 py-1.5 text-caption text-slate-700 hover:bg-slate-100"
                  >
                    {c.title}
                  </Link>
                ))}
              </Section>
            )}
          </div>
        )}
      </aside>

      {/* CENTER — chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandChat
          workspaceId={workspaceId}
          context={context}
          onPanelUpdate={setPanel}
        />
      </div>

      {/* RIGHT — side panel (slides in) */}
      <SidePanel
        {...panel}
        onClose={() => setPanel((prev) => ({ ...prev, open: false }))}
        onTabChange={(tab) =>
          setPanel((prev) => ({ ...prev, activeTab: tab }))
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ContextRow({
  name,
  status,
  pinned,
  onPin,
  onUnpin,
  openHref,
  testId,
}: {
  name: string;
  status: string;
  pinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  openHref: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption",
        pinned ? "bg-signal-50 text-signal-900" : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <Link href={openHref} className="min-w-0 flex-1 truncate font-medium">
        {name}
      </Link>
      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
        {status}
      </span>
      <button
        type="button"
        aria-label={pinned ? "Unpin from chat" : "Pin to chat"}
        onClick={pinned ? onUnpin : onPin}
        className={cn(
          "shrink-0 rounded p-1 transition",
          pinned
            ? "text-signal-600 hover:bg-signal-100"
            : "text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100",
        )}
      >
        {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </div>
  );
}

function EmptyLine({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-caption text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      <Sparkles className="size-3.5" /> {label}
    </Link>
  );
}

function PinnedContextBanner({
  context,
  recentFunnels,
  recentCampaigns,
  onUnpin,
}: {
  context: { funnelId?: string; campaignId?: string };
  recentFunnels: RecentItem[];
  recentCampaigns: RecentItem[];
  onUnpin: () => void;
}) {
  if (!context.funnelId && !context.campaignId) return null;
  const item = context.funnelId
    ? recentFunnels.find((f) => f.id === context.funnelId)
    : recentCampaigns.find((c) => c.id === context.campaignId);
  const label = item?.name ?? context.funnelId ?? context.campaignId ?? "";
  return (
    <div
      data-testid="pinned-context"
      className="mb-3 rounded-md border border-signal-200 bg-signal-50 p-2 text-caption text-signal-900"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Pin className="size-3.5" /> Pinned
        </span>
        <button
          type="button"
          onClick={onUnpin}
          className="rounded p-0.5 text-signal-700 hover:bg-signal-100"
          aria-label="Unpin"
        >
          <PinOff className="size-3.5" />
        </button>
      </div>
      <div className="mt-0.5 truncate font-medium text-signal-800">{label}</div>
    </div>
  );
}
