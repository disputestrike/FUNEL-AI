/**
 * GoFunnelAI — Command Center conversation persistence.
 *
 * Thin wrapper around Prisma for the chat surface at /dashboard/command.
 * Every read/write goes through `withWorkspaceContext` so Postgres RLS
 * scopes results to the caller's workspace.
 *
 * Message content is structured JSON (not a plain string) so the assistant
 * can persist embedded preview cards, action chips, and readiness badges
 * alongside markdown text. See `AssistantMessageBlock` for the schema the
 * MessageRenderer consumes on the client.
 */
import { withWorkspaceContext } from "@funnel/db";
import type { Prisma } from "@funnel/db";

/* -------------------------------------------------------------------------
 * Block schema — what the MessageRenderer knows how to render.
 * ----------------------------------------------------------------------- */

export type AssistantMessageBlock =
  | { type: "text"; markdown: string }
  | {
      type: "funnel_preview";
      funnelId: string;
      title: string;
      qualityScore?: number;
      previewUrl?: string;
      thumbnailUrl?: string;
    }
  | {
      type: "campaign_summary";
      campaignId: string;
      name: string;
      objective: string;
      platforms: string[];
      readinessScore?: number;
    }
  | {
      type: "asset_grid";
      assets: Array<{
        id: string;
        url: string;
        kind: "image" | "video";
        label?: string;
      }>;
    }
  | {
      type: "action_chips";
      chips: Array<{
        id: string;
        label: string;
        action:
          | "approve"
          | "regenerate"
          | "edit"
          | "open_launch_center"
          | "mark_launched_externally"
          | "open_funnel"
          | "open_campaign";
        payload?: Record<string, unknown>;
      }>;
    }
  | {
      type: "readiness_score";
      campaignId: string;
      overall: number;
      breakdown: Record<string, number>;
    };

export interface UserMessageContent {
  type: "text";
  text: string;
}

export type MessageContent =
  | UserMessageContent
  | { type: "assistant"; blocks: AssistantMessageBlock[] };

/* -------------------------------------------------------------------------
 * DTOs
 * ----------------------------------------------------------------------- */

export interface ConversationSummary {
  id: string;
  title: string;
  pinnedContext: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: MessageContent;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/* -------------------------------------------------------------------------
 * Reads
 * ----------------------------------------------------------------------- */

export async function listConversations(
  workspaceId: string,
  opts: { limit?: number } = {},
): Promise<ConversationSummary[]> {
  return withWorkspaceContext(workspaceId, async (tx) => {
    const rows = await tx.commandConversation.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: opts.limit ?? 25,
      select: {
        id: true,
        title: true,
        pinnedContext: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      pinnedContext: (r.pinnedContext as Record<string, unknown>) ?? {},
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<{
  conversation: ConversationSummary;
  messages: MessageRecord[];
} | null> {
  return withWorkspaceContext(workspaceId, async (tx) => {
    const conv = await tx.commandConversation.findFirst({
      where: { id: conversationId, archivedAt: null },
    });
    if (!conv) return null;
    const msgs = await tx.commandMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
    });
    return {
      conversation: {
        id: conv.id,
        title: conv.title,
        pinnedContext: (conv.pinnedContext as Record<string, unknown>) ?? {},
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      },
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as "user" | "assistant" | "system",
        content: m.content as unknown as MessageContent,
        metadata: (m.metadata as Record<string, unknown>) ?? undefined,
        createdAt: m.createdAt,
      })),
    };
  });
}

/* -------------------------------------------------------------------------
 * Writes
 * ----------------------------------------------------------------------- */

export async function createConversation(
  workspaceId: string,
  userId: string,
  opts: { title?: string; pinnedContext?: Record<string, unknown> } = {},
): Promise<ConversationSummary> {
  return withWorkspaceContext(workspaceId, async (tx) => {
    const created = await tx.commandConversation.create({
      data: {
        workspaceId,
        userId,
        title: opts.title ?? "New chat",
        pinnedContext: (opts.pinnedContext ??
          {}) as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: created.id,
      title: created.title,
      pinnedContext:
        (created.pinnedContext as Record<string, unknown>) ?? {},
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  });
}

export async function appendMessage(
  workspaceId: string,
  conversationId: string,
  args: {
    role: "user" | "assistant" | "system";
    content: MessageContent;
    metadata?: Record<string, unknown>;
  },
): Promise<MessageRecord> {
  return withWorkspaceContext(workspaceId, async (tx) => {
    const created = await tx.commandMessage.create({
      data: {
        conversationId,
        role: args.role,
        content: args.content as unknown as Prisma.InputJsonValue,
        metadata: args.metadata
          ? (args.metadata as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
    // Bump conversation updatedAt so the workspace panel re-sorts.
    await tx.commandConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return {
      id: created.id,
      conversationId: created.conversationId,
      role: created.role as "user" | "assistant" | "system",
      content: created.content as unknown as MessageContent,
      metadata: (created.metadata as Record<string, unknown>) ?? undefined,
      createdAt: created.createdAt,
    };
  });
}

/**
 * Derive a chat title from the first user message — capped at 80 chars and
 * stripped of trailing whitespace. Called when a conversation has the
 * placeholder title "New chat" and we want something readable in the
 * workspace panel.
 */
export function deriveTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 80) return cleaned || "New chat";
  return cleaned.slice(0, 77) + "…";
}

export async function renameIfPlaceholder(
  workspaceId: string,
  conversationId: string,
  candidate: string,
): Promise<void> {
  await withWorkspaceContext(workspaceId, async (tx) => {
    const row = await tx.commandConversation.findFirst({
      where: { id: conversationId },
      select: { title: true },
    });
    if (!row) return;
    if (row.title === "New chat" || row.title === "Untitled chat") {
      await tx.commandConversation.update({
        where: { id: conversationId },
        data: { title: deriveTitle(candidate) },
      });
    }
  });
}

export async function pinContext(
  workspaceId: string,
  conversationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await withWorkspaceContext(workspaceId, async (tx) => {
    const row = await tx.commandConversation.findFirst({
      where: { id: conversationId },
      select: { pinnedContext: true },
    });
    if (!row) return;
    const merged = {
      ...((row.pinnedContext as Record<string, unknown>) ?? {}),
      ...patch,
    };
    await tx.commandConversation.update({
      where: { id: conversationId },
      data: { pinnedContext: merged as unknown as Prisma.InputJsonValue },
    });
  });
}
