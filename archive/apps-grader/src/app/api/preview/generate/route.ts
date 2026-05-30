/**
 * POST /api/preview/generate
 *
 * Triggers the "what we'd generate instead" mini-funnel rendered by the
 * agent-runner. Returns the iframe URL once the runner reports completion
 * (or a polling URL if the user wants to display a 30-second progress UI).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@funnel/db";
import { emit } from "@funnel/events";
import { R2_PATHS } from "@funnel/shared";

export const runtime = "nodejs";

const PREVIEW_PUBLIC_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "https://r2.gofunnelai.com";
const RUNNER_URL = process.env.AGENT_RUNNER_URL ?? "https://grader-agents.gofunnelai.com";
const RUNNER_SECRET = process.env.AGENT_RUNNER_SECRET ?? "dev-secret";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { audit_id } = (body ?? {}) as { audit_id?: string };
  if (!audit_id) {
    return NextResponse.json({ error: "audit_id required" }, { status: 400 });
  }

  const audit = await prisma.audit.findUnique({ where: { id: audit_id } });
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  await emit("preview_clicked", { audit_id }).catch(() => null);

  // Existing preview? Return it.
  if (audit.previewR2Key) {
    return NextResponse.json({
      preview_url: `${PREVIEW_PUBLIC_BASE}/${audit.previewR2Key}`,
      cached: true,
    });
  }

  // Otherwise, ask the runner to build it (30s budget). We wait for it here
  // because the UX shows an inline progress state â€” the timeout is enforced
  // by the runner.
  const resp = await fetch(`${RUNNER_URL}/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_SECRET}`,
    },
    body: JSON.stringify({ audit_id }),
  }).catch(() => null);

  if (!resp || !resp.ok) {
    return NextResponse.json(
      { error: "Preview service unavailable. Try again in a moment." },
      { status: 503 },
    );
  }

  // Runner returns the R2 key when finished.
  const data = (await resp.json()) as { r2_key?: string };
  const r2Key = data.r2_key ?? R2_PATHS.preview(audit_id);

  await prisma.audit.update({
    where: { id: audit_id },
    data: { previewR2Key: r2Key },
  });

  return NextResponse.json({
    preview_url: `${PREVIEW_PUBLIC_BASE}/${r2Key}`,
    cached: false,
  });
}
