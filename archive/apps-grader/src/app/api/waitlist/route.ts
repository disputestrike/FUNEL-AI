/**
 * POST /api/waitlist
 *
 * Adds an email to the waitlist independent of an audit. Used by the
 * "Join waitlist for the full funnel" CTA below the preview iframe.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@funnel/db";
import { emit } from "@funnel/events";
import { WaitlistSchema } from "@funnel/shared";

import { hashEmail } from "@/lib/hash";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, audit_id } = parsed.data;

  const existing = await prisma.waitlist.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: true, position: existing.position });
  }

  const count = await prisma.waitlist.count();
  const entry = await prisma.waitlist.create({
    data: { email, auditId: audit_id, position: count + 1 },
  });

  const email_hash = await hashEmail(email);
  await emit("email_captured", {
    audit_id,
    source: "grader_waitlist",
    marketing_consent: true,
    email_domain: email.split("@")[1] ?? "",
    email_hash,
  }).catch(() => null);
  await emit("waitlist_joined", {
    audit_id,
    source: "grader",
    position: entry.position,
  }).catch(() => null);

  return NextResponse.json({ ok: true, position: entry.position });
}
