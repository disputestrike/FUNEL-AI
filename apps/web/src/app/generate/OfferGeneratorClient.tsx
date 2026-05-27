"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  FileText,
  ImageIcon,
  Loader2,
  Route,
  Sparkles,
} from "lucide-react";

type GenerationResponse = {
  quality_score: number;
  funnel: {
    offer_intelligence: {
      industryLabel: string;
      kbVersion: string;
      leadMagnet: {
        title: string;
        format: string;
        promise: string;
        modules: string[];
        qualificationFields: string[];
      };
      offerStack: {
        corePromise: string;
        mainCta: string;
        riskReversal: string;
        proofAssets: string[];
      };
      upsellLadder: Array<{
        stage: string;
        title: string;
        copy: string;
        displayPrice: string;
        trigger: string;
      }>;
      creativeAssets: Array<{
        slotId: string;
        channel: string;
        description: string;
        count: number;
        license: string;
        status: string;
      }>;
      evidence: Array<{
        area: string;
        source: string;
        proof: string;
        state: string;
      }>;
    };
  };
};

const INDUSTRIES = ["Solar", "Med spa", "Dental", "Insurance", "Real estate", "B2B SaaS", "HVAC"];

export function OfferGeneratorClient() {
  const [industry, setIndustry] = useState("Solar");
  const [audience, setAudience] = useState("Homeowners with high electric bills");
  const [offer, setOffer] = useState("Give a savings plan first, then book qualified consultations");
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intel = result?.funnel.offer_intelligence;
  const evidence = useMemo(() => intel?.evidence.slice(0, 8) ?? [], [intel]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/offer-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, audience, offer, geography: "US" }),
      });
      if (!res.ok) throw new Error("Generation failed");
      setResult((await res.json()) as GenerationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold text-ink-900">Generate funnel intelligence</h1>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink-800">
            Industry
            <select
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900"
            >
              {INDUSTRIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-ink-800">
            Audience
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink-900"
            />
          </label>

          <label className="block text-sm font-medium text-ink-800">
            Offer goal
            <textarea
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink-900"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </section>

      <section className="space-y-6">
        {intel ? (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Metric label="Quality" value={String(result.quality_score)} />
              <Metric label="Industry" value={intel.industryLabel} />
              <Metric label="KB" value={intel.kbVersion} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel icon={<FileText className="h-5 w-5" />} title={intel.leadMagnet.title}>
                <p className="text-sm text-slate-700">{intel.leadMagnet.promise}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {intel.leadMagnet.modules.map((module) => (
                    <span key={module} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
                      {module}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel icon={<BadgeCheck className="h-5 w-5" />} title={intel.offerStack.mainCta}>
                <p className="text-sm font-medium text-ink-900">{intel.offerStack.corePromise}</p>
                <p className="mt-2 text-sm text-slate-700">{intel.offerStack.riskReversal}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {intel.offerStack.proofAssets.map((asset) => (
                    <li key={asset}>{asset}</li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel icon={<Route className="h-5 w-5" />} title="Upsell ladder">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {intel.upsellLadder.map((step) => (
                  <div key={`${step.stage}-${step.title}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{step.stage.replace(/_/g, " ")}</div>
                    <h3 className="mt-2 text-sm font-semibold text-ink-900">{step.title}</h3>
                    <p className="mt-2 text-sm text-slate-700">{step.copy}</p>
                    <div className="mt-3 text-sm font-semibold text-ink-900">{step.displayPrice}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel icon={<ImageIcon className="h-5 w-5" />} title="Creative assets">
              <div className="grid gap-3 md:grid-cols-3">
                {intel.creativeAssets.map((asset) => (
                  <div key={asset.slotId} className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-ink-900">{asset.channel}</div>
                    <p className="mt-2 text-sm text-slate-700">{asset.description}</p>
                    <div className="mt-3 text-xs text-slate-500">
                      {asset.count} assets - {asset.status} - {asset.license}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel icon={<BadgeCheck className="h-5 w-5" />} title="Crosswalk evidence">
              <div className="grid gap-3 md:grid-cols-2">
                {evidence.map((item) => (
                  <div key={item.area} className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-ink-900">{item.area}</div>
                    <p className="mt-2 text-sm text-slate-700">{item.proof}</p>
                    <div className="mt-3 text-xs text-slate-500">{item.source}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No generation yet.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-ink-900">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
