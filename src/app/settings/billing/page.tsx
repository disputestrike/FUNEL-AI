import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, ExternalLink } from "lucide-react";
import { withWorkspace, getDashboardSession } from "@/lib/data";

/**
 * Billing — plan, usage vs limits, upgrade CTA, PayPal management link.
 *
 * Upgrade flow: `/pricing` lets the user pick a tier, which posts to
 * `/api/billing/checkout` to create a PayPal Subscription. The PayPal
 * webhook at `/api/webhooks/paypal` keeps the local `Subscription`
 * row in sync.
 */
export const metadata = { title: "Billing | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Free forever until your first $1,000 of revenue.",
  starter: "$49/mo — for one operator, one funnel.",
  growth: "$199/mo — five funnels, RevTry voice qualification, ad orchestration.",
  scale: "$399/mo — scale across geos and ad surfaces.",
  agency: "$499/mo — unlimited funnels, sub-workspaces, white-label.",
  enterprise: "Custom — SSO, data residency, dedicated success engineer.",
};

interface PlanLimits {
  funnels: number | "∞";
  leads: number | "∞";
  revtryMinutes: number | "∞";
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { funnels: 1, leads: 100, revtryMinutes: 30 },
  starter: { funnels: 3, leads: 1000, revtryMinutes: 120 },
  growth: { funnels: 10, leads: 10_000, revtryMinutes: 600 },
  scale: { funnels: 25, leads: 50_000, revtryMinutes: 2400 },
  agency: { funnels: "∞", leads: "∞", revtryMinutes: "∞" },
};

const DEFAULT_LIMITS: PlanLimits = PLAN_LIMITS.free!;

export default async function BillingSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/billing");

  const { subscription, monthStats } = await withWorkspace(async (tx) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [sub, funnels, leads, revtry] = await Promise.all([
      tx.subscription.findFirst({
        where: { status: { in: ["active", "trialing", "past_due", "paused"] } },
        orderBy: { createdAt: "desc" },
      }),
      tx.funnel.count({ where: { deletedAt: null } }),
      tx.lead.count({ where: { createdAt: { gte: monthStart } } }),
      tx.revTryCall
        .aggregate({
          where: { startedAt: { gte: monthStart } },
          _sum: { durationSec: true },
        })
        .catch(() => ({ _sum: { durationSec: 0 } })),
    ]);

    const revtrySeconds =
      (revtry as { _sum?: { durationSec?: number | null } })._sum
        ?.durationSec ?? 0;

    return {
      subscription: sub,
      monthStats: {
        funnels,
        leads,
        revtryMinutes: Math.round(revtrySeconds / 60),
      },
    };
  });

  const plan = session.plan;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const limits: PlanLimits = PLAN_LIMITS[plan] ?? DEFAULT_LIMITS;
  const paypalManageUrl =
    process.env.NEXT_PUBLIC_PAYPAL_MANAGE_URL ??
    "https://www.paypal.com/myaccount/autopay/";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-h4 font-semibold text-slate-900">Plan</h2>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-h3 font-display font-semibold text-slate-900">
              {planLabel}
            </div>
            <p className="mt-1 text-body-sm text-slate-500">
              {PLAN_DESCRIPTIONS[plan] ?? "Custom plan."}
            </p>
            {subscription && (
              <p className="mt-2 text-caption text-slate-500">
                Status: <span className="font-medium">{subscription.status}</span>
                {subscription.currentPeriodEnd && (
                  <>
                    {" · Renews "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/pricing"
              className="rounded-md bg-signal-600 px-4 py-2 text-center text-body-sm font-semibold text-white hover:bg-signal-700"
            >
              {plan === "free" ? "Upgrade" : "Change plan"}
            </Link>
            {subscription && (
              <Link
                href={paypalManageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-4 py-2 text-body-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Manage in PayPal <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-h4 font-semibold text-slate-900">Usage this month</h2>
        <p className="mt-1 text-body-sm text-slate-500">
          Resets on the 1st. Hard cap on Free plans; soft alerts on paid.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <UsageMeter
            label="Funnels"
            used={monthStats.funnels}
            limit={limits.funnels}
          />
          <UsageMeter
            label="Leads"
            used={monthStats.leads}
            limit={limits.leads}
          />
          <UsageMeter
            label="RevTry minutes"
            used={monthStats.revtryMinutes}
            limit={limits.revtryMinutes}
          />
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 size-5 text-slate-400" />
          <div className="grow">
            <h2 className="text-h4 font-semibold text-slate-900">Payment</h2>
            <p className="mt-1 text-body-sm text-slate-500">
              GoFunnelAI bills through PayPal Subscriptions. Update your
              funding source or cancel from the PayPal portal — changes flow
              back here automatically via webhook.
            </p>
          </div>
          <Link
            href={paypalManageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-4 py-2 text-body-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open PayPal <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | "∞";
}) {
  const pct =
    limit === "∞" || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <dt className="text-body-sm font-medium text-slate-700">{label}</dt>
        <dd className="text-body-sm text-slate-500">
          {used} / {limit}
        </dd>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${pct > 85 ? "bg-warning-500" : "bg-signal-500"}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
