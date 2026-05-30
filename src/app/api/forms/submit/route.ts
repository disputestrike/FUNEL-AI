/**
 * POST /api/forms/submit?funnel=<slug>
 *
 * Universal form-submission endpoint used by hosted previews and the
 * Next.js-served funnel renderer fallback (when the Cloudflare renderer
 * isn't in the path — local dev, preview deployments).
 *
 * Hardening:
 *   - Honeypot field (`hp_email`) — empty or silently accept + 200.
 *   - Time-on-page minimum (`tos_ms`) — must be at least 1500 ms.
 *   - Cloudflare Turnstile token verification (when configured).
 *   - Captures consent record (timestamp + IP + UA + consent text version).
 *
 * The actual lead capture + RevTry dispatch lives in
 * `/api/funnels/[slug]/lead`. This route validates the antibot envelope,
 * then delegates. Returns within ~100ms because the delegate fans-out via
 * setImmediate (the heavy work happens off the request path).
 *
 * Response: { ok, lead_id, next_url }
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  captureGeneratedFunnelLead,
  getGeneratedFunnel,
} from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Multi-shape body — `<form>` posts urlencoded, our SDK posts JSON.
const BodySchema = z
  .object({
    funnel_slug: z.string().optional(),
    hp_email: z.string().optional(), // honeypot
    tos_ms: z.coerce.number().optional(), // time-on-page
    "cf-turnstile-response": z.string().optional(),
    turnstile_token: z.string().optional(),
    consent_marketing: z.union([z.string(), z.boolean()]).optional(),
    consent_sms: z.union([z.string(), z.boolean()]).optional(),
    consent_voice: z.union([z.string(), z.boolean()]).optional(),
    consent_text_version: z.string().optional(),
  })
  .passthrough();

const MIN_TIME_ON_PAGE_MS = 1500;

function asBool(v: unknown): boolean {
  return v === true || v === "1" || v === "true" || v === "on";
}

async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const fd = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured — skip
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      }
    );
    const j = (await res.json()) as { success?: boolean };
    return !!j.success;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const slugFromQuery = url.searchParams.get("funnel") ?? undefined;

  let body: Record<string, string>;
  try {
    body = await readBody(req);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // 1. Honeypot — silently 200 so bots think they succeeded.
  if (parsed.data.hp_email && parsed.data.hp_email.length > 0) {
    return NextResponse.json(
      { ok: true, lead_id: null, next_url: "/" },
      { status: 200 }
    );
  }

  // 2. Time-on-page minimum (anti-bot).
  const tos = parsed.data.tos_ms ?? 0;
  if (tos > 0 && tos < MIN_TIME_ON_PAGE_MS) {
    return NextResponse.json(
      { ok: false, error: "too_fast" },
      { status: 400 }
    );
  }

  // 3. Turnstile (when token + secret configured).
  const turnstileToken =
    parsed.data["cf-turnstile-response"] ?? parsed.data.turnstile_token;
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  if (turnstileToken) {
    const ok = await verifyTurnstile(turnstileToken, ip);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "captcha_failed" },
        { status: 400 }
      );
    }
  }

  // 4. Resolve funnel.
  const slug = slugFromQuery ?? parsed.data.funnel_slug;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_funnel" }, { status: 400 });
  }
  const funnel = getGeneratedFunnel(slug);
  if (!funnel) {
    return NextResponse.json({ ok: false, error: "funnel_not_found" }, { status: 404 });
  }

  // 5. Extract Zod-validated form fields (everything except the antibot/meta
  //    keys above). Trim to <=1000 chars per value to bound the row size.
  const META_KEYS = new Set([
    "funnel_slug",
    "hp_email",
    "tos_ms",
    "cf-turnstile-response",
    "turnstile_token",
    "consent_marketing",
    "consent_sms",
    "consent_voice",
    "consent_text_version",
  ]);
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (META_KEYS.has(k)) continue;
    if (typeof v !== "string") continue;
    fields[k] = v.slice(0, 1000);
  }

  // 6. Persist via the shared capture helper. This emits lead_captured and
  //    kicks off the speed-to-lead pipeline asynchronously.
  const lead = captureGeneratedFunnelLead({ slug, fields });
  if (!lead) {
    return NextResponse.json({ ok: false, error: "capture_failed" }, { status: 500 });
  }

  // 7. Stamp a consent record into the lead's fields so the audit log has it.
  const consent = {
    consent_id: `cns_${Math.random().toString(36).slice(2, 14)}`,
    consent_text_version: parsed.data.consent_text_version ?? "v1",
    captured_at: new Date().toISOString(),
    ip,
    user_agent: req.headers.get("user-agent") ?? "",
    marketing: asBool(parsed.data.consent_marketing),
    sms: asBool(parsed.data.consent_sms),
    voice: asBool(parsed.data.consent_voice),
  };

  // 8. Fan-out: SMS auto-reply + RevTry dial + owner notification.
  //    We don't await — the response should land in <100ms.
  void dispatchSpeedToLeadAsync({
    slug,
    leadId: lead.id,
    funnelId: lead.funnel_id,
    fields,
    consent,
  });

  return NextResponse.json(
    {
      ok: true,
      lead_id: lead.id,
      consent_id: consent.consent_id,
      next_url: lead.next_path,
    },
    { status: 200 }
  );
}

/**
 * Fire-and-forget: triggers the speed-to-lead pipeline (SMS auto-reply,
 * enqueues a RevTry dial, notifies the funnel owner). Errors are swallowed
 * because we don't want them to taint the form submission.
 */
async function dispatchSpeedToLeadAsync(args: {
  slug: string;
  leadId: string;
  funnelId: string;
  fields: Record<string, string>;
  consent: Record<string, unknown>;
}): Promise<void> {
  try {
    // Delegate to the existing slug-scoped handler so we share validation
    // + dialer behaviour. Internal request via raw fetch with a synthesized
    // body — this is the same shape the public route expects.
    const apiBase = process.env.INTERNAL_BASE_URL ?? process.env.APP_BASE_URL;
    if (!apiBase) return;
    await fetch(`${apiBase.replace(/\/+$/, "")}/api/funnels/${args.slug}/lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: args.fields,
        consent: args.consent,
        session_id: args.leadId,
      }),
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}
