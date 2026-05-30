import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  KeyRound,
  RadioTower,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

import {
  buildEnterpriseReadinessSnapshot,
  type AdminRole,
  type EnterpriseReadinessArea,
  type ReadinessState,
} from "@/lib/enterprise";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enterprise Readiness | Admin",
};

const ROLE_LABELS: Record<AdminRole, string> = {
  read_only: "Read only",
  support: "Support",
  billing_admin: "Billing",
  engineering: "Engineering",
  super_admin: "Super admin",
};

const AREA_ICONS = {
  enterprise_identity: ShieldCheck,
  signalwire_automation: RadioTower,
  observability_dashboard: Activity,
  admin_operations: TicketCheck,
} as const;

export default function EnterpriseReadinessPage() {
  const snapshot = buildEnterpriseReadinessSnapshot();

  return (
    <main id="main" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal-700">Admin operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Enterprise readiness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Local readiness snapshot for identity, SignalWire automation, observability data, and staff operations.
            </p>
          </div>
          <a
            href="/api/enterprise/readiness"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Activity className="h-4 w-4" />
            JSON snapshot
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Overall score" value={`${snapshot.overall.score}%`} state={snapshot.overall.state} />
          <Metric label="Ready areas" value={`${snapshot.overall.readyAreas}/${snapshot.overall.totalAreas}`} />
          <Metric label="Blockers" value={String(snapshot.overall.blockerCount)} state={snapshot.overall.blockerCount === 0 ? "ready" : "needs_configuration"} />
          <Metric label="Snapshot" value={snapshot.asOf} />
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-4">
          {snapshot.areas.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeader
              icon={<Activity className="h-5 w-5" />}
              title="Observability Dashboard Data"
              subtitle={`${snapshot.observability.dataSource}; refresh ${snapshot.observability.refreshCadence}.`}
            />
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Objective</th>
                    <th className="px-4 py-3">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshot.observability.metrics.map((metric) => (
                    <tr key={metric.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">{metric.label}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {metric.value}
                        {metric.unit === "percent" ? "%" : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{metric.objective}</td>
                      <td className="px-4 py-3 text-slate-700">{metric.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeader
              icon={<KeyRound className="h-5 w-5" />}
              title="Credential Checks"
              subtitle="Presence only; secret values are never exposed."
            />
            <div className="space-y-3">
              {snapshot.areas.flatMap((area) =>
                area.credentialChecks.map((check) => (
                  <div key={`${area.id}-${check.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{check.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{check.purpose}</p>
                      </div>
                      <StatusPill state={check.present ? "ready" : check.required ? "blocked" : "needs_configuration"} />
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      {check.mode === "all" ? "Requires all" : "Requires one"}: {check.keys.join(", ")}
                    </p>
                  </div>
                )),
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader
            icon={<TicketCheck className="h-5 w-5" />}
            title="Admin Capability Matrix"
            subtitle="Role-scoped operations with audit event contracts and ticket requirements."
          />
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="min-w-56 px-4 py-3">Capability</th>
                  {snapshot.adminOperations.roles.map((role) => (
                    <th key={role} className="px-4 py-3">{ROLE_LABELS[role]}</th>
                  ))}
                  <th className="px-4 py-3">Ticket</th>
                  <th className="min-w-56 px-4 py-3">Audit event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.adminOperations.capabilities.map((capability) => (
                  <tr key={capability.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{capability.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{capability.notes}</div>
                    </td>
                    {snapshot.adminOperations.roles.map((role) => (
                      <td key={role} className="px-4 py-3 text-center">
                        {capability.allowedRoles.includes(role) ? (
                          <BadgeCheck className="mx-auto h-4 w-4 text-emerald-600" aria-label="Allowed" />
                        ) : (
                          <span className="text-slate-300" aria-label="Not allowed">-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-slate-700">{capability.requiresTicket ? "Required" : "No"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{capability.auditEvent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function AreaCard({ area }: { area: EnterpriseReadinessArea }) {
  const Icon = AREA_ICONS[area.id];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Item {area.sourceItem}</p>
            <h2 className="text-base font-semibold text-slate-950">{area.title}</h2>
          </div>
        </div>
        <StatusPill state={area.state} />
      </div>
      <p className="mt-4 text-sm text-slate-600">{area.summary}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</span>
        <span className="text-lg font-semibold tabular-nums text-slate-950">{area.score}%</span>
      </div>
      <div className="mt-4 space-y-2">
        {area.blockers.length > 0 ? (
          area.blockers.slice(0, 3).map((blocker) => (
            <div key={blocker} className="flex gap-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{blocker}</span>
            </div>
          ))
        ) : (
          <div className="flex gap-2 text-xs text-emerald-700">
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>All required checks are ready.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value, state = "ready" }: { label: string; value: string; state?: ReadinessState }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <StatusPill state={state} />
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 text-signal-700">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: ReadinessState }) {
  const label = state.replace("_", " ");
  const className =
    state === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state === "blocked"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold capitalize ${className}`}>
      {label}
    </span>
  );
}
