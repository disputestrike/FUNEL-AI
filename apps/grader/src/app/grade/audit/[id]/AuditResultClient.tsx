"use client";

import * as React from "react";

import { EmailGate } from "@/components/grader/EmailGate";
import { Footer } from "@/components/grader/Footer";
import { ImprovementsList } from "@/components/grader/ImprovementsList";
import { PreviewCta } from "@/components/grader/PreviewCta";
import { ScoreDial } from "@/components/grader/ScoreDial";
import { ShareBar } from "@/components/grader/ShareBar";
import { Stepper, type Step } from "@/components/grader/Stepper";
import { SubScoreCard } from "@/components/grader/SubScoreCard";
import type {
  AgentName,
  AuditResultPayload,
  AuditStreamEvent,
  Improvement,
} from "@funnel/shared";
import { displayUrl } from "@/lib/utils";

interface AuditResultClientProps {
  auditId: string;
  url: string;
  hostname: string;
  shareCode: string;
  initialStatus: string;
}

const STEP_ORDER: Array<{ id: Step["id"]; label: string; hint?: string }> = [
  { id: "queued", label: "Queued", hint: "Picking up your URL" },
  { id: "rendering", label: "Rendering page", hint: "Headless browser, full-page screenshot" },
  { id: "scoring", label: "Scoring with 5 agents", hint: "Hook, form, trust, speed, compliance" },
  { id: "done", label: "Done", hint: "Aggregating results" },
];

export function AuditResultClient({
  auditId,
  url,
  hostname,
  shareCode,
  initialStatus,
}: AuditResultClientProps) {
  const [activeStep, setActiveStep] = React.useState<string>(initialStatus);
  const [subscores, setSubscores] = React.useState<Partial<Record<AgentName, number>>>({});
  const [result, setResult] = React.useState<AuditResultPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [emailGateOpen, setEmailGateOpen] = React.useState(false);
  const [previewUnlocked, setPreviewUnlocked] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const es = new EventSource(`/api/audit/${auditId}/stream`);

    es.addEventListener("queued", () => setActiveStep("queued"));
    es.addEventListener("rendering", () => setActiveStep("rendering"));
    es.addEventListener("rendered", () => setActiveStep("scoring"));
    es.addEventListener("scoring", () => setActiveStep("scoring"));

    es.addEventListener("agent_completed", (raw) => {
      try {
        const evt = JSON.parse((raw as MessageEvent).data) as AuditStreamEvent;
        if (evt.type === "agent_completed") {
          setSubscores((s) => ({ ...s, [evt.agent]: evt.subscore }));
        }
      } catch {
        /* ignore malformed */
      }
    });

    es.addEventListener("done", (raw) => {
      try {
        const evt = JSON.parse((raw as MessageEvent).data) as AuditStreamEvent;
        if (evt.type === "done") {
          setResult(evt.payload);
          setActiveStep("done");
        }
      } catch (err) {
        setError("Couldn't read audit result.");
      }
      es.close();
    });

    es.addEventListener("failed", (raw) => {
      try {
        const evt = JSON.parse((raw as MessageEvent).data) as AuditStreamEvent;
        if (evt.type === "failed") setError(evt.reason);
      } catch {
        setError("Audit failed.");
      }
      es.close();
    });

    es.onerror = () => {
      // Browser auto-reconnects; if the stream is exhausted, just close.
      es.close();
    };

    return () => es.close();
  }, [auditId]);

  // Auto-pop the email gate 4s after a result lands.
  React.useEffect(() => {
    if (!result || pdfUrl) return;
    const t = setTimeout(() => setEmailGateOpen(true), 4000);
    return () => clearTimeout(t);
  }, [result, pdfUrl]);

  const steps: Step[] = STEP_ORDER.map((s) => {
    const order = STEP_ORDER.findIndex((x) => x.id === s.id);
    const active = STEP_ORDER.findIndex((x) => x.id === activeStep);
    let state: Step["state"] = "pending";
    if (error) state = order <= active ? "failed" : "pending";
    else if (order < active) state = "done";
    else if (order === active) state = result ? "done" : "active";
    return { ...s, state };
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <header className="container pt-10 pb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold text-ink-900">Audit result</h1>
          <span className="font-mono text-sm text-ink-900/60">{displayUrl(url)}</span>
        </div>
      </header>

      {!result && !error && (
        <section className="container py-10">
          <Stepper steps={steps} />
          {Object.keys(subscores).length > 0 && (
            <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(["hook", "form", "trust", "speed", "compliance"] as AgentName[]).map((a) => (
                <SubScoreCard
                  key={a}
                  agent={a}
                  score={subscores[a] ?? null}
                  loading={subscores[a] === undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {error && (
        <section className="container py-16 text-center">
          <h2 className="font-display text-2xl font-bold text-danger">Audit failed</h2>
          <p className="mt-2 text-ink-900/70">{error}</p>
          <p className="mt-4 text-sm text-ink-900/50">Try again with a different URL.</p>
        </section>
      )}

      {result?.score && (
        <section className="container space-y-10 pb-20">
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-ink-100 bg-white p-8 shadow-sm sm:flex-row sm:items-center">
            <ScoreDial value={result.score.overall} grade={result.score.grade} />
            <div className="flex-1">
              <h2 className="font-display text-2xl font-bold text-ink-900">
                {hostname} scored {result.score.overall}/100
              </h2>
              <p className="mt-2 text-ink-900/80">{result.score.critique}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-900/70">
                Confidence: <span className="font-semibold">{result.score.confidence}</span>
                {result.score.degraded_agents.length > 0 && (
                  <span className="text-warning">
                    · {result.score.degraded_agents.length} agent(s) skipped
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(["hook", "form", "trust", "speed", "compliance"] as AgentName[]).map((a) => (
              <SubScoreCard
                key={a}
                agent={a}
                score={result.score!.subscores[a]}
                critique={getCritiqueLine(result.score!.improvements, a)}
                degraded={result.score!.degraded_agents.includes(a)}
              />
            ))}
          </div>

          <div>
            <h3 className="font-display text-xl font-bold text-ink-900">3 specific improvements</h3>
            <p className="mt-1 text-sm text-ink-900/60">Ranked by impact ÷ effort.</p>
            <div className="mt-4">
              <ImprovementsList improvements={result.score.improvements} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ShareBar shareCode={shareCode} scoreOverall={result.score.overall} hostname={hostname} />
            {pdfUrl ? (
              <a
                href={pdfUrl}
                className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm font-semibold text-success hover:bg-success/10"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download your full PDF report →
              </a>
            ) : (
              <button
                onClick={() => setEmailGateOpen(true)}
                className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-left text-sm font-semibold text-brand-700 hover:bg-brand-100"
              >
                Email me the full PDF report →
              </button>
            )}
          </div>

          <PreviewCta
            auditId={auditId}
            unlocked={previewUnlocked}
            onUnlock={() => setEmailGateOpen(true)}
          />
        </section>
      )}

      <EmailGate
        auditId={auditId}
        open={emailGateOpen}
        onOpenChange={setEmailGateOpen}
        onCaptured={(p) => {
          setPdfUrl(p.pdf_url);
          setPreviewUnlocked(p.preview_unlocked);
        }}
      />

      <Footer />
    </main>
  );
}

function getCritiqueLine(improvements: Improvement[], agent: AgentName): string | undefined {
  return improvements.find((i) => i.category === agent)?.detail;
}
