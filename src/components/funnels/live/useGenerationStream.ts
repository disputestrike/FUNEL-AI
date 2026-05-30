"use client";

/**
 * Client-side SSE consumer for /api/generate.
 *
 * Uses `fetch` + a `ReadableStream` reader instead of `EventSource` so we
 * can POST the body. Falls back to a friendly error state on connection
 * loss; the orchestrator wire format includes a terminal `generation_failed`
 * event, so the hook only fabricates a failure if the transport itself dies.
 *
 * Parses GenerationEvent frames via `parseSseFrame` (orchestrator package)
 * and reduces them into the shape the UI needs:
 *
 *   - agentStates       — pending | running | done | error per agent
 *   - draft             — incrementally assembled funnel preview
 *   - spentCents/budget — cost meter
 *   - quality           — final QA dimensions
 *   - terminal          — done | failed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseSseFrame } from "@funnel/orchestrator/streaming";
import type { AgentName, GenerationEvent } from "@funnel/orchestrator/types";

import type {
  FunnelPreviewDraft,
  PreviewSection,
} from "@/components/funnels/FunnelPreviewRenderer";

export type AgentStatus = "pending" | "running" | "done" | "error";

export interface AgentState {
  status: AgentStatus;
  startedAt?: string;
  completedAt?: string;
  /** Streaming text body (from agent_chunk events). */
  streamingText?: string;
  /** Final agent output (opaque). */
  output?: unknown;
  costCents?: number;
  /** Friendly error reason if status === "error". */
  errorReason?: string;
}

export interface QualityResult {
  overall: number;
  dimensions: Record<string, number>;
  failing: { name: string; reason: string }[];
}

export type StreamPhase =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "failed";

export interface StreamErrorState {
  kind:
    | "transport"
    | "budget_exceeded"
    | "compliance_blocked"
    | "generation_failed";
  /** Friendly, customer-facing message. */
  message: string;
}

export interface UseGenerationStreamOptions {
  input: {
    workspace_id: string;
    industry: string;
    business_profile: {
      offer: string;
      target_customer?: string;
      geography?: string;
      businessName?: string;
      brandUrl?: string | null;
    };
  } | null;
  /** Auto-start the stream when input arrives. Default true. */
  autoStart?: boolean;
}

export interface UseGenerationStreamResult {
  phase: StreamPhase;
  agentStates: Partial<Record<AgentName, AgentState>>;
  draft: FunnelPreviewDraft;
  spentCents: number;
  budgetCents: number;
  quality: QualityResult | null;
  publishedUrl: string | null;
  error: StreamErrorState | null;
  startedAt: number | null;
  retry: () => void;
  cancel: () => void;
}

