/**
 * POST /api/email-capture
 *
 * Captures the email gate from the audit result page:
 *  1. Validate audit_id + email.
 *  2. Upsert email_captures row (idempotent by (email, source)).
 *  3. Add to waitlist (idempotent).
 *  4. Kick off PDF generation (async, fire-and-forget).
 *  5. Send the PDF email via Resend.
 *  6. Return PDF URL + `preview_unlocked: true`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { prisma } from "@funnel/db";
import { emit } from "@funnel/events";
import { EmailCaptureSchema, R2_PATHS } from "@funnel/shared";

import { hashEmail } from "@/lib/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const PDF_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "https://r2.gofunnelai.com";
const FROM = process.env.EMAIL_FROM ?? "GoFunnelAI <audits@gofunnelai.com>";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EmailCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing email or audit_id" }, { status: 400 });
  }
  const { audit_id, email, marketing_consent } = parsed.data;

  const audit = await prisma.audit.findUnique({ where: { id: audit_id } });
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  // Idempotent capture.
  await prisma.emailCapture.upsert({
    where: { email_source: { email, source: "grader_pdf_gate" } },
    create: {
      email,
      auditId: audit_id,
      source: "grader_pdf_gate",
      marketingConsent: marketing_consent,
      ip: ip ?? undefined,
      ua: ua ?? undefined,
    },
    update: {
      auditId: audit_id,
      marketingConsent: marketing_consent,
    },
  });

  // Waitlist (idempotent by unique email).
  const existing = await prisma.waitlist.findUnique({ where: { email } });
  if (!existing) {
    const count = await prisma.waitlist.count();
    await prisma.waitlist.create({
      data: { email, auditId: audit_id, position: count + 1 },
    });
  }

  // Telemetry â€” no raw email.
  const emailDomain = email.split("@")[1] ?? "";
  const email_hash = await hashEmail(email);
  await emit("email_captured", {
    audit_id,
    source: "grader_pdf_gate",
    marketing_consent,
    email_domain: emailDomain,
    email_hash,
  }).catch(() => null);

  // PDF generation lives in the agent-runner Worker (signed URL stored on audit
  // row). Here we either:
  //  - return the existing pdf URL if generation already finished, or
  //  - request generation and email it asynchronously.
  let pdfUrl: string | null = null;
  if (audit.pdfR2Key) {
    pdfUrl = `${PDF_BASE}/${audit.pdfR2Key}`;
  } else {
    // Trigger pdf generation in the runner.
    void fetch(`${process.env.AGENT_RUNNER_URL ?? ""}/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AGENT_RUNNER_SECRET ?? ""}`,
      },
      body: JSON.stringify({ audit_id, email }),
    }).catch(() => null);
    // Optimistic URL â€” runner will write the file by the time the email arrives.
    pdfUrl = `${PDF_BASE}/${R2_PATHS.pdf(audit_id)}`;
  }

  // Send the email (best-effort).
  if (resend) {
    await resend.emails
      .send({
        from: FROM,
        to: email,
        subject: `Your funnel audit for ${audit.urlHostname} â€” score ${audit.scoreOverall ?? "(pending)"}/100`,
        text: [
          `Hi,`,
          ``,
          `Your audit for ${audit.url} is ready.`,
          ``,
          `Score: ${audit.scoreOverall ?? "â€”"}/100 (${audit.scoreGrade ?? "â€”"})`,
          ``,
          `Full PDF: ${pdfUrl}`,
          ``,
          `â€” GoFunnelAI`,
        ].join("\n"),
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[resend] send failed", err);
      });
  }

  return NextResponse.json({
    ok: true,
    pdf_url: pdfUrl,
    preview_unlocked: true,
  });
}
