import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Megaphone,
  PhoneCall,
  Sparkles,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { withWorkspaceContext } from "@funnel/db";
import { Header } from "@/components/site/Header";
import { getDashboardSession } from "@/lib/data";

export const metadata = {
  title: "Dashboard | GoFunnelAI",
};

export const dynamic = "force-dynamic";

const REVTRY_FREE_MINUTES = 30;
const FREE_MONTHLY_LEAD_CAP = 100;

interface WorkspaceMetrics {
  funnelsCount: number;
  liveFunnelsCount: number;
  leadsThisMonth: number;
  revtryMinutesUsed: number;
  adSpendCents: number;
  successPath: SuccessPath;
  recent: Array<{
    id: string;
    label: string;
    description: string;
    at: Date;
    icon: "lead" | "funnel" | "call" | "campaign" | "system";
  }>;
}

interface SuccessPath {
  funnelBuilt: boolean;
  trafficOn: boolean;
  firstLead: boolean;
  firstCall: boolean;
  firstBooking: boolean;
}

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/dashboard");

  const metrics = await loadMetrics(session.workspaceId);
  const onboarded = metrics.successPath.funnelBuilt;

  return (
    <>
      <Header />
      <main id="main" className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-signal-600">
                {session.workspaceName}
              </p>
              <h1 className="mt-2 text-h2 font-display font-semibold text-slate-900">
                Welcome back, {session.firstName}.
              </h1>
              <p className="mt-1 text-body-sm text-slate-500">
                Plan: <span className="font-medium text-slate-700">{session.plan}</span>
                {" · "}
                Role: <span className="font-medium text-slate-700">{session.role}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/generate"
                className="inline-flex items-center gap-2 rounded-md bg-signal-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-signal-700"
              >
                <Sparkles className="h-4 w-4" />
                Generate funnel
              </Link>
              <Link
                href="/funnels"
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-body-sm font-semibold text-slate-700 hover:bg-white"
              >
                All funnels <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {!onboarded ? (
            <EmptyState />
          ) : (
            <>
              <section
                aria-label="KPIs"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <Metric
                  label="Funnels"
                  value={metrics.funnelsCount.toString()}
                  hint={`${metrics.liveFunnelsCount} live`}
                  icon={<Target className="h-5 w-5" />}
                />
                <Metric
                  label="Leads this month"
                  value={metrics.leadsThisMonth.toString()}
                  hint={
                    session.plan === "free"
                      ? `${FREE_MONTHLY_LEAD_CAP - metrics.leadsThisMonth} of ${FREE_MONTHLY_LEAD_CAP} remaining on Free`
                      : "Unlimited on this plan"
                  }
                  icon={<Users className="h-5 w-5" />}
                />
                <Metric
                  label="RevTry minutes"
                  value={metrics.revtryMinutesUsed.toString()}
                  hint={
                    session.plan === "free"
                      ? `${Math.max(0, REVTRY_FREE_MINUTES - metrics.revtryMinutesUsed)} of ${REVTRY_FREE_MINUTES} left on Free`
                      : "Metered"
                  }
                  icon={<PhoneCall className="h-5 w-5" />}
                />
                <Metric
                  label="Ad spend (MTD)"
                  value={`$${(metrics.adSpendCents / 100).toFixed(2)}`}
                  hint="Across all live campaigns"
                  icon={<Wallet className="h-5 w-5" />}
                />
              </section>

              <section
                aria-label="Success Path"
                className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h4 font-semibold text-slate-900">
                      Your Success Path
                    </h2>
                    <p className="mt-1 text-body-sm text-slate-500">
                      The five steps every workspace clears before the engine pays
                      for itself.
                    </p>
                  </div>
                  <SuccessPathProgress value={successScore(metrics.successPath)} />
                </div>
                <ol className="mt-5 grid gap-3 sm:grid-cols-5">
                  <Step done={metrics.successPath.funnelBuilt} label="Funnel built" hint="Generate from a sentence" />
                  <Step done={metrics.successPath.trafficOn} label="Traffic on" hint="First ad / share live" />
                  <Step done={metrics.successPath.firstLead} label="First lead" hint="Form submission captured" />
                  <Step done={metrics.successPath.firstCall} label="First RevTry call" hint="AI qualified the lead" />
                  <Step done={metrics.successPath.firstBooking} label="First booking" hint="Calendar slot held" />
                </ol>
              </section>

              <section
                aria-label="Recent activity"
                className="mt-6 grid gap-4 lg:grid-cols-3"
              >
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-h4 font-semibold text-slate-900">
                      Recent activity
                    </h2>
                    <Link
                      href="/crm"
                      className="text-body-sm font-medium text-signal-600 hover:underline"
                    >
                      View CRM
                    </Link>
                  </div>
                  {metrics.recent.length === 0 ? (
                    <p className="text-body-sm text-slate-500">
                      Quiet day. Generate a funnel or turn an ad on to start a feed.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {metrics.recent.map((evt) => (
                        <li key={evt.id} className="flex items-start gap-3">
                          <ActivityIcon kind={evt.icon} />
                          <div>
                            <div className="text-body-sm font-medium text-slate-900">
                              {evt.label}
                            </div>
                            <div className="text-caption text-slate-500">
                              {evt.description} · {timeAgo(evt.at)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-h4 font-semibold text-slate-900">
                    Next best action
                  </h2>
                  <p className="mt-2 text-body-sm text-slate-500">
                    {nextBestAction(metrics.successPath)}
                  </p>
                  <Link
                    href={nextBestActionHref(metrics.successPath)}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-body-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Take action <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

// --------------------------------------------------------------------------
// Data loading
// --------------------------------------------------------------------------

async function loadMetrics(workspaceId: string): Promise<WorkspaceMetrics> {
  return withWorkspaceContext(workspaceId, async (tx) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [
      funnelsCount,
      liveFunnelsCount,
      leadsThisMonth,
      revtryAgg,
      adSpendAgg,
      firstFunnel,
      firstLiveFunnel,
      firstLead,
      firstCall,
      firstBooking,
      recentLeads,
      recentCalls,
      recentBookings,
    ] = await Promise.all([
      tx.funnel.count({ where: { deletedAt: null } }),
      tx.funnel.count({ where: { status: "live", deletedAt: null } }),
      tx.lead.count({ where: { createdAt: { gte: monthStart } } }),
      tx.revTryCall.aggregate({
        where: { startedAt: { gte: monthStart } },
        _sum: { durationSec: true },
      }).catch(() => ({ _sum: { durationSec: 0 } })),
      tx.adCampaign.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { spendToDateMicros: true },
      }).catch(() => ({ _sum: { spendToDateMicros: BigInt(0) } })),
      tx.funnel.findFirst({ where: { deletedAt: null } }),
      tx.funnel.findFirst({ where: { status: "live", deletedAt: null } }),
      tx.lead.findFirst(),
      tx.revTryCall.findFirst(),
      tx.booking.findFirst(),
      tx.lead.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
      tx.revTryCall.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
      tx.booking.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
    ]);

    const revtrySeconds =
      (revtryAgg as { _sum?: { durationSec?: number | null } })?._sum
        ?.durationSec ?? 0;
    const adSpendMicros =
      (adSpendAgg as { _sum?: { spendToDateMicros?: bigint | null } })?._sum
        ?.spendToDateMicros ?? BigInt(0);
    // micros (1/1,000,000 of a unit) → cents
    const adSpendCents = Number(adSpendMicros / BigInt(10_000));

    const recent: WorkspaceMetrics["recent"] = [
      ...recentLeads.map((l) => ({
        id: l.id,
        label: "New lead captured",
        description: `${l.captureSource} · ${l.scoreBand ?? "unscored"}`,
        at: l.createdAt,
        icon: "lead" as const,
      })),
      ...recentCalls.map((c) => ({
        id: c.id,
        label: `RevTry call · ${c.outcome ?? "completed"}`,
        description: `${Math.round((c.durationSec ?? 0) / 60)} min`,
        at: c.startedAt,
        icon: "call" as const,
      })),
      ...recentBookings.map((b) => ({
        id: b.id,
        label: "Booking confirmed",
        description: b.scheduledFor
          ? new Date(b.scheduledFor).toLocaleString()
          : "Slot held",
        at: b.createdAt,
        icon: "campaign" as const,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);

    return {
      funnelsCount,
      liveFunnelsCount,
      leadsThisMonth,
      revtryMinutesUsed: Math.round(revtrySeconds / 60),
      adSpendCents,
      successPath: {
        funnelBuilt: !!firstFunnel,
        trafficOn: !!firstLiveFunnel,
        firstLead: !!firstLead,
        firstCall: !!firstCall,
        firstBooking: !!firstBooking,
      },
      recent,
    };
  });
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-signal-100 text-signal-600">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-h3 font-display font-semibold text-slate-900">
        Type your business. Get a customer.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-body text-slate-500">
        One sentence is all it takes. GoFunnelAI will build the landing page,
        write the ads, qualify the leads, and book the calls.
      </p>
      <Link
        href="/generate"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-signal-600 px-5 py-2.5 text-body-sm font-semibold text-white hover:bg-signal-700"
      >
        Create your first funnel <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="mt-2 text-h3 font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-caption text-slate-500">{hint}</div>}
    </div>
  );
}

function Step({
  done,
  label,
  hint,
}: {
  done: boolean;
  label: string;
  hint: string;
}) {
  return (
    <li
      className={`rounded-lg border p-3 ${
        done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-slate-900">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-slate-300" />
        )}
        <span className="text-body-sm font-medium">{label}</span>
      </div>
      <div className="mt-1 pl-7 text-caption text-slate-500">{hint}</div>
    </li>
  );
}

function SuccessPathProgress({ value }: { value: number }) {
  return (
    <div className="text-right">
      <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">
        Activation
      </div>
      <div className="text-h3 font-semibold text-slate-900">{value} / 5</div>
    </div>
  );
}

function successScore(p: SuccessPath): number {
  return [p.funnelBuilt, p.trafficOn, p.firstLead, p.firstCall, p.firstBooking].filter(
    Boolean,
  ).length;
}

function nextBestAction(p: SuccessPath): string {
  if (!p.funnelBuilt) return "Generate your first funnel in 60 seconds.";
  if (!p.trafficOn)
    return "Turn on traffic — share your funnel, launch an ad, or import a list.";
  if (!p.firstLead) return "Drive a click to verify capture is wired correctly.";
  if (!p.firstCall) return "Enable RevTry to qualify leads by voice.";
  if (!p.firstBooking) return "Connect your calendar so leads can self-book.";
  return "All five activated. Look at conversion to scale ad spend.";
}

function nextBestActionHref(p: SuccessPath): string {
  if (!p.funnelBuilt) return "/generate";
  if (!p.trafficOn) return "/funnels";
  if (!p.firstLead) return "/funnels";
  if (!p.firstCall) return "/settings/api-keys";
  if (!p.firstBooking) return "/settings/profile";
  return "/campaigns";
}

function ActivityIcon({ kind }: { kind: WorkspaceMetrics["recent"][number]["icon"] }) {
  const className = "h-5 w-5";
  switch (kind) {
    case "lead":
      return <Users className={`${className} text-signal-500`} />;
    case "call":
      return <PhoneCall className={`${className} text-emerald-500`} />;
    case "funnel":
      return <Target className={`${className} text-fuchsia-500`} />;
    case "campaign":
      return <Megaphone className={`${className} text-amber-500`} />;
    default:
      return <Zap className={`${className} text-slate-400`} />;
  }
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
