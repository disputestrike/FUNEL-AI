/**
 * Cost meter for a single audit + a global daily-spend ratchet.
 *
 * In-audit: accumulate cents per agent; when we exceed COST_CAP_AUDIT_CENTS we
 * stop spending and fall back to whatever results we already have. This is the
 * "fail gracefully" requirement from the spec.
 *
 * Global: an atomic increment on the cost_governor row. We don't gate the
 * *individual* audit on this — we read mode at the start and downshift to
 * Haiku for everything if mode != normal.
 */

import type { Sql } from "./db.js";

/** Approximate cost in cents per 1k tokens. */
const RATES = {
  "claude-sonnet-4-5": { input_cents_per_1k: 0.3, output_cents_per_1k: 1.5 },
  "claude-haiku-4-5": { input_cents_per_1k: 0.025, output_cents_per_1k: 0.125 },
  "claude-opus-4-1": { input_cents_per_1k: 1.5, output_cents_per_1k: 7.5 },
} as const;

export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const rate = (RATES as Record<string, { input_cents_per_1k: number; output_cents_per_1k: number }>)[model] ?? RATES["claude-sonnet-4-5"];
  const billedInput = Math.max(0, inputTokens - cacheReadTokens) + cacheReadTokens * 0.1; // cache hits ~10%
  return (
    (billedInput / 1000) * rate.input_cents_per_1k +
    (outputTokens / 1000) * rate.output_cents_per_1k
  );
}

export class AuditCostMeter {
  private spent = 0;
  constructor(private readonly capCents: number) {}

  add(cents: number): void {
    this.spent += cents;
  }

  budgetRemaining(): number {
    return Math.max(0, this.capCents - this.spent);
  }

  exhausted(): boolean {
    return this.spent >= this.capCents;
  }

  total(): number {
    return Math.round(this.spent * 100) / 100;
  }
}

export type GlobalMode = "normal" | "degraded" | "queue" | "cutoff";

export async function getGlobalMode(sql: Sql, dailyBudgetCents: number, hardCapCents: number): Promise<{
  mode: GlobalMode;
  spendCents: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = (await sql(`SELECT spend_cents FROM cost_governor WHERE day = $1`, [today])) as Array<{
    spend_cents: number;
  }>;
  const spend = rows[0]?.spend_cents ?? 0;
  let mode: GlobalMode = "normal";
  if (spend > hardCapCents) mode = "cutoff";
  else if (spend > dailyBudgetCents * 1.5) mode = "queue";
  else if (spend > dailyBudgetCents) mode = "degraded";
  return { mode, spendCents: spend };
}

export async function bumpGlobalSpend(sql: Sql, cents: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await sql(
    `INSERT INTO cost_governor (day, spend_cents, audits_completed)
     VALUES ($1::date, $2, 1)
     ON CONFLICT (day) DO UPDATE SET
       spend_cents = cost_governor.spend_cents + EXCLUDED.spend_cents,
       audits_completed = cost_governor.audits_completed + 1`,
    [today, Math.round(cents)],
  );
}
