"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Sparkles, Workflow } from "lucide-react";
import {
  FunnelPreviewRenderer,
  MobilePreviewToggle,
  SectionEditDialog,
  type EditAction,
  type PreviewViewport,
  type RendererFunnel,
} from "@funnel/ui";

import { automatedFunnelToRenderer } from "@/lib/funnels/automated-to-renderer";

type ProviderReadiness = {
  googleAuth: boolean;
  openai: boolean;
  anthropic: boolean;
  replicate: boolean;
  railwayStorage: boolean;
  resend: boolean;
  stripe: boolean;
  paypal: boolean;
  signalwire: boolean;
};

// Loose: matches AutomatedFunnel shape from `@funnel/orchestrator`. We don't
// import the type directly here to avoid pulling a server-only chain into the
// client bundle — the runtime shape is enforced by the API route.
type AutomatedFunnelLike = {
  id: string;
  slug: string;
  public_url: string;
  quality_score: number;
  generated_at: string;
  industry: string;
  styleGuide: { palette: { primary: string; secondary: string; accent: string }; typography: { heading: string; body: string }; radius: string; shadow: string; button: { gradient: string } };
  pages: any[];
  assets: any[];
  automation: { userWorkRequired: string; steps: Array<{ id: string; label: string; engine: string; state: string }> };
};

type GenerationResponse = {
  ok: true;
  publish_url: string;
  provider_readiness: ProviderReadiness;
  next_steps: Array<{ provider: string; env: string[]; purpose: string }>;
  funnel: AutomatedFunnelLike;
};

const INDUSTRIES = ["Solar", "Med spa", "Dental", "Insurance", "Real estate", "B2B SaaS", "HVAC"];
const BRAND_GRADIENT = "linear-gradient(135deg,#6817d2 0%,#d91a8f 48%,#ff7a00 100%)";

// A representative streaming-progress script. The real SSE endpoint streams
// updates per agent — until that's wired in, we play back this list as the
// generation runs so users see the multi-agent system at work.
const GENERATION_STAGES: Array<{ id: string; label: string; agent: string }> = [
  { id: "research", label: "Researching industry & competitors", agent: "Planner" },
  { id: "offer", label: "Designing the offer stack", agent: "Strategist" },
  { id: "copy", label: "Writing landing page copy", agent: "Writer" },
  { id: "design", label: "Generating hero + lead magnet visuals", agent: "Designer" },
  { id: "form", label: "Building qualification form", agent: "Engineer" },
  { id: "proof", label: "Assembling proof stack & testimonials", agent: "Editor" },
  { id: "thankyou", label: "Wiring thank-you & upsell pages", agent: "Engineer" },
  { id: "compliance", label: "Running compliance & fact-check", agent: "Compliance" },
];

