import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Database,
  FlaskConical,
  GitBranch,
  Paintbrush,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

import {
  DEFAULT_ENTERPRISE_ONBOARDING,
  PRODUCT_READINESS_AREAS,
  buildEnterpriseReadinessReport,
  campaignStageSummaries,
  type ProductReadinessStatus,
} from '@/lib/product-readiness';

export const metadata = {
  title: 'Campaign Automation | gofunnelai.com',
};

const STATUS_STYLES: Record<ProductReadinessStatus, string> = {
  ready: 'border-success-200 bg-success-50 text-success-700',
  needs_input: 'border-warning-200 bg-warning-50 text-warning-700',
  blocked: 'border-error-200 bg-error-50 text-error-700',
};

const AREA_ICONS = [Sparkles, Paintbrush, Database, Route, FlaskConical, BadgeCheck];

export default function CampaignAutomationPage() {
  const report = buildEnterpriseReadinessReport(DEFAULT_ENTERPRISE_ONBOARDING);
  const stages = campaignStageSummaries();

  return (
    <main id="main" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-signal-600">Campaign automation</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Product-completeness registry
            </h1>
            <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
              The local readiness layer for AI orchestration prompts and evals, design quality,
              asset storage, CRM handoff, testing depth, and launch completeness.
            </p>
          </div>
          <Link
            href="/onboarding/enterprise"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            Enterprise intake <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric
            label="Default score"
            value={`${report.overallScore}`}
            icon={<BadgeCheck className="size-5" />}
          />
          <Metric
            label="Readiness areas"
            value={`${PRODUCT_READINESS_AREAS.length}`}
            icon={<Blocks className="size-5" />}
          />
          <Metric
            label="Automation stages"
            value={`${stages.length}`}
            icon={<Workflow className="size-5" />}
          />
          <Metric
            label="Prompt evals"
            value={`${PRODUCT_READINESS_AREAS.reduce((sum, area) => sum + area.registry.length, 0)}`}
            icon={<GitBranch className="size-5" />}
          />
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-slate-950">
            <Workflow className="size-5" />
            <h2 className="text-xl font-semibold">Automation stages</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {stages.map((stage) => (
              <article
                key={stage.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase text-slate-500">{stage.owner}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">{stage.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{stage.trigger}</p>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-sm font-medium text-slate-950">{stage.deterministicOutput}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stage.gates.map((gate) => (
                      <Pill key={gate}>{gate}</Pill>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-slate-950">
            <ShieldCheck className="size-5" />
            <h2 className="text-xl font-semibold">Readiness lanes</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {PRODUCT_READINESS_AREAS.map((area, index) => {
              const Icon = AREA_ICONS[index] ?? Sparkles;
              const result = report.areas.find((item) => item.areaId === area.id);
              const status = result?.status ?? 'needs_input';
              const score = result?.score ?? 0;

              return (
                <article
                  key={area.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-aqua-50 text-aqua-700">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Area {area.ordinal}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{area.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{area.summary}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
                    >
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-signal-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
                    {area.registry.map((item) => (
                      <div key={item.id} className="rounded-md bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-2 text-xs text-slate-600">{item.evaluation}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <PlanPanel
            title="Asset generation and storage"
            icon={<Database className="size-5" />}
            items={report.assetStoragePlan}
          />
          <PlanPanel
            title="CRM readiness"
            icon={<Route className="size-5" />}
            items={report.crmPlan}
          />
          <PlanPanel
            title="Testing depth"
            icon={<FlaskConical className="size-5" />}
            items={report.testingPlan}
          />
          <PlanPanel
            title="Product completeness"
            icon={<BadgeCheck className="size-5" />}
            items={report.completenessPlan}
          />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <span className="text-xs font-semibold uppercase">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function PlanPanel({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-950">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <ul className="mt-4 space-y-3 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="border-l-2 border-signal-200 pl-3">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}
