/**
 * Tiny SQL helper using @neondatabase/serverless (Workers-compatible Postgres).
 *
 * We deliberately avoid Prisma in the Worker runtime — it pulls in too much
 * binary weight. The schema lives in @funnel/db; this module just runs raw
 * SQL against it.
 */

import { neon } from "@neondatabase/serverless";

export type Sql = ReturnType<typeof neon>;

let cached: Sql | null = null;

export function getSql(databaseUrl: string): Sql {
  if (!cached) {
    cached = neon(databaseUrl);
  }
  return cached;
}

export async function setAuditStatus(
  sql: Sql,
  auditId: string,
  status: "queued" | "rendering" | "scoring" | "done" | "failed",
  extra: Record<string, unknown> = {},
): Promise<void> {
  const keys = Object.keys(extra);
  const sets = keys
    .map((k, i) => `${quote(k)} = $${i + 3}`)
    .join(", ");
  const params = keys.map((k) => extra[k]);
  const finalSql = `UPDATE audits SET status = $1::"grader_audit_status", ${sets ? sets + "," : ""} updated_at = NOW() WHERE id = $2`;
  await sql(finalSql, [status, auditId, ...params]);
}

function quote(k: string): string {
  return `"${k.replace(/"/g, '""')}"`;
}

export async function insertAgentRun(
  sql: Sql,
  row: {
    auditId: string;
    agentName: string;
    model: string;
    durationMs: number;
    ok: boolean;
    error?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    cacheReadTokens?: number | null;
    output: unknown;
    costCents?: number | null;
  },
): Promise<void> {
  await sql(
    `INSERT INTO agent_runs
      (audit_id, agent_name, model, duration_ms, ok, error,
       input_tokens, output_tokens, cache_read_tokens, output, cost_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
    [
      row.auditId,
      row.agentName,
      row.model,
      row.durationMs,
      row.ok,
      row.error ?? null,
      row.inputTokens ?? null,
      row.outputTokens ?? null,
      row.cacheReadTokens ?? null,
      JSON.stringify(row.output ?? null),
      row.costCents ?? null,
    ],
  );
}

export async function finalizeAudit(
  sql: Sql,
  auditId: string,
  data: {
    scoreOverall: number | null;
    scoreGrade: string | null;
    subscores: Record<string, number>;
    critique: string;
    improvements: unknown;
    confidence: string;
    degradedAgents: string[];
    screenshotR2Key: string;
    ogR2Key?: string | null;
    costCents: number;
  },
): Promise<void> {
  await sql(
    `UPDATE audits SET
        status = 'done'::"grader_audit_status",
        score_overall = $1,
        score_grade = $2,
        subscores = $3::jsonb,
        critique = $4,
        improvements = $5::jsonb,
        confidence = $6::"grader_confidence",
        degraded_agents = $7,
        screenshot_r2_key = $8,
        og_r2_key = $9,
        cost_cents = $10,
        completed_at = NOW()
     WHERE id = $11`,
    [
      data.scoreOverall,
      data.scoreGrade,
      JSON.stringify(data.subscores),
      data.critique,
      JSON.stringify(data.improvements),
      data.confidence,
      data.degradedAgents,
      data.screenshotR2Key,
      data.ogR2Key ?? null,
      data.costCents,
      auditId,
    ],
  );
}

export async function getAudit(sql: Sql, auditId: string) {
  const rows = (await sql(`SELECT * FROM audits WHERE id = $1 LIMIT 1`, [auditId])) as Array<
    Record<string, unknown>
  >;
  return rows[0] ?? null;
}