export function OfferGeneratorClient() {
  const [industry, setIndustry] = useState("Solar");
  const [audience, setAudience] = useState("Homeowners with high electric bills");
  const [offer, setOffer] = useState("Give a savings plan first, then book qualified consultations");
  const [businessName, setBusinessName] = useState("GoFunnelAI Preview");
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rendererResult = useMemo(
    () => (result ? automatedFunnelToRenderer(result.funnel as any) : null),
    [result],
  );
  const rendererFunnel: RendererFunnel | null = rendererResult?.funnel ?? null;
  const activePageId = rendererResult?.pageIds[activePageIdx];

  async function submit() {
    setLoading(true);
    setError(null);
    setCompletedStages([]);
    setResult(null);

    // Drive a paced playback of the agent stages so the user sees the
    // multi-agent system at work while the (sync) API call is in flight.
    const playbackTimers: ReturnType<typeof setTimeout>[] = [];
    GENERATION_STAGES.forEach((stage, i) => {
      playbackTimers.push(setTimeout(() => setCompletedStages((prev) => [...prev, stage.id]), 350 * (i + 1)));
    });

    try {
      const res = await fetch("/api/generate/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, audience, offer, geography: "US", businessName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data as GenerationResponse);
      // Ensure all stages flip to complete.
      setCompletedStages(GENERATION_STAGES.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
      playbackTimers.forEach(clearTimeout);
    }
  }

  function handleEditSection(sectionId: string, _action: EditAction) {
    setEditingSectionId(sectionId);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* LEFT — input form + streaming progress */}
        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-signal-600" />
              <div>
                <h1 className="text-xl font-semibold text-slate-950">Generate and publish</h1>
                <p className="mt-1 text-sm text-slate-600">Talk to GoFunnelAI. It builds the pages, offer, assets, forms, and follow-up path.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-800">
                Business name
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <label className="block text-sm font-medium text-slate-800">
                Industry
                <select
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {INDUSTRIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-800">
                Audience
                <input
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <label className="block text-sm font-medium text-slate-800">
                Goal
                <textarea
                  value={offer}
                  onChange={(event) => setOffer(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: BRAND_GRADIENT }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
                {loading ? "Building live funnel..." : result ? "Regenerate funnel" : "Build and publish funnel"}
              </button>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>

          {/* Streaming agent progress */}
          {(loading || completedStages.length > 0) && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-950">Generation progress</h2>
                <span className="text-xs text-slate-500">
                  {completedStages.length}/{GENERATION_STAGES.length} steps
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedStages.length / GENERATION_STAGES.length) * 100}%`,
                    background: BRAND_GRADIENT,
                  }}
                />
              </div>
              <ol className="mt-4 space-y-2">
                {GENERATION_STAGES.map((stage) => {
                  const done = completedStages.includes(stage.id);
                  const inFlight = !done && loading && completedStages.length === GENERATION_STAGES.indexOf(stage);
                  return (
                    <li key={stage.id} className="flex items-start gap-2 text-xs">
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : inFlight ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-signal-600" />
                      ) : (
                        <div className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-slate-200" />
                      )}
                      <div className="flex-1">
                        <div className={done ? "font-semibold text-slate-900" : "text-slate-700"}>{stage.label}</div>
                        <div className="text-slate-500">Agent: {stage.agent}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Quality</div>
                  <div className="text-2xl font-bold text-slate-950">{result.funnel.quality_score}</div>
                </div>
                <a
                  href={result.publish_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open live funnel <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-2 text-xs text-slate-500">{result.funnel.public_url}</p>
            </div>
          )}
        </section>

        {/* RIGHT — live visual preview */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-950">Live preview</h2>
              {rendererResult && rendererResult.pageIds.length > 1 && (
                <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs">
                  {rendererResult.pageIds.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActivePageIdx(i)}
                      className={
                        "rounded px-2 py-1 font-medium " +
                        (activePageIdx === i ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
                      }
                    >
                      Page {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MobilePreviewToggle value={viewport} onChange={setViewport} />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            {rendererFunnel ? (
              <FunnelPreviewRenderer
                funnel={rendererFunnel}
                mode="edit"
                onEditSection={handleEditSection}
                activePageId={activePageId}
                mobileFrame={viewport === "mobile"}
                brandTokens={rendererFunnel.brand_tokens}
              />
            ) : loading ? (
              <SkeletonFunnelPreview />
            ) : (
              <div className="flex h-[640px] items-center justify-center bg-white p-10 text-center text-sm text-slate-500">
                Fill out the form on the left and click <span className="font-semibold text-slate-900">Build and publish funnel</span>{" "}
                to see a real rendered page appear here.
              </div>
            )}
          </div>
        </section>
      </div>

      <SectionEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectionId={editingSectionId}
        onSubmit={() => {
          // Placeholder until the edit endpoint is wired in.
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function SkeletonFunnelPreview() {
  return (
    <div className="space-y-6 bg-white p-10">
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-12 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-3 pt-2">
          <div className="h-11 w-32 animate-pulse rounded bg-signal-200" />
          <div className="h-11 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}
