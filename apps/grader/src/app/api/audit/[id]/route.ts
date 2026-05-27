/**
 * GET /api/audit/[id]
 *
 * Returns the canonical AuditResultPayload for a finished audit. Used by:
 *   - share pages after SSE stream closes
 *   - share-card OG generation
 *   - the PDF generator
 */

import { NextResponse } from "next/server";

import { prisma } from "@funnel/db";
import type {
  AgentName,
  AgentRunMeta,
  AuditResultPayload,
  FinalScore,
  Improvement,
} from "@funnel/shared";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: { agentRuns: true, shareCode: true },
  });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const score: FinalScore | null = audit.scoreOverall !== null
    ? {
        overall: audit.scoreOverall,
        grade: (audit.scoreGrade ?? "F") as FinalScore["grade"],
        subscores: (audit.subscores as FinalScore["subscores"]) ?? {
          hook: 0,
          form: 0,
          trust: 0,
          speed: 0,
          compliance: 0,
        },
        critique: audit.critique ?? "",
        improvements: (audit.improvements as Improvement[]) ?? [],
        confidence: (audit.confidence as FinalScore["confidence"]) ?? "medium",
        degraded_agents: (audit.degradedAgents ?? []) as AgentName[],
      }
    : null;

  const agentRuns: Partial<Record<AgentName, AgentRunMeta>> = {};
  for (const r of audit.agentRuns) {
    agentRuns[r.agentName as AgentName] = {
      model: r.model,
      input_tokens: r.inputTokens ?? undefined,
      output_tokens: r.outputTokens ?? undefined,
      cache_read_tokens: r.cacheReadTokens ?? undefined,
      ms: r.durationMs ?? 0,
      ok: r.ok,
      error: r.error,
    };
  }

  const payload: AuditResultPayload = {
    audit_id: audit.id,
    url: audit.url,
    fetched_at: (audit.completedAt ?? audit.createdAt).toISOString(),
    status: audit.status as AuditResultPayload["status"],
    screenshot_url: audit.screenshotR2Key
      ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? ""}/${audit.screenshotR2Key}`
      : null,
    share_code: audit.shareCode?.code ?? "",
    pdf_url: audit.pdfR2Key
      ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? ""}/${audit.pdfR2Key}`
      : null,
    preview_funnel_id: audit.previewR2Key,
    score,
    agent_runs: agentRuns,
  };

  return NextResponse.json(payload);
}
