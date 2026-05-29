import { NextResponse } from "next/server";
import { z } from "zod";

import {
  captureGeneratedFunnelLead,
  getGeneratedFunnel,
  listGeneratedFunnelLeads,
} from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LeadRequest = z.object({
  fields: z.record(z.string().trim().max(1000)).default({}),
});

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const funnel = getGeneratedFunnel(params.slug);
  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });

  const parsed = LeadRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload" }, { status: 400 });
  }

  const missing = requiredFields(funnel).filter((field) => !parsed.data.fields[field]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 400 },
    );
  }

  const lead = captureGeneratedFunnelLead({
    slug: params.slug,
    fields: parsed.data.fields,
  });
  if (!lead) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    lead_id: lead.id,
    next_path: lead.next_path,
    routing: lead.routing,
    message: "Lead captured. Follow-up adapters will fire automatically when provider keys are connected.",
  });
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const funnel = getGeneratedFunnel(params.slug);
  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  const leads = listGeneratedFunnelLeads(params.slug);
  return NextResponse.json({
    ok: true,
    count: leads.length,
    latest: leads.at(-1) ?? null,
  });
}

function requiredFields(funnel: NonNullable<ReturnType<typeof getGeneratedFunnel>>) {
  return funnel.pages
    .flatMap((page) => page.sections)
    .filter((section) => section.type === "qualification_form")
    .flatMap((section) => section.fields ?? [])
    .filter((field) => field.required)
    .map((field) => field.id);
}
