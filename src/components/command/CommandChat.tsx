"use client";

/**
 * GoFunnelAI — Command Center chat (main interaction surface).
 *
 * Free-form prompt in, streamed assistant turns out. Drives the side panel
 * via the `onPreviewEvent` callback and the parent's running-agent set.
 *
 * Composition:
 *   - Quick action chips below the input pre-fill starter prompts
 *     ("Create funnel", "Create campaign", "Edit current funnel", …).
 *   - Empty-state suggested prompts wired to the same handler.
 *   - User messages right-aligned, assistant left-aligned.
 *   - Each assistant turn renders through <MessageRenderer />.
 *
 * Streaming wire format: see apps/web/src/app/api/command/route.ts.
 *
 * The chat never assembles the assistant message body locally — the server
 * computes the final array of blocks at the end of the stream and emits a
 * `message` event for each one. We collect them, then `done` finalises the
 * turn.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Edit3,
  ExternalLink,
  Eye,
  LineChart,
  Megaphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import { MessageRenderer } from "./MessageRenderer";
import type { SidePanelState, SidePanelTab } from "./SidePanel";
import type {
  AssistantMessageBlock,
  MessageContent,
} from "@/lib/command/conversation-store";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------
 * Public types
 * ----------------------------------------------------------------------- */

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: MessageContent;
  intentLabel?: string;
  /** True while the assistant message is still streaming. */
  pending?: boolean;
}

export interface CommandChatProps {
  workspaceId: string;
  /** Optional initial conversation hydrated from the server. */
  initialConversationId?: string | null;
  initialTurns?: ChatTurn[];
  /** Context pinned from the workspace panel (funnel/campaign). */
  context: { funnelId?: string; campaignId?: string };
  /** Side-panel state setter — the chat drives the panel. */
  onPanelUpdate: (
    update: (prev: SidePanelState) => SidePanelState,
  ) => void;
}

/* -------------------------------------------------------------------------
 * Quick action presets
 * ----------------------------------------------------------------------- */

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  template: string;
  requiresContext?: "funnel" | "campaign";
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "create-funnel",
    label: "Create funnel",
    icon: <Sparkles className="size-3.5" />,
    template:
      "Build me a funnel for [industry] that [pain point]. Goal: [outcome].",
  },
  {
    id: "create-campaign",
    label: "Create campaign",
    icon: <Megaphone className="size-3.5" />,
    template:
      "Create a launch campaign for my [funnel] targeting [audience]. Goal: [outcome].",
  },
  {
    id: "edit-funnel",
    label: "Edit current funnel",
    icon: <Edit3 className="size-3.5" />,
    template: "Make the hero more premium and rewrite the subhead.",
    requiresContext: "funnel",
  },
  {
    id: "more-ads",
    label: "Generate more ads",
    icon: <Wand2 className="size-3.5" />,
    template: "Generate 5 more video ads for retargeting.",
    requiresContext: "campaign",
  },
  {
    id: "performance",
    label: "Show campaign performance",
    icon: <LineChart className="size-3.5" />,
    template: "Show me which creative is winning over the last 7 days.",
    requiresContext: "campaign",
  },
  {
    id: "mark-launched",
    label: "Mark launched externally",
    icon: <ExternalLink className="size-3.5" />,
    template: "Mark this campaign as launched externally.",
    requiresContext: "campaign",
  },
];

const SUGGESTED_PROMPTS = [
  "Build me a funnel for dental clinics that miss calls and need AI appointment booking. Goal: booked demos.",
  "Create a launch campaign for my [funnel] targeting [audience]. Goal: [outcome].",
  "Generate 5 more video ads for retargeting",
  "Make the hero more premium / more urgent",
  "Target schools instead of clinics",
  "Show me which creative is winning",
  "Mark campaign as launched externally",
];

/* -------------------------------------------------------------------------
 * Component
 * ----------------------------------------------------------------------- */

