/**
 * GET /api/audit/[id]/stream
 *
 * Server-Sent Events endpoint that emits the audit's lifecycle:
 *   queued → rendering → rendered → scoring → agent_completed (×5) → done | failed
 *
 * The agent-runner Worker pushes updates by writing intermediate progress
 * into the audit row + agent_runs table. This handler polls the DB and
 * translates state changes into SSE events. (In production we'd use a
 * Cloudflare Durable Object pub/sub instead, but polling makes the local
 * dev story trivial.)
 */

import type { NextRequest } from "next/server";

import { prisma } from "@funnel/db";
import type {
  AgentName,
  AgentRunMeta,
  AuditResultPayload,
  AuditStreamEvent,
  FinalScore,
  Improvement,
} from "@funnel/shared";

import { buildSSEStream, encodeSSE, SSE_HEADERS } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 750;
const MAX_DURATION_MS = 35_000;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auditId = params.id;

  const stream = buildSSEStream(async (controller) => {
    const enc = new TextEncoder();
    const send = (e: AuditStreamEvent) => controller.enqueue(enc.encode(encodeSSE(e)));

    const start = Date.now();
    let lastStatus = "";
    const sentAgents = new Set<AgentName>();

    while (Date.now() - start < MAX_DURATION_MS) {
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: { agentRuns: true, shareCode: true },
      });

      if (!audit) {
        send({ type: "failed", audit_id: auditId, reason: "Audit not found" });
        return;
      }

      // Status transition events.
      if (audit.status !== lastStatus) {
        lastStatus = audit.status;
        if (audit.status === "queued") send({ type: "queued", audit_id: auditId });
        if (audit.status === "rendering") send({ type: "rendering", audit_id: auditId });
        if (audit.status === "scoring") send({ type: "scoring", audit_id: auditId });
      }

      // Per-agent events.
      for (const run of audit.agentRuns) {
        const name = run.agentName as AgentName;
        if (sentAgents.has(name)) continue;
        sentAgents.add(name);
        const subscore = extractSubscore(run.output) ?? 0;
        send({
          type: "agent_completed",
          audit_id: auditId,
          agent: name,
          subscore,
          ms: run.durationMs ?? 0,
          ok: run.ok,
        });
      }

      if (audit.status === "done") {
        const payload = toResultPayload(audit, audit.agentRuns);
        send({ type: "done", audit_id: auditId, payload });
        return;
      }

      if (audit.status === "failed") {
        send({
          type: "failed",
          audit_id: auditId,
          reason: audit.failureReason ?? "Unknown failure",
        });
        return;
      }

      await sleep(POLL_MS);
    }

    // Timeout — let client know.
    send({
      type: "failed",
      audit_id: auditId,
      reason: "Timed out waiting for audit result",
    });
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractSubscore(output: unknown): number | null {
  if (!output || typeof output !== "object") return null;
  const v = (output as { score?: unknown }).score;
  return typeof v === "number" ? v : null;
}

/** Translate the DB rows into the public payload shape. */
function toResultPayload(
  audit: {
    id: string;
    url: string;
    status: string;
    completedAt: Date | null;
    createdAt: Date;
    scoreOverall: number | null;
    scoreGrade: string | null;
    subscores: unknown;
    critique: string | null;
    improvements: unknown;
    confidence: string | null;
    degradedAgents: string[];
    screenshotR2Key: string | null;
    pdfR2Key: string | null;
    previewR2Key: string | null;
    shareCode: { code: string } | null;
  },
  runs: Array<{
    agentName: string;
    model: string;
    durationMs: number | null;
    ok: boolean;
    error: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
  }>,
): AuditResultPayload {
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
  for (const r of runs) {
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

  return {
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
}
