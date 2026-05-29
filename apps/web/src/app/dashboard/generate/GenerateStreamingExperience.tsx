"use client";

/**
 * GoFunnelAI live-generation page.
 *
 * LEFT  — AgentProgressList (friendly labels, status, cost meter)
 * RIGHT — FunnelPreviewRenderer (sections materialize as agents finish)
 *
 * Everything customer-facing — friendly labels only. NO model IDs, agent
 * class names, or raw JSON ever rendered.
 */

import { motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  PartyPopper,
  RotateCw,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { FunnelPreviewRenderer } from "@/components/funnels/FunnelPreviewRenderer";
import { AgentProgressList } from "@/components/funnels/live/AgentProgressList";
import {
  useGenerationStream,
  type StreamErrorState,
} from "@/components/funnels/live/useGenerationStream";

export interface GenerateStreamingExperienceProps {
  initialInput: {
    workspace_id: string;
    industry: string;
    business_profile: {
      offer: string;
      target_customer?: string;
      geography?: string;
      businessName?: string;
      brandUrl?: string | null;
    };
  };
}

export function GenerateStreamingExperience({
  initialInput,
}: GenerateStreamingExperienceProps) {
  const [input] = useState(initialInput);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const stream = useGenerationStream({ input });

  // background gradient subtly shifts as different agents become active
  const activeAgent = useMemo(() => {
    const entries = Object.entries(stream.agentStates);
    const running = entries.find(([, s]) => s?.status === "running");
    return running?.[0] ?? null;
  }, [stream.agentStates]);

  // confetti when QA passes
  const qaPassed = Boolean(stream.quality && stream.quality.overall >= 80);
  const showConfetti = Boolean(
    stream.phase === "completed" && qaPassed && !stream.error,
  );

  // Optional completion ding — off by default; user opts in via local pref.
  useEffect(() => {
    if (!showConfetti) return;
    if (typeof window === "undefined") return;
    const enabled =
      window.localStorage?.getItem("gofunnelai:soundOnComplete") === "1";
    if (!enabled) return;
    try {
      // Tiny inline WebAudio "ding" — no asset required.
      const Ctx =
        (window.AudioContext as typeof AudioContext | undefined) ??
        ((window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);
      if (!Ctx) return;
      const ac = new Ctx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g);
      g.connect(ac.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(880, ac.currentTime);
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.45);
      o.start();
      o.stop(ac.currentTime + 0.5);
    } catch {
      // silent: audio is optional
    }
  }, [showConfetti]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <BackgroundGradient activeAgent={activeAgent} />

      <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <TopBar input={input} stream={stream} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[420px,1fr]">
          {/* LEFT: progress */}
          <aside className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-signal-700">
                  Live build
                </p>
                <h2 className="mt-1 text-h4 font-semibold text-slate-900">
                  Your funnel is coming together
                </h2>
              </div>
              {stream.phase === "running" || stream.phase === "connecting" ? (
                <Loader2 className="h-5 w-5 animate-spin text-signal-500" />
              ) : null}
            </header>

            <AgentProgressList agentStates={stream.agentStates} />

            <CostMeter
              spentCents={stream.spentCents}
              budgetCents={stream.budgetCents}
            />

            {stream.error ? (
              <ErrorBanner error={stream.error} onRetry={stream.retry} />
            ) : null}

            <FinalActions
              show={showConfetti}
              publishedUrl={stream.publishedUrl}
              quality={stream.quality?.overall ?? null}
            />

            {stream.quality && stream.quality.failing.length > 0 ? (
              <PolishingNotice failing={stream.quality.failing} />
            ) : null}
          </aside>

          {/* RIGHT: live preview */}
          <main className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-signal-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Live preview
                </span>
              </div>
              <DeviceToggle device={device} onChange={setDevice} />
            </div>

            <Suspense fallback={<PreviewFallback />}>
              <FunnelPreviewRenderer
                draft={stream.draft}
                device={device}
                isStreaming={
                  stream.phase === "running" || stream.phase === "connecting"
                }
              />
            </Suspense>
          </main>
        </div>
      </div>

      {showConfetti ? <Confetti /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({
  input,
  stream,
}: {
  input: GenerateStreamingExperienceProps["initialInput"];
  stream: ReturnType<typeof useGenerationStream>;
}) {
  const elapsed = useElapsed(stream.startedAt);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-h3 font-semibold text-slate-900">
          Generating your {input.industry} funnel
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {input.business_profile.offer}
        </p>
      </div>
      <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
        {stream.phase === "completed"
          ? `Built in ${formatSeconds(elapsed)}`
          : stream.phase === "failed"
            ? "Paused"
            : `Elapsed ${formatSeconds(elapsed)}`}
      </div>
    </div>
  );
}

function useElapsed(startedAt: number | null): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, Date.now() - startedAt) : 0;
}

function formatSeconds(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s - m * 60}s`;
}

/* -------------------------------------------------------------------------- */
/* Cost meter                                                                 */
/* -------------------------------------------------------------------------- */

function CostMeter({
  spentCents,
  budgetCents,
}: {
  spentCents: number;
  budgetCents: number;
}) {
  const pct = Math.min(100, Math.round((spentCents / Math.max(1, budgetCents)) * 100));
  const dollars = (spentCents / 100).toFixed(2);
  const budgetDollars = (budgetCents / 100).toFixed(2);
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Powering your generation</span>
        <span className="font-semibold text-slate-900">
          ${dollars} of ${budgetDollars} budget used
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className={cn(
            "h-full rounded-full",
            pct >= 90 ? "bg-warning-500" : "bg-signal-500",
          )}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Device toggle (desktop ↔ mobile)                                           */
/* -------------------------------------------------------------------------- */

function DeviceToggle({
  device,
  onChange,
}: {
  device: "desktop" | "mobile";
  onChange: (next: "desktop" | "mobile") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange("desktop")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
          device === "desktop"
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-50",
        )}
        aria-pressed={device === "desktop"}
      >
        <Monitor className="h-3.5 w-3.5" />
        Desktop
      </button>
      <button
        type="button"
        onClick={() => onChange("mobile")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
          device === "mobile"
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-50",
        )}
        aria-pressed={device === "mobile"}
      >
        <Smartphone className="h-3.5 w-3.5" />
        Mobile
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Final actions                                                              */
/* -------------------------------------------------------------------------- */

function FinalActions({
  show,
  publishedUrl,
  quality,
}: {
  show: boolean;
  publishedUrl: string | null;
  quality: number | null;
}) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-5 rounded-xl border border-success-500/30 bg-success-500/10 p-4"
    >
      <div className="flex items-center gap-2 text-success-600">
        <PartyPopper className="h-5 w-5" />
        <p className="text-sm font-semibold">Looks great!</p>
        {quality !== null ? (
          <span className="ml-auto rounded-full bg-success-500/20 px-2 py-0.5 text-xs font-semibold text-success-600">
            Quality {quality}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-success-600">
        Your funnel is ready to launch.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={publishedUrl ?? "#"}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Launch it
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Tweak something?
        </button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

function ErrorBanner({
  error,
  onRetry,
}: {
  error: StreamErrorState;
  onRetry: () => void;
}) {
  const isBudget = error.kind === "budget_exceeded";
  const isCompliance = error.kind === "compliance_blocked";
  return (
    <div
      className={cn(
        "mt-5 rounded-xl border p-4",
        isBudget && "border-warning-500/30 bg-warning-500/10",
        isCompliance && "border-error-500/30 bg-error-500/10",
        !isBudget && !isCompliance && "border-slate-200 bg-slate-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          isBudget && "text-warning-600",
          isCompliance && "text-error-600",
          !isBudget && !isCompliance && "text-slate-900",
        )}
      >
        {isBudget
          ? "More power needed"
          : isCompliance
            ? "Can't generate this"
            : "Hit a snag"}
      </p>
      <p className="mt-1 text-xs text-slate-700">{error.message}</p>
      <div className="mt-3 flex gap-2">
        {isBudget ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Upgrade
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <RotateCw className="h-3 w-3" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function PolishingNotice({
  failing,
}: {
  failing: { name: string; reason: string }[];
}) {
  return (
    <div className="mt-4 rounded-xl border border-signal-200 bg-signal-50/60 p-4">
      <div className="flex items-center gap-2 text-signal-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p className="text-sm font-semibold">Polishing…</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-signal-700">
        {failing.slice(0, 3).map((f, i) => (
          <li key={i}>• Tightening up {prettifyDimension(f.name)}</li>
        ))}
      </ul>
    </div>
  );
}

function prettifyDimension(name: string): string {
  switch (name) {
    case "clarity":
      return "clarity";
    case "specificity":
      return "specificity";
    case "proof":
      return "proof";
    case "cta_strength":
      return "the call-to-action";
    case "compliance":
      return "compliance";
    case "brand":
      return "brand alignment";
    default:
      return name.replace(/_/g, " ");
  }
}

/* -------------------------------------------------------------------------- */
/* Preview fallback (Suspense)                                                */
/* -------------------------------------------------------------------------- */

function PreviewFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-slate-200 bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-signal-500" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Background gradient that subtly shifts                                     */
/* -------------------------------------------------------------------------- */

function BackgroundGradient({ activeAgent }: { activeAgent: string | null }) {
  const palette = useMemo(() => activeAgentColor(activeAgent), [activeAgent]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0"
      style={{
        background: `radial-gradient(1200px 600px at 10% 0%, ${palette.a}26, transparent 60%), radial-gradient(900px 500px at 100% 100%, ${palette.b}1f, transparent 50%)`,
        transition: "background 1.2s ease-in-out",
      }}
    />
  );
}

function activeAgentColor(agent: string | null): { a: string; b: string } {
  switch (agent) {
    case "hook":
    case "page":
    case "ad_copy":
    case "email":
    case "sms":
      return { a: "#0F4FF0", b: "#22D3A5" };
    case "image":
    case "video":
      return { a: "#F25C2C", b: "#0F4FF0" };
    case "brand_guardian":
      return { a: "#22D3A5", b: "#0F4FF0" };
    case "qa":
    case "fact_check":
    case "compliance":
      return { a: "#0A2540", b: "#22D3A5" };
    default:
      return { a: "#0F4FF0", b: "#0A2540" };
  }
}

/* -------------------------------------------------------------------------- */
/* Confetti (lightweight, CSS-only)                                           */
/* -------------------------------------------------------------------------- */

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 64 }), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => (
        <motion.span
          key={i}
          initial={{
            y: -20,
            x: `${Math.random() * 100}vw`,
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            y: "110vh",
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.4 + Math.random() * 1.6,
            delay: Math.random() * 0.6,
            ease: [0.2, 0.7, 0.4, 1],
          }}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            background: ["#0F4FF0", "#22D3A5", "#F25C2C", "#FFB020"][i % 4],
          }}
        />
      ))}
    </div>
  );
}
