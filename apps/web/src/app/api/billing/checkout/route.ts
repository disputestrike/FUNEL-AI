/**
 * POST /api/billing/checkout — start a PayPal Subscription flow.
 *
 * Reads the requested plan from the form body, asks PayPal to create a
 * Subscription against a pre-provisioned PayPal Plan ID (one per tier,
 * configured in env), and redirects the caller to the approval URL.
 *
 * The actual state mutation (`workspaces.plan` / `subscriptions.status`)
 * happens later when PayPal POSTs the activation webhook to
 * `/api/webhooks/paypal`. This route only kicks off the approval flow.
 */
import { NextResponse } from "next/server";
import { createSubscription } from "@funnel/billing/paypal";
import { getCurrentSession } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_ENV: Record<string, string | undefined> = {
  starter: process.env.PAYPAL_PLAN_STARTER,
  growth: process.env.PAYPAL_PLAN_GROWTH,
  agency: process.env.PAYPAL_PLAN_AGENCY,
};

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.workspaces[0]?.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const plan = String(form.get("plan") ?? "").toLowerCase();
  const paypalPlanId = PLAN_ENV[plan];
  if (!paypalPlanId) {
    return NextResponse.json({ error: "unknown_plan" }, { status: 400 });
  }

  const returnUrl = new URL("/settings/billing?paypal=success", req.url).toString();
  const cancelUrl = new URL("/pricing?paypal=cancelled", req.url).toString();

  const sub = await createSubscription({
    plan_id: paypalPlanId,
    custom_id: session.workspace.id,
    subscriber: {
      email_address: session.user.email,
      name: session.user.name
        ? {
            given_name: session.user.name.split(" ")[0] ?? "",
            surname: session.user.name.split(" ").slice(1).join(" ") || "—",
          }
        : undefined,
    },
    application_context: {
      brand_name: "GoFunnelAI",
      user_action: "SUBSCRIBE_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  } as never);

  const approve = sub.links?.find((l) => l.rel === "approve")?.href;
  if (!approve) {
    return NextResponse.json(
      { error: "no_approval_url", paypal_id: sub.id },
      { status: 502 },
    );
  }
  return NextResponse.redirect(approve, { status: 303 });
}
