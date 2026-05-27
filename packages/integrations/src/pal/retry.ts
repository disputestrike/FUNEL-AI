/**
 * The one retry helper every adapter routes writes through.
 * Implements docs/04-integration-matrix-and-pal.md §A.4.
 */

import {
  AuthError,
  NotFoundError,
  PermanentError,
  ProviderError,
  RateLimitError,
  TransientError,
} from "./errors.js";

export interface RetryOptions {
  /** Logical operation name for logs/spans. */
  op: string;
  providerKey: string;
  /** Max attempts including the first. Defaults per error class — see policy. */
  maxAttempts?: number;
  /** Base delay in ms. */
  baseMs?: number;
  /** Cap on a single backoff in ms. */
  capMs?: number;
  /** 0..1 jitter ratio. Default 0.25 (+/- 25%). */
  jitter?: number;
  /** Hook called before each retry. Useful for metrics/Sentry breadcrumbs. */
  onRetry?: (attempt: number, err: ProviderError, delayMs: number) => void;
  /** Hook called once on terminal failure (after retries exhausted). */
  onDeadLetter?: (err: ProviderError) => void | Promise<void>;
  /**
   * One-shot auth refresh callback. If AuthError fires we call this exactly
   * once; if it returns true we retry the operation, otherwise we surface the
   * AuthError and let the connection get marked degraded.
   */
  refreshAuth?: () => Promise<boolean>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function computeDelay(
  err: ProviderError,
  attempt: number,
  opts: Required<Pick<RetryOptions, "baseMs" | "capMs" | "jitter">>,
): number {
  if (err instanceof RateLimitError && err.retryAfterSec) {
    return Math.min(err.retryAfterSec * 1000, opts.capMs);
  }
  const exp = opts.baseMs * Math.pow(2, attempt);
  const jitterFactor = 1 + (Math.random() * 2 - 1) * opts.jitter;
  return Math.min(exp * jitterFactor, opts.capMs);
}

/**
 * Wrap an async provider call with the canonical PAL retry policy.
 *
 * Defaults:
 *   RateLimitError       → 6 attempts, base 1000ms, cap 60s, honor Retry-After
 *   TransientError       → 5 attempts, base 500ms,  cap 30s
 *   AuthError            → 1 refresh attempt, then fail-fast
 *   NotFoundError        → no retry, surface for reconciliation
 *   PermanentError       → no retry, DLQ
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const baseMs = opts.baseMs ?? 500;
  const capMs = opts.capMs ?? 30_000;
  const jitter = opts.jitter ?? 0.25;
  const maxAttempts = opts.maxAttempts ?? 5;

  let authRefreshed = false;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const pe = err instanceof ProviderError
        ? err
        : new TransientError(
            opts.providerKey,
            "unknown",
            err instanceof Error ? err.message : String(err),
          );

      if (pe instanceof AuthError) {
        if (!authRefreshed && opts.refreshAuth) {
          authRefreshed = true;
          const refreshed = await opts.refreshAuth().catch(() => false);
          if (refreshed) continue;
        }
        // Connection should be marked degraded by the caller.
        throw pe;
      }

      if (pe instanceof NotFoundError || pe instanceof PermanentError) {
        if (opts.onDeadLetter && pe instanceof PermanentError) {
          await opts.onDeadLetter(pe);
        }
        throw pe;
      }

      // Transient family.
      const limit = pe instanceof RateLimitError ? Math.max(maxAttempts, 6) : maxAttempts;
      const effectiveCap = pe instanceof RateLimitError ? Math.max(capMs, 60_000) : capMs;
      attempt += 1;
      if (attempt >= limit) {
        if (opts.onDeadLetter) await opts.onDeadLetter(pe);
        throw pe;
      }
      const delay = computeDelay(pe, attempt, { baseMs, capMs: effectiveCap, jitter });
      if (opts.onRetry) opts.onRetry(attempt, pe, delay);
      await sleep(delay);
    }
  }
}
