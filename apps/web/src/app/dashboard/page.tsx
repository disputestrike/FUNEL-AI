import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, FileText, Route } from "lucide-react";
import { buildOfferIntelligence } from "@funnel/orchestrator/offer-intelligence";

export const metadata = {
  title: "Dashboard | gofunnelai.com",
};

export default function DashboardPage() {
  const solar = buildOfferIntelligence({
    industry: "Solar",
    target_customer: "Homeowners with high electric bills",
    offer: "Give a savings plan first, then book qualified consultations",
    geography: "US",
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink-900">Funnel command center</h1>
          </div>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Generate
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Metric label="Quality floor" value={String(solar.estimatedQualityScore)} />
          <Metric label="Lead magnet" value={solar.leadMagnet.title} />
          <Metric label="Upsells" value={String(solar.upsellLadder.length)} />
          <Metric label="Assets" value={String(solar.creativeAssets.length)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Panel icon={<FileText className="h-5 w-5" />} title="Free value">
            <p className="text-sm text-slate-700">{solar.leadMagnet.promise}</p>
          </Panel>
          <Panel icon={<Route className="h-5 w-5" />} title="Ladder">
            <ul className="space-y-2 text-sm text-slate-700">
              {solar.upsellLadder.map((step) => (
                <li key={step.title}>{step.title}</li>
              ))}
            </ul>
          </Panel>
          <Panel icon={<BadgeCheck className="h-5 w-5" />} title="Evidence">
            <ul className="space-y-2 text-sm text-slate-700">
              {solar.evidence.slice(0, 5).map((item) => (
                <li key={item.area}>{item.area}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-ink-900">{value}</div>
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
