"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Globe2,
  ImageIcon,
  Loader2,
  Route,
  Sparkles,
  Workflow,
} from "lucide-react";

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

type GenerationResponse = {
  ok: true;
  publish_url: string;
  provider_readiness: ProviderReadiness;
  next_steps: Array<{ provider: string; env: string[]; purpose: string }>;
  funnel: {
    slug: string;
    public_url: string;
    quality_score: number;
    generated_at: string;
    styleGuide: {
      name: string;
      visualMotif: string;
      button: { gradient: string };
      palette: { primary: string; secondary: string; accent: string; ink: string; muted: string };
    };
    assets: Array<{
      id: string;
      role: string;
      status: string;
      url: string;
      alt: string;
      prompt: string;
    }>;
    pages: Array<{
      id: string;
      path: string;
      title: string;
      sections: Array<{ id: string; type: string; title: string }>;
    }>;
    automation: {
      status: string;
      userWorkRequired: string;
      steps: Array<{ id: string; label: string; engine: string; state: string }>;
    };
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
const BRAND_GRADIENT = "linear-gradient(135deg,#6817d2 0%,#d91a8f 48%,#ff7a00 100%)";

export function OfferGeneratorClient() {
  const [industry, setIndustry] = useState("Solar");
  const [audience, setAudience] = useState("Homeowners with high electric bills");
  const [offer, setOffer] = useState("Give a savings plan first, then book qualified consultations");
  const [businessName, setBusinessName] = useState("GoFunnelAI Preview");
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intel = result?.funnel.offer_intelligence;
  const evidence = useMemo(() => intel?.evidence.slice(0, 8) ?? [], [intel]);
  const readiness = result?.provider_readiness;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, audience, offer, geography: "US", businessName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data as GenerationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
            {loading ? "Building live funnel..." : "Build and publish funnel"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </section>

      <section className="space-y-6">
        {result && intel ? (
          <>
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric label="Quality" value={String(result.funnel.quality_score)} />
              <Metric label="Pages" value={String(result.funnel.pages.length)} />
              <Metric label="Assets" value={String(result.funnel.assets.length)} />
              <Metric label="Manual work" value={result.funnel.automation.userWorkRequired} />
            </div>

            <Panel icon={<Globe2 className="h-5 w-5" />} title="Published funnel">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{result.funnel.public_url}</p>
                  <p className="mt-1 text-sm text-slate-600">This is a real route. Leads submitted here are saved and routed through the configured adapters.</p>
                </div>
                <a
                  href={result.publish_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black text-white"
                  style={{ background: result.funnel.styleGuide.button.gradient }}
                >
                  Open funnel
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <iframe
                title="Generated funnel preview"
                src={result.publish_url}
                className="mt-5 h-[620px] w-full rounded-lg border border-slate-200 bg-white"
              />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel icon={<FileText className="h-5 w-5" />} title={intel.leadMagnet.title}>
                <p className="text-sm text-slate-700">{intel.leadMagnet.promise}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {intel.leadMagnet.modules.map((module) => (
                    <span key={module} className="rounded-full bg-signal-50 px-3 py-1 text-xs font-medium text-signal-800">
                      {module}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel icon={<BadgeCheck className="h-5 w-5" />} title={intel.offerStack.mainCta}>
                <p className="text-sm font-medium text-slate-950">{intel.offerStack.corePromise}</p>
                <p className="mt-2 text-sm text-slate-700">{intel.offerStack.riskReversal}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {intel.offerStack.proofAssets.map((asset) => (
                    <li key={asset}>{asset}</li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel icon={<Workflow className="h-5 w-5" />} title="Automation engine">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {result.funnel.automation.steps.map((step) => (
                  <div key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase text-signal-700">{step.engine}</div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-950">{step.label}</h3>
                    <p className="mt-2 text-xs font-medium text-slate-500">{step.state.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel icon={<Route className="h-5 w-5" />} title="Upsell ladder">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {intel.upsellLadder.map((step) => (
                  <div key={`${step.stage}-${step.title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase text-signal-700">{step.stage.replace(/_/g, " ")}</div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-sm text-slate-700">{step.copy}</p>
                    <div className="mt-3 text-sm font-semibold text-slate-950">{step.displayPrice}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel icon={<ImageIcon className="h-5 w-5" />} title="Generated assets">
              <div className="grid gap-3 md:grid-cols-3">
                {result.funnel.assets.slice(0, 6).map((asset) => (
                  <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <img src={asset.url} alt={asset.alt} className="aspect-[1.2/1] w-full rounded-md object-cover" />
                    <div className="mt-3 text-sm font-semibold text-slate-950">{asset.role.replace(/_/g, " ")}</div>
                    <p className="mt-1 text-xs text-slate-500">{asset.status}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel icon={<BadgeCheck className="h-5 w-5" />} title="Provider readiness">
              <div className="grid gap-3 md:grid-cols-3">
                {readiness ? Object.entries(readiness).map(([provider, ready]) => (
                  <div key={provider} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold capitalize text-slate-950">{provider.replace(/([A-Z])/g, " $1")}</div>
                    <p className={ready ? "mt-2 text-sm font-medium text-emerald-700" : "mt-2 text-sm font-medium text-amber-700"}>
                      {ready ? "Connected" : "Credential needed"}
                    </p>
                  </div>
                )) : null}
              </div>
              {result.next_steps.length > 0 ? (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-black text-amber-950">Keys still needed</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {result.next_steps.map((step) => (
                      <div key={step.provider} className="text-sm text-amber-950">
                        <div className="font-semibold">{step.provider}</div>
                        <div className="mt-1 text-xs">{step.env.join(", ")}</div>
                        <div className="mt-1 text-xs text-amber-800">{step.purpose}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel icon={<BadgeCheck className="h-5 w-5" />} title="Crosswalk evidence">
              <div className="grid gap-3 md:grid-cols-2">
                {evidence.map((item) => (
                  <div key={item.area} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-950">{item.area}</div>
                    <p className="mt-2 text-sm text-slate-700">{item.proof}</p>
                    <div className="mt-3 text-xs text-slate-500">{item.source}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            Build a funnel to see the live page, lead form, generated assets, upsell ladder, provider readiness, and crosswalk proof.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
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
      <div className="mb-4 flex items-center gap-2 text-slate-950">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
