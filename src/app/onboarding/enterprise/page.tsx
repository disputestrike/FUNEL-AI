'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Database,
  FlaskConical,
  Layers3,
  ListChecks,
  Paintbrush,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DEFAULT_ENTERPRISE_ONBOARDING,
  PRODUCT_READINESS_AREAS,
  type EnterpriseChannel,
  type EnterpriseCrm,
  type EnterpriseLaunchWindow,
  type EnterpriseOnboardingInput,
  type EnterpriseReadinessReport,
  type EnterpriseTeamSize,
  type ProductReadinessStatus,
} from '@/lib/product-readiness';

const TEAM_OPTIONS: Array<{ value: EnterpriseTeamSize; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: 'small_team', label: 'Small team' },
  { value: 'growth_team', label: 'Growth team' },
  { value: 'enterprise', label: 'Enterprise' },
];

const CRM_OPTIONS: Array<{ value: EnterpriseCrm; label: string }> = [
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'pipedrive', label: 'Pipedrive' },
  { value: 'highlevel', label: 'HighLevel' },
  { value: 'custom', label: 'Custom CRM' },
  { value: 'none', label: 'No CRM' },
];

const LAUNCH_OPTIONS: Array<{ value: EnterpriseLaunchWindow; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_quarter', label: 'This quarter' },
];

const CHANNEL_OPTIONS: Array<{ value: EnterpriseChannel; label: string }> = [
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' },
  { value: 'paid_search', label: 'Paid search' },
  { value: 'paid_social', label: 'Paid social' },
  { value: 'sms', label: 'SMS' },
  { value: 'voice', label: 'Voice' },
];

const STATUS_STYLES: Record<ProductReadinessStatus, string> = {
  ready: 'border-success-200 bg-success-50 text-success-700',
  needs_input: 'border-warning-200 bg-warning-50 text-warning-700',
  blocked: 'border-error-200 bg-error-50 text-error-700',
};

const AREA_ICONS = [Sparkles, Paintbrush, Database, Route, FlaskConical, BadgeCheck];

export default function EnterpriseOnboardingPage() {
  const [form, setForm] = useState<EnterpriseOnboardingInput>({
    ...DEFAULT_ENTERPRISE_ONBOARDING,
    channels: [...DEFAULT_ENTERPRISE_ONBOARDING.channels],
  });
  const [report, setReport] = useState<EnterpriseReadinessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const priorityLabel = useMemo(() => {
    if (!report) return 'Registry loaded';
    return report.priorityLanes.length > 0
      ? report.priorityLanes.join(', ')
      : 'Ready for launch review';
  }, [report]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Readiness evaluation failed.');
      setReport(data as EnterpriseReadinessReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Readiness evaluation failed.');
    } finally {
      setLoading(false);
    }
  }

  function toggleChannel(channel: EnterpriseChannel) {
    setForm((current) => {
      const channels = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];
      return { ...current, channels: channels.length > 0 ? channels : ['web'] };
    });
  }

  return (
    <main id="main" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-signal-600">Enterprise onboarding</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Product readiness workbench
            </h1>
            <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
              A deterministic local slice for AI orchestration, design quality, asset storage, CRM
              handoff, testing depth, and product completeness.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/campaigns/automation">
              Automation registry <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={submit}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="flex size-10 items-center justify-center rounded-md bg-signal-50 text-signal-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Launch inputs</h2>
                <p className="text-sm text-slate-600">{priorityLabel}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-800">
                Company
                <input
                  value={form.companyName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, companyName: event.target.value }))
                  }
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950"
                />
              </label>

              <label className="block text-sm font-medium text-slate-800">
                Industry
                <input
                  value={form.industry}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, industry: event.target.value }))
                  }
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Team
                  <select
                    value={form.teamSize}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        teamSize: event.target.value as EnterpriseTeamSize,
                      }))
                    }
                    className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
                  >
                    {TEAM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  CRM
                  <select
                    value={form.crm}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        crm: event.target.value as EnterpriseCrm,
                      }))
                    }
                    className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
                  >
                    {CRM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Launch window
                <select
                  value={form.launchWindow}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      launchWindow: event.target.value as EnterpriseLaunchWindow,
                    }))
                  }
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
                >
                  {LAUNCH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-slate-800">Channels</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {CHANNEL_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.channels.includes(option.value)}
                        onChange={() => toggleChannel(option.value)}
                        className="size-4 rounded border-slate-300 text-signal-600"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-2">
                <Toggle
                  label="Brand assets ready"
                  checked={form.hasBrandAssets}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, hasBrandAssets: checked }))
                  }
                />
                <Toggle
                  label="Compliance review assigned"
                  checked={form.hasComplianceReview}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, hasComplianceReview: checked }))
                  }
                />
                <Toggle
                  label="Test plan exists"
                  checked={form.hasTestPlan}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, hasTestPlan: checked }))
                  }
                />
                <Toggle
                  label="Data residency needed"
                  checked={form.needsDataResidency}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, needsDataResidency: checked }))
                  }
                />
              </div>

              <Button type="submit" loading={loading} className="w-full">
                Evaluate readiness <ListChecks className="size-4" />
              </Button>
              {error ? <p className="text-sm font-medium text-error-600">{error}</p> : null}
            </div>
          </form>

          <section className="space-y-6">
            {report ? <ReportSummary report={report} /> : <RegistrySummary />}
          </section>
        </div>
      </div>
    </main>
  );
}

