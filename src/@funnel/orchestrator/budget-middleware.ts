/**
 * Budget enforcement + graceful degradation (Doc 19 §E.2-E.3).
 *
 * `withBudget` wraps any Agent so that:
 *   - before run: peek cg-svc; if `overrun`, emit error and abort
 *   - if `exhausted`: apply degradation (downgrade model, prefer cache)
 *   - after run: charge cg-svc; surface budget warnings to the caller's
 *     event stream via the supplied `onWarning` callback
 *
 * Degradation table (Doc 19 §E.3):
 *
 *   |  status         | actions
 *   |  ok             | none
 *   |  near_limit_80  | warn + downgrade *next* LLM call one tier
 *   |  exhausted      | skip optional agents, force cache, downgrade
 *   |  overrun        | skip Video + regen; publish partial
 *
 * Important: this wrapper never *retries* on budget errors. Retry semantics
 * live in `retry-middleware.ts` and stop short when the error kind is
 * `budget`.
 */

import type {
  Agent,
  AgentContext,
  AgentEvent,
  AgentName,
  BudgetWarningData,
  CostGovernorClient,
  CostRecommendation,
  DegradationAction,
  DegradationData,
  Logger,
  ModelId,
} from "./types.js";
import { FALLBACK_CHAINS } from "./types.js";

export interface BudgetWrapperOptions {
  cg: CostGovernorClient;
  logger: Logger;
  /** Called with structured warnings; orchestrator should re-emit as SSE. */
  onWarning?: (warning: BudgetWarningData) => void;
  /** Called when degradation is applied; orchestrator should re-emit as SSE. */
  onDegradation?: (data: DegradationData) => void;
}

const OPTIONAL_AGENTS_AT_EXHAUSTION: AgentName[] = ["upsell", "sms", "voice_script"];

export function withBudget<TIn, TOut>(
  agent: Agent<TIn, TOut>,
  opts: BudgetWrapperOptions,
): Agent<TIn, TOut> {
  return {
    name: agent.name,
    primaryModel: agent.primaryModel,
    fallbackChain: agent.fallbackChain,
    async *run(input, ctx) {
      const status = await opts.cg.peek(ctx.generationId);

      if (status.status === "overrun") {
        opts.logger.warn("budget_overrun_skip_agent", {
          agent: agent.name,
          generationId: ctx.generationId,
          remaining: status.remainingCents,
        });
        emitDegradation(opts, ctx, "budget_150", ["skip_optional", "truncate"]);
        yield {
          type: "error",
          error: { kind: "budget", remainingCents: status.remainingCents },
          willRetry: false,
        };
        return;
      }

      if (
        status.status === "exhausted" &&
        OPTIONAL_AGENTS_AT_EXHAUSTION.includes(agent.name)
      ) {
        opts.logger.info("budget_exhausted_skip_optional", { agent: agent.name });
        emitDegradation(opts, ctx, "budget_100", ["skip_optional"]);
        yield {
          type: "error",
          error: { kind: "budget", remainingCents: status.remainingCents },
          willRetry: false,
        };
        return;
      }

      // Apply soft degradation by mutating ctx for downstream agents.
      const degraded = maybeDegrade(ctx, agent, status);
      if (degraded.actions.length > 0) {
        emitDegradation(opts, ctx, degraded.trigger, degraded.actions);
      }

      for await (const ev of agent.run(input, degraded.ctx)) {
        yield ev;

        if (ev.type === "final") {
          let rec: CostRecommendation;
          try {
            rec = await ctx.recordCost(agent.name, ev.cost.calls);
          } catch (err) {
            opts.logger.error("cost_record_failed", {
              agent: agent.name,
              error: String(err),
            });
            return;
          }

          if (rec.status === "near_limit_80" && opts.onWarning) {
            opts.onWarning({
              generationId: ctx.generationId,
              spentCents: 0, // filled in by orchestrator from cg-svc
              capCents: 0,
              pctUsed: 0.8,
              ts: ctx.clock.iso(),
            });
          }

          if (rec.status === "overrun") {
            opts.logger.warn("budget_overrun_after_call", {
              agent: agent.name,
              remaining: rec.remainingCents,
            });
          }
        }
      }
    },
  };
}

function emitDegradation(
  opts: BudgetWrapperOptions,
  ctx: AgentContext,
  trigger: DegradationData["trigger"],
  actions: DegradationAction[],
): void {
  opts.onDegradation?.({
    generationId: ctx.generationId,
    trigger,
    actions,
    ts: ctx.clock.iso(),
  });
}

/**
 * Soft degradation — when the governor returns `near_limit_80` or `exhausted`
 * we transparently downgrade the *next* call to the agent's primary fallback.
 * This is the simplest hook into the retry-middleware which already picks up
 * `ctx._modelOverride` if present.
 */
function maybeDegrade<TIn, TOut>(
  ctx: AgentContext,
  agent: Agent<TIn, TOut>,
  status: CostRecommendation,
): { ctx: AgentContext; actions: DegradationAction[]; trigger: DegradationData["trigger"] } {
  const actions: DegradationAction[] = [];
  let trigger: DegradationData["trigger"] = "budget_100";
  let nextCtx = ctx;
  if (status.status === "near_limit_80") {
    trigger = "budget_100"; // labels in the SSE are coarse buckets; the spec uses budget_100 for ≥80%
    const fallback = nextFallback(agent.primaryModel);
    if (fallback) {
      actions.push("downgrade_model");
      nextCtx = { ...ctx, _modelOverride: fallback };
    }
    if (status.recommendation === "cache_if_possible") actions.push("use_cache");
  } else if (status.status === "exhausted") {
    trigger = "budget_100";
    actions.push("downgrade_model", "use_cache");
    const fallback = nextFallback(agent.primaryModel);
    if (fallback) nextCtx = { ...ctx, _modelOverride: fallback };
  }
  return { ctx: nextCtx, actions, trigger };
}

function nextFallback(primary: ModelId): ModelId | undefined {
  const chain = FALLBACK_CHAINS[primary];
  return chain && chain.length > 0 ? chain[0] : undefined;
}
