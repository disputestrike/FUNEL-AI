import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  DollarSign,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Ticket,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { requireAdminSession } from "@/lib/session";
import {
  getDashboardStats,
  listDashboardAlerts,
} from "@/lib/fixtures";
import { SearchBar } from "@/components/SearchBar";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";

const SOURCE_ICON = {
  sentry: AlertTriangle,
  webhook: Webhook,
  ad: AlertOctagon,
  revtry: AlertOctagon,
  billing: CreditCard,
} as const;

const SEVERITY_CLASS = {
  info: "border-slate-200 bg-slate-50",
  warning: "border-warning-200 bg-warning-50/50",
  critical: "border-error-300 bg-error-50",
} as const;

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function DashboardPage() {
  const session = await requireAdminSession();
  const [stats, alerts] = await Promise.all([
    getDashboardStats(),
    listDashboardAlerts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${session.display_name ?? session.email.split("@")[0]}`}
        description="Operational dashboard. Use the search bar to jump to a customer, payment, or funnel. Use quick actions sparingly — every action is logged."
      />

      <div className="flex items-center gap-3">
        <SearchBar />
        <Link
          href="/runbooks/incident-response"
          className="rounded border border-error-300 bg-error-50 px-3 py-1.5 text-body-sm text-error-700 hover:bg-error-100"
        >
          Incident response
        </Link>
      </div>

      {/* Stats */}
      <section>
        <h2 className="mb-2 text-h6 text-slate-700">Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Signups" value={stats.signups_today} icon={<Users className="h-3.5 w-3.5 text-slate-400" />} />
          <StatCard label="Churned" value={stats.churned_today} tone={stats.churned_today > 5 ? "warning" : "neutral"} />
          <StatCard label="Failed payments" value={stats.failed_payments_today} tone={stats.failed_payments_today > 10 ? "warning" : "neutral"} icon={<CreditCard className="h-3.5 w-3.5 text-slate-400" />} />
          <StatCard label="Suspended" value={stats.suspended_total} tone="error" icon={<PauseCircle className="h-3.5 w-3.5 text-slate-400" />} />
          <StatCard label="Escalated tickets" value={stats.escalated_tickets_open} icon={<Ticket className="h-3.5 w-3.5 text-slate-400" />} />
          <StatCard label="MRR" value={dollars(stats.mrr_cents)} icon={<DollarSign className="h-3.5 w-3.5 text-slate-400" />} />
          <StatCard label="Funnels 24h" value={stats.funnels_generated_24h} icon={<Zap className="h-3.5 w-3.5 text-slate-400" />} />
        </div>
      </section>

      {/* Recent alerts */}
      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-h6 text-slate-700">Recent alerts</h2>
          <Link
            href="/sentry"
            className="flex items-center gap-1 text-caption text-slate-500 hover:text-slate-900"
          >
            All errors <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="space-y-2">
          {alerts.map((a) => {
            const Icon = SOURCE_ICON[a.source];
            return (
              <li
                key={a.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${SEVERITY_CLASS[a.severity]}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-slate-700" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{a.title}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-caption font-mono text-slate-600">
                        {a.source}
                      </span>
                      <span
                        className={
                          a.severity === "critical"
                            ? "rounded bg-error-600 px-1.5 py-0.5 text-caption text-white"
                            : a.severity === "warning"
                              ? "rounded bg-warning-500 px-1.5 py-0.5 text-caption text-slate-900"
                              : "rounded bg-slate-200 px-1.5 py-0.5 text-caption text-slate-700"
                        }
                      >
                        {a.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-body-sm text-slate-700">{a.detail}</div>
                    <div className="mt-1 text-caption text-slate-500">
                      {a.count_24h} in 24h · first seen {new Date(a.first_seen_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {a.ack_url ? (
                  <Link
                    href={a.ack_url}
                    className="self-center rounded border border-slate-300 bg-white px-2 py-1 text-caption hover:bg-slate-50"
                  >
                    Investigate
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-h6 text-slate-700">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link
            href="/customers"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <DollarSign className="h-4 w-4 text-error-600" />
              Refund tool
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
          <Link
            href="/customers"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <PauseCircle className="h-4 w-4 text-error-600" />
              Suspend account
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
          <Link
            href="/customers"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <RotateCcw className="h-4 w-4 text-error-600" />
              Restore funnel
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
          <Link
            href="/queues"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <RefreshCw className="h-4 w-4 text-error-600" />
              Retry failed jobs
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
          <Link
            href="/customers"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <Plus className="h-4 w-4 text-error-600" />
              Apply credit
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
          <Link
            href="/incidents"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-error-300 hover:bg-error-50/40"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium">
              <AlertOctagon className="h-4 w-4 text-error-600" />
              Open incident
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-error-600" />
          </Link>
        </div>
      </section>
    </div>
  );
}
