"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewState = {
  headline: string;
  subhead: string;
  leadMagnet: string;
  modules: string[];
  cta: string;
  quality: number;
  publishedUrl: string | null;
};

const DEFAULT_PROMPT = "I sell solar installs to homeowners in Phoenix";
const DEFAULT_PREVIEW: PreviewState = {
  headline: "Free Solar Savings Plan for Phoenix Homeowners",
  subhead:
    "Estimate roof fit, bill range, incentive readiness, and next steps before booking a consultation.",
  leadMagnet: "Free Solar Savings Plan",
  modules: ["Bill worksheet", "Roof-fit checklist", "Incentive review"],
  cta: "Get my solar savings plan",
  quality: 91,
  publishedUrl: null,
};

/**
 * Marketing home hero.
 *
 * Copy: verbatim from doc 10 §1.1 Hero.
 * Visual: split-screen 6s loop (left = user typing; right = page assembling).
 * Implemented as a CSS-driven animated scene — no JS animation library.
 */
export function HomeHero() {
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT);
  const [preview, setPreview] = React.useState<PreviewState>(DEFAULT_PREVIEW);
  const [loading, setLoading] = React.useState(false);

  async function generatePreview() {
    setLoading(true);
    try {
      const response = await fetch("/api/generate/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: inferIndustry(prompt),
          audience: inferAudience(prompt),
          offer: "Give a high-value free asset first, then ask for the qualified consultation.",
          geography: "US",
        }),
      });
      if (!response.ok) throw new Error("Preview generation failed");
      const data = await response.json();
      const intel = data.funnel?.offer_intelligence;
      setPreview({
        headline: intel?.offerStack?.corePromise ?? preview.headline,
        subhead: intel?.leadMagnet?.promise ?? preview.subhead,
        leadMagnet: intel?.leadMagnet?.title ?? preview.leadMagnet,
        modules: intel?.leadMagnet?.modules?.slice(0, 3) ?? preview.modules,
        cta: intel?.offerStack?.mainCta ?? preview.cta,
        quality: data.funnel?.quality_score ?? preview.quality,
        publishedUrl: data.publish_url ?? null,
      });
    } catch {
      setPreview(buildLocalPreview(prompt));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="container py-20 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0 w-full max-w-[calc(100vw-2rem)] space-y-8 sm:max-w-none">
            <h1 className="text-display-2 lg:text-display-1 font-display text-slate-900 dark:text-slate-50">
              Type your business.
              <br />
              Get a customer.
            </h1>
            <p className="w-full max-w-[calc(100vw-2rem)] break-words text-body-lg text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300 sm:max-w-xl">
              GoFunnel is an autonomous lead generation system. Tell it what you sell in one sentence
              — it builds the landing page, writes the ads, qualifies the leads by voice, and books
              the calls. You watch.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button size="lg" asChild>
                {/* In INTERNAL_PREVIEW_MODE the dashboard is open to the team
                    without a login wall — point the hero CTA straight at it
                    instead of the signup form. NEXT_PUBLIC_* prefix lets the
                    flag reach client components. */}
                {process.env.NEXT_PUBLIC_INTERNAL_PREVIEW_MODE === "1" ? (
                  <Link href="/dashboard">
                    Open the dashboard <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link href="/signup">
                    Build my funnel — free <ArrowRight className="size-4" />
                  </Link>
                )}
              </Button>
              <Link
                href="/grade"
                className="inline-flex items-center gap-1 text-body text-slate-700 hover:text-slate-900 hover:underline underline-offset-4"
              >
                Or grade your existing funnel free <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="text-body-sm text-slate-500">
              60 seconds. No credit card. Free until you make your first $1,000.
            </p>
          </div>

          <div
            className="relative w-full max-w-[480px] mx-auto rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:bg-slate-800 dark:border-slate-700"
            aria-label="Generated funnel preview"
          >
            <HeroScenePreview
              prompt={prompt}
              preview={preview}
              loading={loading}
              onPromptChange={setPrompt}
              onGenerate={generatePreview}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroScenePreview({
  prompt,
  preview,
  loading,
  onPromptChange,
  onGenerate,
}: {
  prompt: string;
  preview: PreviewState;
  loading: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="p-5 sm:p-6 flex min-h-[560px] flex-col gap-4">
      <div className="space-y-2">
        <div className="h-2 w-24 rounded bg-slate-200" />
        <label className="sr-only" htmlFor="hero-business-prompt">
          Business description
        </label>
        <textarea
          id="hero-business-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 font-mono text-body-sm text-slate-700 outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-100"
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[linear-gradient(135deg,#6817d2_0%,#d91a8f_48%,#ff7a00_100%)] px-3 text-body-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="size-4" />
          {loading ? "Building live funnel..." : "Build live funnel"}
        </button>
        {preview.publishedUrl ? (
          <Link
            href={preview.publishedUrl}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-body-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Open generated funnel <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">
            Generated landing page
          </p>
          <h2 className="mt-3 text-h4 font-display text-slate-950">{preview.headline}</h2>
          <p className="mt-2 text-body-sm text-slate-600">{preview.subhead}</p>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-body-sm font-semibold text-slate-950">{preview.leadMagnet}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {preview.modules.map((module) => (
                <span key={module} className="rounded-full bg-signal-50 px-2.5 py-1 text-caption font-medium text-signal-700">
                  {module}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["Name", "Email", "Monthly bill"].map((field) => (
              <div key={field} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-caption text-slate-500">
                {field}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-[linear-gradient(135deg,#6817d2_0%,#d91a8f_48%,#ff7a00_100%)] px-4 py-3 text-center text-body-sm font-semibold text-white">
            {preview.cta}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Lead magnet", "Ads", "RevTry"].map((item) => (
            <div key={item} className="rounded-md bg-white px-3 py-2 text-center text-caption font-medium text-slate-600 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full bg-signal-500 text-white px-3 py-1.5 shadow-md"
      >
        <span className="text-caption font-medium">Quality</span>
        <span className="text-body-sm font-mono font-semibold tabular-nums">{preview.quality}</span>
      </div>
    </div>
  );
}

function inferIndustry(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("dental")) return "Dental";
  if (lower.includes("roof")) return "Roofing";
  if (lower.includes("hvac") || lower.includes("air conditioning")) return "HVAC";
  if (lower.includes("saas") || lower.includes("software")) return "B2B SaaS";
  if (lower.includes("insurance")) return "Insurance";
  return "Solar";
}

function inferAudience(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("homeowner")) return "Homeowners with high purchase intent";
  if (lower.includes("founder")) return "Founders evaluating a better growth system";
  if (lower.includes("patient")) return "Patients researching options before booking";
  return "Qualified buyers";
}

function buildLocalPreview(prompt: string): PreviewState {
  const industry = inferIndustry(prompt);
  const leadMagnet =
    industry === "Dental"
      ? "Free Smile Readiness Check"
      : industry === "Roofing"
        ? "Free Roof Risk Report"
        : industry === "HVAC"
          ? "Free Comfort Audit"
          : "Free Solar Savings Plan";
  return {
    headline: `${leadMagnet} for Qualified Buyers`,
    subhead: "Give people a useful answer first, then route qualified leads into booking.",
    leadMagnet,
    modules: ["Instant checklist", "Proof review", "Booking handoff"],
    cta: `Get my ${leadMagnet.toLowerCase()}`,
    quality: 89,
    publishedUrl: null,
  };
}