function ReportSummary({ report }: { report: EnterpriseReadinessReport }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Overall"
          value={`${report.overallScore}`}
          icon={<BadgeCheck className="size-5" />}
        />
        <Metric
          label="Status"
          value={statusLabel(report.status)}
          icon={<Workflow className="size-5" />}
        />
        <Metric
          label="Areas"
          value={`${report.areas.length}`}
          icon={<Blocks className="size-5" />}
        />
        <Metric
          label="Priorities"
          value={`${report.priorityLanes.length}`}
          icon={<Route className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {report.areas.map((area, index) => {
          const Icon = AREA_ICONS[index] ?? Layers3;
          return (
            <article
              key={area.areaId}
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
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{area.title}</h2>
                  </div>
                </div>
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[area.status]}`}
                >
                  {statusLabel(area.status)}
                </span>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-signal-500"
                  style={{ width: `${area.score}%` }}
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-950">{area.capability}</p>

              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                {area.evidence.map((item) => (
                  <div key={item} className="flex gap-2 text-sm text-slate-600">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">Next actions</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {area.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PlanPanel
          title="Asset storage"
          icon={<Database className="size-5" />}
          items={report.assetStoragePlan}
        />
        <PlanPanel title="CRM handoff" icon={<Route className="size-5" />} items={report.crmPlan} />
        <PlanPanel
          title="Testing depth"
          icon={<FlaskConical className="size-5" />}
          items={report.testingPlan}
        />
      </div>

      <PlanPanel
        title="Product completeness"
        icon={<BadgeCheck className="size-5" />}
        items={report.completenessPlan}
      />
    </>
  );
}

function RegistrySummary() {
  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ember-50 text-ember-700">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Readiness registry</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Six product-completeness lanes are registered locally with prompts, evals, release
              gates, and automation hooks.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PRODUCT_READINESS_AREAS.map((area, index) => {
          const Icon = AREA_ICONS[index] ?? Layers3;
          return (
            <article
              key={area.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-signal-50 text-signal-700">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Area {area.ordinal}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{area.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{area.summary}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>{area.capability}</Pill>
                <Pill>{area.registry.length} checks</Pill>
              </div>
              <p className="mt-4 border-t border-slate-200 pt-4 text-sm font-medium text-slate-700">
                {area.releaseGate}
              </p>
            </article>
          );
        })}
      </div>
    </>
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 text-sm text-slate-800">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-slate-300 text-signal-600"
      />
    </label>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function statusLabel(status: ProductReadinessStatus) {
  return status.replace(/_/g, ' ');
}
