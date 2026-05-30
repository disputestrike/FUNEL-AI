/**
 * Per-generation audit log (Doc 19 §A.5).
 *
 * EVERY meaningful step writes one row before its SSE chunk flushes:
 *   - phase transition (generation_started, phase2_started, etc.)
 *   - per-agent (`step: 'agent.{name}.completed'`)
 *   - QA, fact-check, compliance findings
 *   - quality_scored, regeneration_started, degradation_applied
 *
 * The audit log is the source of truth used by `resume()` (§A.5) to rebuild
 * in-memory state after the Actor dies.
 */

import type {
  AgentName,
  AuditRow,
  DbClient,
  Logger,
  ModelCallRecord,
  ModelId,
  Clock,
} from "./types.js";
import { stableHash } from "./idempotency.js";

export class AuditWriter {
  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger,
    private readonly clock: Clock,
    private readonly generationId: string,
    private readonly workspaceId: string,
  ) {}

  async record(args: {
    agent: AgentName | "system";
    step: string;
    modelUsed?: ModelId;
    promptText?: string;
    outputText?: string;
    kbSources?: string[];
    costCents?: number;
    cacheHitRatio?: number;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const row: AuditRow = {
      generation_id: this.generationId,
      workspace_id: this.workspaceId,
      agent: args.agent,
      step: args.step,
      model_used: args.modelUsed,
      prompt_hash: args.promptText ? stableHash(args.promptText) : undefined,
      output_hash: args.outputText ? stableHash(args.outputText) : undefined,
      kb_sources: args.kbSources,
      cost_cents: args.costCents,
      cache_hit_ratio: args.cacheHitRatio,
      ts: this.clock.iso(),
      meta: args.meta,
    };

    try {
      await this.db.insertAuditRow(row);
    } catch (err) {
      // Audit-log write failure must not block generation — log + continue,
      // PagerDuty alert is driven by the row-count delta in ops dashboards.
      this.logger.error("audit_write_failed", {
        generationId: this.generationId,
        step: args.step,
        error: String(err),
      });
    }
  }

  /** Convenience: roll an agent's CostRecord into a single audit row. */
  async recordAgentCompletion(args: {
    agent: AgentName;
    modelUsed: ModelId;
    output: unknown;
    calls: ModelCallRecord[];
    cacheHitRatio: number;
    kbSources?: string[];
  }): Promise<void> {
    const cost = args.calls.reduce(
      (acc, c) => acc + c.unitCount * c.unitRateCents,
      0,
    );
    await this.record({
      agent: args.agent,
      step: `agent.${args.agent}.completed`,
      modelUsed: args.modelUsed,
      outputText: JSON.stringify(args.output),
      kbSources: args.kbSources,
      costCents: cost,
      cacheHitRatio: args.cacheHitRatio,
      meta: { calls: args.calls.length },
    });
  }
}