export function useGenerationStream(
  opts: UseGenerationStreamOptions,
): UseGenerationStreamResult {
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [agentStates, setAgentStates] = useState<
    Partial<Record<AgentName, AgentState>>
  >({});
  const [draft, setDraft] = useState<FunnelPreviewDraft>({
    hero: undefined,
    sections: [],
    palette: undefined,
  });
  const [spentCents, setSpentCents] = useState(0);
  const [budgetCents, setBudgetCents] = useState(150);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [error, setError] = useState<StreamErrorState | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef(opts.input);
  inputRef.current = opts.input;

  const start = useCallback(async () => {
    const input = inputRef.current;
    if (!input) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // reset
    setAgentStates({});
    setDraft({ hero: undefined, sections: [], palette: undefined });
    setSpentCents(0);
    setQuality(null);
    setPublishedUrl(null);
    setError(null);
    setPhase("connecting");
    setStartedAt(Date.now());

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await safeReadError(res);
        setError({
          kind: "transport",
          message: msg ?? "Something went wrong. Want to try again?",
        });
        setPhase("failed");
        return;
      }

      setPhase("running");

      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      // Read frames separated by blank line
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let sepIdx = buffer.indexOf("\n\n");
        while (sepIdx !== -1) {
          const raw = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const parsed = parseSseFrame(raw);
          if (parsed && parsed.data) {
            applyEvent(parsed.data as GenerationEvent, {
              setAgentStates,
              setDraft,
              setSpentCents,
              setBudgetCents,
              setQuality,
              setPublishedUrl,
              setError,
              setPhase,
            });
          }
          sepIdx = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") {
        return;
      }
      setError({
        kind: "transport",
        message: "Something went wrong. Want to try again?",
      });
      setPhase("failed");
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, []);

  // auto-start when input is provided
  const autoStart = opts.autoStart !== false;
  const inputKey = useMemo(() => {
    if (!opts.input) return null;
    try {
      return JSON.stringify(opts.input);
    } catch {
      return null;
    }
  }, [opts.input]);

  useEffect(() => {
    if (!autoStart || !inputKey) return;
    start();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  return {
    phase,
    agentStates,
    draft,
    spentCents,
    budgetCents,
    quality,
    publishedUrl,
    error,
    startedAt,
    retry: start,
    cancel,
  };
}

/* -------------------------------------------------------------------------- */
/* Event reducer                                                              */
/* -------------------------------------------------------------------------- */

interface ApplyCtx {
  setAgentStates: React.Dispatch<
    React.SetStateAction<Partial<Record<AgentName, AgentState>>>
  >;
  setDraft: React.Dispatch<React.SetStateAction<FunnelPreviewDraft>>;
  setSpentCents: React.Dispatch<React.SetStateAction<number>>;
  setBudgetCents: React.Dispatch<React.SetStateAction<number>>;
  setQuality: React.Dispatch<React.SetStateAction<QualityResult | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setError: React.Dispatch<React.SetStateAction<StreamErrorState | null>>;
  setPhase: React.Dispatch<React.SetStateAction<StreamPhase>>;
}

function applyEvent(ev: GenerationEvent, ctx: ApplyCtx) {
  switch (ev.type) {
    case "generation_started": {
      ctx.setBudgetCents(ev.data.budgetCapCents);
      return;
    }
    case "planner_started": {
      ctx.setAgentStates((prev) => ({
        ...prev,
        planner: {
          status: "running",
          startedAt: ev.data.ts,
        },
      }));
      return;
    }
    case "planner_completed": {
      ctx.setAgentStates((prev) => ({
        ...prev,
        planner: {
          ...(prev.planner ?? {}),
          status: "done",
          completedAt: ev.data.ts,
          output: { rationale: ev.data.rationale, archetype: ev.data.archetype },
        },
      }));
      // initialize dispatched agents as pending
      ctx.setAgentStates((prev) => {
        const next = { ...prev };
        for (const a of ev.data.agentsDispatched) {
          if (!next[a]) next[a] = { status: "pending" };
        }
        return next;
      });
      return;
    }
    case "agent_started": {
      ctx.setAgentStates((prev) => ({
        ...prev,
        [ev.data.agent]: {
          ...(prev[ev.data.agent] ?? {}),
          status: "running",
          startedAt: ev.data.ts,
        },
      }));
      return;
    }
    case "agent_chunk": {
      const text = ev.data.cumulative ?? ev.data.delta;
      ctx.setAgentStates((prev) => ({
        ...prev,
        [ev.data.agent]: {
          ...(prev[ev.data.agent] ?? { status: "running" }),
          status: "running",
          streamingText: text,
        },
      }));

      // hook chunks animate the H1; page chunks animate sub copy
      if (ev.data.agent === "hook") {
        ctx.setDraft((d) => ({
          ...d,
          hero: { ...(d.hero ?? {}), headline: text },
        }));
      }
      return;
    }
    case "agent_completed": {
      const agent = ev.data.agent;
      ctx.setAgentStates((prev) => ({
        ...prev,
        [agent]: {
          ...(prev[agent] ?? {}),
          status: "done",
          completedAt: ev.data.ts,
          costCents: ev.data.costCents,
          output: ev.data.output,
        },
      }));
      ctx.setSpentCents((c) => c + (ev.data.costCents ?? 0));

      // assemble draft from agent outputs
      ctx.setDraft((d) => mergeAgentOutput(d, agent, ev.data.output));
      return;
    }
    case "assembly_started": {
      return;
    }
    case "quality_scored": {
      ctx.setQuality({
        overall: ev.data.overall,
        dimensions: ev.data.dimensions,
        failing: ev.data.failingDimensions ?? [],
      });
      return;
    }
    case "compliance_flagged": {
      if (ev.data.severity === "block") {
        ctx.setError({
          kind: "compliance_blocked",
          message:
            "We can't generate this — it conflicts with platform or regional rules. Want to tweak the offer?",
        });
      }
      return;
    }
    case "budget_warning": {
      // surface only at 100% — warnings under that are silent for the customer
      if (ev.data.pctUsed >= 100) {
        ctx.setError({
          kind: "budget_exceeded",
          message:
            "This generation needs more power than your current plan. Upgrade for richer, longer runs.",
        });
      }
      return;
    }
    case "human_review_required": {
      // soft state — handled by the page
      return;
    }
    case "regeneration_started": {
      // mark listed agents as running again
      ctx.setAgentStates((prev) => {
        const next = { ...prev };
        for (const a of ev.data.agentsToRerun) {
          next[a] = { ...(next[a] ?? {}), status: "running" };
        }
        return next;
      });
      return;
    }
    case "funnel_published": {
      ctx.setPublishedUrl(ev.data.url);
      return;
    }
    case "generation_completed": {
      ctx.setPublishedUrl(ev.data.url);
      ctx.setPhase("completed");
      return;
    }
    case "generation_failed": {
      ctx.setError(mapFailureReason(ev.data));
      ctx.setPhase("failed");
      return;
    }
    default:
      return;
  }
}

function mergeAgentOutput(
  draft: FunnelPreviewDraft,
  agent: AgentName,
  output: unknown,
): FunnelPreviewDraft {
  if (!output || typeof output !== "object") return draft;
  const o = output as Record<string, any>;

  switch (agent) {
    case "hook": {
      return {
        ...draft,
        hero: {
          ...(draft.hero ?? {}),
          headline: o.headline ?? draft.hero?.headline,
          subhead: o.subhead ?? draft.hero?.subhead,
        },
      };
    }
    case "page": {
      const newSections: PreviewSection[] = Array.isArray(o.sections)
        ? o.sections
        : [];
      return {
        ...draft,
        hero: {
          ...(draft.hero ?? {}),
          headline: o.hero?.headline ?? draft.hero?.headline,
          subhead: o.hero?.subhead ?? draft.hero?.subhead,
          ctaLabel: o.hero?.ctaLabel ?? draft.hero?.ctaLabel,
        },
        sections: dedupeSections([
          ...(draft.sections ?? []),
          ...newSections,
        ]),
      };
    }
    case "image": {
      return {
        ...draft,
        hero: {
          ...(draft.hero ?? {}),
          imageUrl: o.hero?.url ?? draft.hero?.imageUrl,
          imageAlt: o.hero?.alt ?? draft.hero?.imageAlt,
        },
      };
    }
    case "brand_guardian": {
      return {
        ...draft,
        palette: {
          ...(draft.palette ?? {}),
          ...(o.palette ?? {}),
        },
      };
    }
    case "lead_magnet": {
      // append a lead-magnet section if not already present
      const sections = draft.sections ?? [];
      if (sections.some((s) => s.type === "lead_magnet")) return draft;
      return {
        ...draft,
        sections: [
          ...sections,
          {
            id: "lead_magnet",
            type: "lead_magnet",
            title: o.title ?? "Your free kit",
            body: Array.isArray(o.modules)
              ? o.modules.join(" · ")
              : "Free, no-strings asset for your audience.",
          },
        ],
      };
    }
    default:
      return draft;
  }
}

function dedupeSections(sections: PreviewSection[]): PreviewSection[] {
  const seen = new Set<string>();
  const out: PreviewSection[] = [];
  for (const s of sections) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

function mapFailureReason(data: {
  reason: string;
  code: string;
}): StreamErrorState {
  switch (data.code) {
    case "budget_overrun":
      return {
        kind: "budget_exceeded",
        message:
          "This generation needs more power than your current plan. Upgrade for richer, longer runs.",
      };
    case "compliance_block":
      return {
        kind: "compliance_blocked",
        message:
          "We can't generate this — it conflicts with platform or regional rules. Want to tweak the offer?",
      };
    case "user_cancelled":
      return {
        kind: "transport",
        message: "Generation cancelled.",
      };
    default:
      return {
        kind: "generation_failed",
        message: "Something went wrong. Want to try again?",
      };
  }
}

async function safeReadError(res: Response): Promise<string | null> {
  try {
    const j = await res.json();
    if (j && typeof j.error === "string") return j.error;
  } catch {
    // ignore
  }
  return null;
}
