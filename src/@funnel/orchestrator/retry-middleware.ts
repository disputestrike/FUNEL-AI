/**
 * Retry + fallback middleware (Doc 19 §G).
 *
 * - Transient (HTTP 429/500/502/503/504): exponential backoff + jitter,
 *   up to 3 attempts.
 * - Rate-limit (429 w/ Retry-After or burst): downgrade to next model in
 *   the fallback chain rather than blocking — Doc 19 §G.3.
 * - Schema-invalid: single re-prompt with the parser error inlined.
 * - Content-policy: never retry; surface and let the orchestrator decide
 *   (usually: trigger Human Review).
 * - Auth: never retry; alert ops (logger.error → PagerDuty sink).
 * - Cancelled: bubble up immediately.
 */

import type { Agent, AgentError, AgentEvent, Logger, ModelId } from "./types.js";
import { FALLBACK_CHAINS } from "./types.js";

export interface RetryOptions {
  logger: Logger;
  /** Defaults to 3. Doc 19 §G.2 caps transient retries at 3. */
  maxTransient?: number;
  /** Defaults to 1. Doc 19 §B.2.1 — single schema re-prompt. */
  maxSchemaRetries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Injectable for tests — defaults to `Math.random`. */
  rand?: () => number;
}

const DEFAULT_TRANSIENT = 3;
const DEFAULT_SCHEMA = 1;

export function withRetry<TIn, TOut>(
  agent: Agent<TIn, TOut>,
  opts: RetryOptions,
): Agent<TIn, TOut> {
  const sleep = opts.sleep ?? defaultSleep;
  const rand = opts.rand ?? Math.random;
  const maxTransient = opts.maxTransient ?? DEFAULT_TRANSIENT;
  const maxSchemaRetries = opts.maxSchemaRetries ?? DEFAULT_SCHEMA;

  return {
    name: agent.name,
    primaryModel: agent.primaryModel,
    fallbackChain: agent.fallbackChain,
    async *run(input, ctx) {
      let attempt = 0;
      let schemaAttempts = 0;
      let model: ModelId = agent.primaryModel;
      const fallbacks: ModelId[] = [...(agent.fallbackChain || FALLBACK_CHAINS[agent.primaryModel] || [])];

      while (true) {
        if (ctx.abortSignal.aborted) {
          yield {
            type: "error",
            error: { kind: "cancelled" } as AgentError,
            willRetry: false,
          };
          return;
        }
        try {
          let finalSeen = false;
          for await (const ev of agent.run(
            { ...(input as object), _modelOverride: model } as TIn,
            { ...ctx, _modelOverride: model },
          )) {
            if (ev.type === "error") throw ev.error;
            yield ev;
            if (ev.type === "final") finalSeen = true;
          }
          if (finalSeen) return;
          // Iterator closed without `final` AND without an error — treat as transient.
          throw { kind: "transient", httpStatus: 502, provider: "unknown" } as AgentError;
        } catch (err) {
          const e = normalize(err);
          attempt++;

          if (e.kind === "cancelled") {
            yield { type: "error", error: e, willRetry: false };
            return;
          }

          if (e.kind === "transient" && attempt <= maxTransient) {
            const delay = jitter(Math.pow(2, attempt) * 500, rand);
            opts.logger.warn("transient_retry", {
              agent: agent.name,
              attempt,
              delayMs: delay,
              provider: e.provider,
              status: e.httpStatus,
            });
            try {
              await sleep(delay, ctx.abortSignal);
            } catch {
              yield { type: "error", error: { kind: "cancelled" }, willRetry: false };
              return;
            }
            continue;
          }

          if (e.kind === "rate_limit") {
            if (fallbacks.length > 0) {
              const next = fallbacks.shift()!;
              opts.logger.warn("rate_limit_downgrade", {
                agent: agent.name,
                from: model,
                to: next,
              });
              model = next;
              continue;
            }
            if (attempt <= maxTransient) {
              const delay = e.retryAfterMs ?? 5000;
              opts.logger.warn("rate_limit_backoff", {
                agent: agent.name,
                attempt,
                delayMs: delay,
              });
              await sleep(delay, ctx.abortSignal);
              continue;
            }
          }

          if (e.kind === "schema_invalid" && schemaAttempts < maxSchemaRetries) {
            schemaAttempts++;
            opts.logger.warn("schema_invalid_reprompt", {
              agent: agent.name,
              attempt: schemaAttempts,
              errors: e.errors.slice(0, 3),
            });
            (input as Record<string, unknown>)._priorErrors = e.errors;
            continue;
          }

          if (e.kind === "content_policy") {
            opts.logger.warn("content_policy_skip", {
              agent: agent.name,
              reason: e.reason,
            });
            yield { type: "error", error: e, willRetry: false };
            return;
          }

          if (e.kind === "auth") {
            opts.logger.error("auth_failure_alert_ops", { provider: e.provider });
            yield { type: "error", error: e, willRetry: false };
            return;
          }

          if (e.kind === "safety_block") {
            opts.logger.warn("safety_block_no_retry", {
              agent: agent.name,
              classifier: e.classifier,
              reason: e.reason,
            });
            yield { type: "error", error: e, willRetry: false };
            return;
          }

          if (e.kind === "budget") {
            // Budget handler is the budget middleware — don't retry past it.
            yield { type: "error", error: e, willRetry: false };
            return;
          }

          // Generic: try the next fallback model if we haven't exhausted.
          if (fallbacks.length > 0 && attempt <= maxTransient + 1) {
            const next = fallbacks.shift()!;
            opts.logger.warn("generic_fallback", {
              agent: agent.name,
              from: model,
              to: next,
              kind: e.kind,
            });
            model = next;
            continue;
          }

          opts.logger.error("retry_exhausted", { agent: agent.name, error: e });
          yield { type: "error", error: e, willRetry: false };
          return;
        }
      }
    },
  };
}

function jitter(baseMs: number, rand: () => number): number {
  // Full-jitter (AWS architecture blog): random in [0, base).
  return Math.floor(rand() * baseMs);
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function normalize(err: unknown): AgentError {
  if (err && typeof err === "object" && "kind" in (err as object)) {
    return err as AgentError;
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Best-effort classification from a raw provider error.
  if (/429|rate.?limit/i.test(msg)) {
    return { kind: "rate_limit", provider: "unknown" };
  }
  if (/timeout/i.test(msg)) {
    return { kind: "timeout", phase: "overall" };
  }
  if (/401|403|unauth/i.test(msg)) {
    return { kind: "auth", provider: "unknown" };
  }
  if (/abort|cancel/i.test(msg)) {
    return { kind: "cancelled" };
  }
  if (/5\d\d|gateway|bad gateway|service unavailable/i.test(msg)) {
    return { kind: "transient", httpStatus: 503, provider: "unknown" };
  }
  return { kind: "unknown", raw: err };
}