export function CommandChat({
  workspaceId,
  initialConversationId,
  initialTurns,
  context,
  onPanelUpdate,
}: CommandChatProps) {
  const router = useRouter();
  const [conversationId, setConversationId] = React.useState<string | null>(
    initialConversationId ?? null,
  );
  const [turns, setTurns] = React.useState<ChatTurn[]>(initialTurns ?? []);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesRef = React.useRef<HTMLDivElement | null>(null);

  // Autoscroll on new turns.
  React.useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  const send = React.useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending) return;
      setSending(true);
      setError(null);

      const userTurn: ChatTurn = {
        id: `local_${Date.now()}`,
        role: "user",
        content: { type: "text", text },
      };
      const assistantTurnId = `local_a_${Date.now()}`;
      const assistantBlocks: AssistantMessageBlock[] = [];
      setTurns((prev) => [
        ...prev,
        userTurn,
        {
          id: assistantTurnId,
          role: "assistant",
          content: { type: "assistant", blocks: assistantBlocks },
          pending: true,
        },
      ]);
      setInput("");

      // Open the side panel — the panel will autoswitch tabs based on the
      // first preview/agent_started event we receive.
      onPanelUpdate((prev) => ({
        ...prev,
        open: true,
        runningAgents: [],
      }));

      try {
        const res = await fetch("/api/command", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId,
            workspaceId,
            context,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`status_${res.status}`);
        }

        await consumeSse(res.body, (event) => {
          handleEvent(event, {
            assistantTurnId,
            assistantBlocks,
            setTurns,
            onPanelUpdate,
            setConversationId,
          });
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
        // Mark the pending assistant turn as failed.
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantTurnId
              ? {
                  ...t,
                  pending: false,
                  content: {
                    type: "assistant",
                    blocks: [
                      {
                        type: "text",
                        markdown:
                          "I couldn't finish that one. Try resending — usually a flake.",
                      },
                    ],
                  },
                }
              : t,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [conversationId, context, onPanelUpdate, sending, workspaceId],
  );

  const handleAction = React.useCallback(
    (action: string, payload?: Record<string, unknown>) => {
      switch (action) {
        case "open_launch_center":
          if (payload?.campaignId) {
            router.push(`/dashboard/campaigns/${payload.campaignId}`);
          }
          return;
        case "open_funnel":
          if (payload?.funnelId) {
            router.push(`/dashboard/funnels/${payload.funnelId}/preview`);
          }
          return;
        case "regenerate":
          send(
            payload?.target
              ? `Regenerate the ${payload.target}.`
              : "Try another angle on that.",
          );
          return;
        case "approve":
          send("Approve and move forward.");
          return;
        case "mark_launched_externally":
          send("Mark this campaign as launched externally.");
          return;
        case "edit":
          send("Open the editor for that.");
          return;
      }
    },
    [router, send],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={messagesRef}
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {turns.length === 0 ? (
            <EmptyState
              onPick={(p) => setInput(p)}
              context={context}
            />
          ) : (
            turns.map((turn) => (
              <TurnBubble
                key={turn.id}
                turn={turn}
                onAction={handleAction}
              />
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <QuickActionRow
            actions={QUICK_ACTIONS}
            context={context}
            onPick={(template) => setInput(template)}
          />
          <div className="mt-3 flex items-end gap-2">
            <label className="flex-1">
              <span className="sr-only">Type a command</span>
              <textarea
                data-testid="command-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Type what you want. AI orchestrates everything else."
                rows={2}
                className="block w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 placeholder:text-slate-400 focus-visible:border-signal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500/30"
                disabled={sending}
              />
            </label>
            <button
              type="submit"
              data-testid="command-send"
              disabled={!input.trim() || sending}
              aria-label="Send"
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition",
                "disabled:opacity-40",
                !sending && "hover:bg-slate-800",
              )}
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
          {error && (
            <div
              role="alert"
              className="mt-2 text-caption text-rose-600"
            >
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Subcomponents
 * ----------------------------------------------------------------------- */

function TurnBubble({
  turn,
  onAction,
}: {
  turn: ChatTurn;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  if (turn.role === "user") {
    const text = turn.content.type === "text" ? turn.content.text : "";
    return (
      <div className="flex justify-end">
        <div
          data-testid="user-turn"
          className="max-w-[85%] rounded-2xl rounded-tr-md bg-slate-900 px-4 py-2.5 text-body text-white shadow-sm"
        >
          {text}
        </div>
      </div>
    );
  }

  const blocks =
    turn.content.type === "assistant" ? turn.content.blocks : [];
  return (
    <div className="flex justify-start">
      <div
        data-testid="assistant-turn"
        className="max-w-[92%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        {turn.intentLabel && (
          <div
            data-testid="intent-label"
            className="mb-2 inline-flex items-center gap-1 rounded-full bg-signal-50 px-2 py-0.5 text-caption font-semibold text-signal-700"
          >
            {turn.intentLabel}
          </div>
        )}
        {blocks.length === 0 && turn.pending ? (
          <ThinkingDots />
        ) : (
          <MessageRenderer blocks={blocks} onAction={onAction} />
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid="thinking-dots"
      aria-label="Thinking"
    >
      <span
        className="size-1.5 animate-ellipsis-bounce rounded-full bg-slate-400"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="size-1.5 animate-ellipsis-bounce rounded-full bg-slate-400"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="size-1.5 animate-ellipsis-bounce rounded-full bg-slate-400"
        style={{ animationDelay: "400ms" }}
      />
    </span>
  );
}

function EmptyState({
  onPick,
  context,
}: {
  onPick: (prompt: string) => void;
  context: { funnelId?: string; campaignId?: string };
}) {
  return (
    <div
      data-testid="chat-empty-state"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-signal-100 text-signal-600">
        <Sparkles className="size-6" />
      </div>
      <h2 className="mt-4 text-h3 font-display font-semibold text-slate-900">
        AI Command Center
      </h2>
      <p className="mx-auto mt-2 max-w-md text-body text-slate-500">
        Type what you want. I'll figure out which agents to run, build the
        thing, and stream the preview into the panel on the right.
      </p>
      {(context.funnelId || context.campaignId) && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-caption font-medium text-slate-700">
          <Eye className="size-3.5" />
          Pinned context: {context.funnelId ? "funnel" : "campaign"}
        </div>
      )}
      <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid="suggested-prompt"
            onClick={() => onPick(p)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-body-sm text-slate-700 hover:border-signal-300 hover:bg-white"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActionRow({
  actions,
  context,
  onPick,
}: {
  actions: QuickAction[];
  context: { funnelId?: string; campaignId?: string };
  onPick: (template: string) => void;
}) {
  return (
    <div
      data-testid="quick-actions"
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Quick actions"
    >
      {actions.map((a) => {
        const disabled =
          (a.requiresContext === "funnel" && !context.funnelId) ||
          (a.requiresContext === "campaign" && !context.campaignId);
        return (
          <button
            key={a.id}
            type="button"
            data-testid={`quick-action-${a.id}`}
            disabled={disabled}
            onClick={() => onPick(a.template)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-caption font-medium transition",
              disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : "border-slate-200 bg-white text-slate-700 hover:border-signal-300 hover:bg-signal-50",
            )}
          >
            {a.icon}
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * SSE consumer + event reducer
 * ----------------------------------------------------------------------- */

interface SseHandlerCtx {
  assistantTurnId: string;
  assistantBlocks: AssistantMessageBlock[];
  setTurns: React.Dispatch<React.SetStateAction<ChatTurn[]>>;
  onPanelUpdate: (
    update: (prev: SidePanelState) => SidePanelState,
  ) => void;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
}

async function consumeSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  // Read frames separated by blank lines.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        try {
          onEvent(JSON.parse(json));
        } catch {
          // ignore malformed frame
        }
      }
    }
  }
}

function handleEvent(
  event: Record<string, unknown>,
  ctx: SseHandlerCtx,
): void {
  const type = event.type as string;
  switch (type) {
    case "conversation":
      if (typeof event.conversationId === "string") {
        ctx.setConversationId(event.conversationId);
      }
      return;

    case "intent":
      ctx.setTurns((prev) =>
        prev.map((t) =>
          t.id === ctx.assistantTurnId
            ? { ...t, intentLabel: event.label as string }
            : t,
        ),
      );
      return;

    case "agent_started":
      ctx.onPanelUpdate((prev) => ({
        ...prev,
        open: true,
        activeTab: (event.panelTab as SidePanelTab) ?? prev.activeTab,
        runningAgents: [
          ...prev.runningAgents,
          {
            agent: event.agent as string,
            label: event.label as string,
            emoji: event.emoji as string,
          },
        ],
      }));
      return;

    case "agent_completed":
      ctx.onPanelUpdate((prev) => ({
        ...prev,
        runningAgents: prev.runningAgents.filter(
          (a) => a.agent !== event.agent,
        ),
      }));
      return;

    case "preview": {
      const slotKey = `${event.panelTab}.${event.slot}`;
      ctx.onPanelUpdate((prev) => {
        // Surface the campaignId/funnelId for the header deep-link CTA.
        const payload = event.payload as Record<string, unknown> | undefined;
        return {
          ...prev,
          open: true,
          activeTab: (event.panelTab as SidePanelTab) ?? prev.activeTab,
          previews: { ...prev.previews, [slotKey]: event.payload },
          campaignId:
            (payload?.campaignId as string | undefined) ?? prev.campaignId,
          funnelId:
            (payload?.funnelId as string | undefined) ?? prev.funnelId,
        };
      });
      return;
    }

    case "message": {
      const block = event.block as AssistantMessageBlock | undefined;
      if (!block) return;
      ctx.assistantBlocks.push(block);
      ctx.setTurns((prev) =>
        prev.map((t) =>
          t.id === ctx.assistantTurnId
            ? {
                ...t,
                content: {
                  type: "assistant",
                  blocks: [...ctx.assistantBlocks],
                },
              }
            : t,
        ),
      );
      return;
    }

    case "done":
      // Server only emits message blocks via the assistant message
      // persistence step today (no per-block "message" event). Pull
      // them out of the persisted state by clearing pending.
      ctx.setTurns((prev) =>
        prev.map((t) =>
          t.id === ctx.assistantTurnId ? { ...t, pending: false } : t,
        ),
      );
      ctx.onPanelUpdate((prev) => ({ ...prev, runningAgents: [] }));
      return;

    case "error":
      ctx.setTurns((prev) =>
        prev.map((t) =>
          t.id === ctx.assistantTurnId
            ? {
                ...t,
                pending: false,
                content: {
                  type: "assistant",
                  blocks: [
                    {
                      type: "text",
                      markdown:
                        (event.error as string) ??
                        "Something tripped on the way back.",
                    },
                  ],
                },
              }
            : t,
        ),
      );
      ctx.onPanelUpdate((prev) => ({ ...prev, runningAgents: [] }));
      return;
  }
}
