/**
 * POST /api/crm/[contactId]/dial — manually re-trigger RevTry on a contact.
 *
 * Calls into `@funnel/revtry`'s `queueOutboundDial`. In dev / when SignalWire
 * isn't configured, the demo simulator runs instead and the dashboard sees
 * the same status transitions.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

const DialRequest = z.object({
  reason: z.enum(["manual", "retry", "callback_requested"]).default("manual"),
});

interface RevTryModule {
  queueOutboundDial(args: {
    workspace_id: string;
    lead_id: string;
    funnel_id: string;
    phone_e164: string;
    deadline_at: string;
  }): Promise<{ call_id: string; demo: boolean }>;
  isDemoMode(): boolean;
}

export async function POST(
  req: Request,
  ctx: { params: { contactId: string } },
): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const parsed = DialRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dial request" }, { status: 400 });
  }

  let mod: RevTryModule | null = null;
  try {
    // Use a string variable so TypeScript doesn't try to resolve the bare
    // specifier — the web app doesn't declare @funnel/revtry as a dep, but
    // the node runtime can resolve it from the workspace at run time.
    const modulePath = "@funnel/revtry";
    mod = (await import(/* @vite-ignore */ modulePath)) as unknown as RevTryModule;
  } catch (err) {
    return NextResponse.json(
      { error: "revtry_unavailable", detail: String(err) },
      { status: 503 },
    );
  }

  try {
    const deadline = new Date(Date.now() + 60_000).toISOString();
    // The manual-dial path doesn't know the workspace_id / phone yet —
    // production resolves them from the contact row. For the demo we pass
    // placeholders so the simulator can run.
    const result = await mod.queueOutboundDial({
      workspace_id: "ws_demo",
      lead_id: ctx.params.contactId,
      funnel_id: "fnl_demo",
      phone_e164: "+15555550100",
      deadline_at: deadline,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: "dial_failed", detail: String(err) },
      { status: 500 },
    );
  }
}
