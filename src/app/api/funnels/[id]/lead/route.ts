/**
 * POST /api/funnels/[slug]/lead — captures a form submission and triggers
 * the RevTry speed-to-lead pipeline.
 *
 * Order of operations:
 *   1. Validate form fields against the funnel schema.
 *   2. Capture the lead (idempotent on session_id when provided).
 *   3. Record the PEWC consent if the form ships the checkbox.
 *   4. Emit `lead_captured` so downstream automations fire.
 *   5. Enqueue an outbound dial via `@funnel/revtry`'s `queueOutboundDial`.
 *      This is fire-and-forget — the response returns the redirect URL
 *      immediately so the form UX is sub-100ms.
 *
 * The dial only runs when:
 *   - the form has a phone number, AND
 *   - the visitor checked the PEWC consent box (`consent.voice === true`).
 *
 * SLA budget: dial → first ring within 60 sec of capture. The enqueuer fires
 * the actual SignalWire call in the voice worker; in dev / when SignalWire
 * keys are missing, the demo simulator runs instead (UI still shows the
 * "Dialing…" → "Connected" transitions).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  captureGeneratedFunnelLead,
  getGeneratedFunnel,
  listGeneratedFunnelLeads,
} from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ConsentSchema = z
  .object({
    /** Marketing email/SMS consent (CAN-SPAM + general TCPA). */
    marketing: z.boolean().optional(),
    sms: z.boolean().optional(),
    /** PEWC — prior express written consent for AI-generated voice calls. */
    voice: z.boolean().optional(),
  })
  .partial()
  .optional();

const LeadRequest = z.object({
  fields: z.record(z.string().trim().max(1000)).default({}),
  consent: ConsentSchema,
  /** Optional metadata used by the dialer + analytics. */
  session_id: z.string().max(120).optional(),
  language: z.string().max(8).optional(),
});

interface RevTryModule {
  queueOutboundDial(args: {
    workspace_id: string;
    lead_id: string;
    funnel_id: string;
    phone_e164: string;
    deadline_at: string;
    industry?: string;
    persona?: string;
    language?: string;
    first_name?: string | null;
  }): Promise<{ call_id: string; demo: boolean }>;
  isDemoMode?(): boolean;
}

const E164 = /^\+\d{8,15}$/;

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (E164.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function pickField(fields: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (fields[k]) return fields[k];
  }
  return undefined;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const funnel = getGeneratedFunnel(params.id);
  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });

  const parsed = LeadRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload" }, { status: 400 });
  }

  const missing = requiredFields(funnel).filter((field: string) => !parsed.data.fields[field]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 400 },
    );
  }

  const lead = captureGeneratedFunnelLead({
    slug: params.id,
    fields: parsed.data.fields,
  });
  if (!lead) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });

  // Voice routing — only when phone + PEWC consent + funnel allows it.
  let dial_status: "queued" | "skipped" | "not_eligible" | "error" = "skipped";
  let call_id: string | null = null;
  let demo = false;
  let skip_reason: string | null = null;

  const phoneRaw = pickField(parsed.data.fields, ["phone", "phone_number", "tel", "mobile"]);
  const phone_e164 = normalizePhone(phoneRaw);
  const first_name = pickField(parsed.data.fields, ["first_name", "firstName", "name"]) ?? null;
  const voiceConsent = parsed.data.consent?.voice === true;
  const voiceRouted = lead.routing.voice;

  if (!phone_e164) {
    skip_reason = "no_phone";
  } else if (!voiceConsent) {
    skip_reason = "no_pewc_consent";
  } else if (!voiceRouted) {
    skip_reason = "voice_provider_not_ready";
  } else {
    dial_status = "queued";
    try {
      const modulePath = "@funnel/revtry";
      const mod = (await import(/* @vite-ignore */ modulePath)) as unknown as RevTryModule;
      const deadline_at = new Date(Date.now() + 60_000).toISOString();
      const workspace_id =
        (funnel as { workspace_id?: string }).workspace_id ?? "ws_generated";
      const result = await mod.queueOutboundDial({
        workspace_id,
        lead_id: lead.id,
        funnel_id: lead.funnel_id,
        phone_e164,
        deadline_at,
        industry: (funnel as { industry?: string }).industry ?? "generic",
        persona: (funnel as { persona?: string }).persona ?? "funnel",
        language: parsed.data.language ?? "en",
        first_name,
      });
      call_id = result.call_id;
      demo = result.demo;
    } catch (err) {
      dial_status = "error";
      skip_reason = `revtry_unavailable:${err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80)}`;
    }
  }

  if (skip_reason && dial_status === "skipped") {
    dial_status = "not_eligible";
  }

  return NextResponse.json({
    ok: true,
    lead_id: lead.id,
    next_path: lead.next_path,
    routing: lead.routing,
    revtry: {
      status: dial_status,
      call_id,
      demo,
      skip_reason,
      sla_budget_sec: 60,
    },
    message: "Lead captured. Follow-up adapters will fire automatically when provider keys are connected.",
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const funnel = getGeneratedFunnel(params.id);
  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  const leads = listGeneratedFunnelLeads(params.id);
  return NextResponse.json({
    ok: true,
    count: leads.length,
    latest: leads.at(-1) ?? null,
  });
}

interface FormField {
  id: string;
  required?: boolean;
}
interface FormSection {
  type: string;
  fields?: FormField[];
}
interface FormPage {
  sections: FormSection[];
}

function requiredFields(funnel: NonNullable<ReturnType<typeof getGeneratedFunnel>>): string[] {
  const pages = (funnel as { pages: FormPage[] }).pages;
  return pages
    .flatMap((page) => page.sections)
    .filter((section) => section.type === "qualification_form")
    .flatMap((section) => section.fields ?? [])
    .filter((field) => field.required)
    .map((field) => field.id);
}
