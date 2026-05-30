"use client";

/**
 * Streaming progress list — friendly labels only.
 *
 * Each agent renders as a row with status dot + label + hint. Clicking a
 * row expands its output preview. NEVER renders model IDs, class names,
 * or raw JSON — all transforms go through @/components/funnels/live/agent-labels.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { AgentName } from "@funnel/orchestrator/types";

import { AGENT_DISPLAY_ORDER, AGENT_LABELS } from "./agent-labels";
import type { AgentState } from "./useGenerationStream";

interface AgentProgressListProps {
  agentStates: Partial<Record<AgentName, AgentState>>;
}

export function AgentProgressList({ agentStates }: AgentProgressListProps) {
  // show only agents the orchestrator actually touched (pending or further)
  const visible = AGENT_DISPLAY_ORDER.filter((a) => agentStates[a]);

  if (visible.length === 0) {
    return <ListSkeleton />;
  }

  return (
    <ul className="space-y-1.5">
      {visible.map((agent) => (
        <AgentRow key={agent} agent={agent} state={agentStates[agent]!} />
      ))}
    </ul>
  );
}

function AgentRow({ agent, state }: { agent: AgentName; state: AgentState }) {
  const [expanded, setExpanded] = useState(false);
  const label = AGENT_LABELS[agent] ?? {
    label: "Working on it",
    runningHint: "Working…",
    doneHint: "Done.",
  };
  const canExpand = state.status === "done" && state.output != null;

  const hint =
    state.status === "running"
      ? label.runningHint
      : state.status === "done"
        ? label.doneHint
        : state.status === "error"
          ? "We'll try a different approach."
          : "Up next";

  return (
    <li
      className={cn(
        "rounded-lg border bg-white px-3 py-2.5 transition-colors",
        state.status === "running" && "border-signal-200 bg-signal-50",
        state.status === "done" && "border-slate-200",
        state.status === "error" && "border-error-500/30 bg-error-500/10",
        state.status === "pending" && "border-slate-100 opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded((e) => !e)}
        disabled={!canExpand}
        className={cn(
          "flex w-full items-start gap-3 text-left",
          canExpand && "cursor-pointer",
        )}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <StatusDot status={state.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {label.label}
            </p>
            {state.status === "running" ? (
              <span className="text-[11px] font-medium text-signal-600">
                working…
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-0.5 text-xs text-slate-600",
              state.status === "running" && "text-signal-600",
              state.status === "error" && "text-error-600",
            )}
          >
            {hint}
          </p>
          {/* Show a single-line streaming preview when actively streaming */}
          {state.status === "running" && state.streamingText ? (
            <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">
              “{truncate(state.streamingText, 120)}”
            </p>
          ) : null}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && canExpand ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <FriendlyOutput agent={agent} output={state.output} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function StatusDot({ status }: { status: AgentState["status"] }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-500 text-white">
        <AlertCircle className="h-3 w-3" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-signal-400 opacity-60" />
        <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-signal-500 animate-pulse-dot" />
      </span>
    );
  }
  // pending
  return (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-3"
        >
          <span className="h-5 w-5 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="mt-1.5 h-2 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/**
 * Renders a friendly summary of an agent's output.
 * NEVER renders raw JSON — we cherry-pick safe, human-readable fields per
 * agent. Anything we don't have a renderer for falls back to a short note.
 */
function FriendlyOutput({
  agent,
  output,
}: {
  agent: AgentName;
  output: unknown;
}) {
  if (!output || typeof output !== "object") {
    return <p>Looks good.</p>;
  }
  const o = output as Record<string, any>;

  switch (agent) {
    case "planner":
      return (
        <div>
          <p className="font-semibold text-slate-900">Strategy</p>
          <p className="mt-1">{o.rationale ?? "Plan ready."}</p>
        </div>
      );
    case "hook":
      return (
        <div>
          <p className="font-semibold text-slate-900">Headline</p>
          <p className="mt-1 italic">“{o.headline ?? ""}”</p>
          {o.subhead ? <p className="mt-1 text-slate-600">{o.subhead}</p> : null}
        </div>
      );
    case "page":
      return (
        <div>
          <p className="font-semibold text-slate-900">Sections</p>
          <ul className="mt-1 list-inside list-disc">
            {(o.sections ?? []).slice(0, 6).map((s: any, i: number) => (
              <li key={i}>{s.title ?? s.id}</li>
            ))}
          </ul>
        </div>
      );
    case "lead_magnet":
      return (
        <div>
          <p className="font-semibold text-slate-900">{o.title ?? "Lead magnet"}</p>
          <ul className="mt-1 list-inside list-disc">
            {(o.modules ?? []).map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      );
    case "image":
      return (
        <div>
          <p className="font-semibold text-slate-900">Hero image</p>
          {o.hero?.url ? (
            <img
              src={o.hero.url}
              alt={o.hero.alt ?? ""}
              className="mt-2 aspect-[16/9] w-full rounded object-cover"
            />
          ) : (
            <p className="mt-1">Generated.</p>
          )}
        </div>
      );
    case "ad_copy":
      return (
        <div>
          <p className="font-semibold text-slate-900">Ad copy</p>
          <p className="mt-1">{o.primary_text ?? ""}</p>
          <p className="mt-1 text-slate-500">CTA: {o.cta ?? "Learn more"}</p>
        </div>
      );
    case "audience":
      return (
        <div>
          <p className="font-semibold text-slate-900">Targeting</p>
          <p className="mt-1">{o.primary ?? ""}</p>
        </div>
      );
    case "email":
      return (
        <div>
          <p className="font-semibold text-slate-900">Email sequence</p>
          <ul className="mt-1 list-inside list-disc">
            {(o.sequence ?? []).map((m: any, i: number) => (
              <li key={i}>
                <span className="text-slate-500">{m.delay}</span> — {m.subject}
              </li>
            ))}
          </ul>
        </div>
      );
    case "sms":
      return (
        <div>
          <p className="font-semibold text-slate-900">SMS sequence</p>
          <ul className="mt-1 list-inside list-disc">
            {(o.sequence ?? []).map((m: any, i: number) => (
              <li key={i}>
                <span className="text-slate-500">{m.delay}</span> — {m.body}
              </li>
            ))}
          </ul>
        </div>
      );
    case "upsell":
      return (
        <div>
          <p className="font-semibold text-slate-900">Upsells</p>
          <ul className="mt-1 list-inside list-disc">
            {(o.ladder ?? []).map((m: any, i: number) => (
              <li key={i}>
                {m.title} — <span className="text-slate-500">{m.price}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "voice_script":
      return (
        <div>
          <p className="font-semibold text-slate-900">Voice opening</p>
          <p className="mt-1 italic">“{o.opening ?? ""}”</p>
        </div>
      );
    case "brand_guardian":
      return (
        <div>
          <p className="font-semibold text-slate-900">Brand</p>
          <div className="mt-2 flex items-center gap-2">
            {(["primary", "secondary", "accent"] as const).map((k) => (
              <span
                key={k}
                title={k}
                className="inline-block h-6 w-6 rounded-full border border-slate-200"
                style={{ background: o.palette?.[k] ?? "#ccc" }}
              />
            ))}
          </div>
        </div>
      );
    case "qa":
      return (
        <div>
          <p className="font-semibold text-slate-900">Quality score</p>
          <p className="mt-1 text-2xl font-bold text-success-600">
            {o.overall ?? "—"}
          </p>
        </div>
      );
    case "fact_check":
      return (
        <p>
          {o.verifiedClaims ?? 0} claims verified.
          {(o.flagged ?? []).length > 0
            ? ` ${o.flagged.length} need a closer look.`
            : ""}
        </p>
      );
    case "compliance":
      return (
        <p>
          {(o.findings ?? []).length === 0
            ? "No issues."
            : `${o.findings.length} item(s) reviewed.`}
        </p>
      );
    default:
      return <p>Done.</p>;
  }
}
