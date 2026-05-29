import { getEnterpriseReadiness } from "@/lib/platform/enterprise-readiness";

export const metadata = {
  title: "Enterprise Readiness | GoFunnelAI",
};

export default function EnterpriseReadinessPage() {
  const report = getEnterpriseReadiness();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-signal-700">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Enterprise readiness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              This page tracks the sixteen Fortune-grade surfaces: what is implemented,
              what is connected by credentials, and what still needs hardening before
              production traffic.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Ready" value={report.readyCount} tone="emerald" />
            <Metric label="Partial" value={report.partialCount} tone="amber" />
            <Metric label="Blocked" value={report.blockedCount} tone="red" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {report.capabilities.map((capability) => (
            <article key={capability.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{capability.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{capability.productionMeaning}</p>
                </div>
                <span className={statusClass(capability.status)}>
                  {capability.status}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">Implemented</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {capability.implementedSurface.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {capability.requiredEnv.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase text-slate-500">Required env</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {capability.requiredEnv.map((key) => (
                      <code key={key} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {key}
                      </code>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
                {capability.nextHardeningStep}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-red-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "ready") return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700";
  if (status === "blocked") return "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase text-red-700";
  return "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-700";
}
