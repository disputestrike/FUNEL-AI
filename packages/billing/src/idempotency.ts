/**
 * Idempotency middleware for billing mutations.
 *
 * Every charge, refund, subscription create, plan change, and pause/resume
 * must run through `withIdempotency()` so retried requests fold to a single
 * side effect.
 *
 * Key derivation: callers either pass an explicit key (e.g. from the HTTP
 * `Idempotency-Key` header) or use `deriveKey()` to hash the canonical
 * request body. The store enforces uniqueness — second call with same key
 * returns the cached response hash without re-executing.
 *
 * Doc 12 PRD 4 §3 edge 17 & §9 acceptance criteria 2.
 */

import { createHash, randomUUID } from "node:crypto";

import { BillingError } from "./types.js";
import { getBillingStore } from "./store.js";

const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyOptions {
  /** Unique per-request key supplied by the caller. */
  key: string;
  /** Logical scope, e.g. `billing.upgrade`, `billing.refund`. */
  scope: string;
  /** Optional workspace owner for indexing. */
  workspace_id?: string | null;
  /** TTL in hours — defaults to 24h. */
  ttl_hours?: number;
}

/** Build an idempotency key from a logical scope + canonical args. */
export function deriveKey(scope: string, args: unknown): string {
  const json = stableStringify(args);
  const hash = createHash("sha256").update(`${scope}:${json}`).digest("hex");
  return `idem_${hash.slice(0, 32)}`;
}

/** Random key for clients that lack a stable input (e.g. webhook re-keys). */
export function randomIdempotencyKey(scope: string): string {
  return `${scope.replace(/\./g, "_")}_${randomUUID()}`;
}

/**
 * Run `fn()` exactly once for the given idempotency key. Subsequent calls
 * with the same key return `{ cached: true, response_hash }` so callers can
 * fetch the original response from their own cache layer if desired.
 *
 * NB: This implementation guarantees at-most-once *initiation*. Callers who
 * need the same exact response body returned must cache the response under
 * the key on first run; we surface only the response hash.
 */
export async function withIdempotency<T>(
  opts: IdempotencyOptions,
  fn: () => Promise<T>,
): Promise<{ result: T | null; cached: boolean; response_hash: string | null }> {
  const store = getBillingStore();
  const ttl = opts.ttl_hours ?? DEFAULT_TTL_HOURS;
  const expires_at = new Date(Date.now() + ttl * 60 * 60 * 1000);

  const reservation = await store.reserveIdempotencyKey({
    key: opts.key,
    scope: opts.scope,
    workspace_id: opts.workspace_id ?? null,
    response_hash: null,
    expires_at,
  });

  if (!reservation.created) {
    return {
      result: null,
      cached: true,
      response_hash: reservation.existing_response_hash ?? null,
    };
  }

  try {
    const result = await fn();
    const response_hash = createHash("sha256")
      .update(stableStringify(result))
      .digest("hex");
    await store.setIdempotencyResponse(opts.key, response_hash);
    return { result, cached: false, response_hash };
  } catch (err) {
    // On failure we *don't* mark the key — the same retry should be allowed
    // to try again. The reservation row remains but with null response_hash.
    // We surface the underlying error so callers can act.
    if (err instanceof BillingError) throw err;
    if (err instanceof Error) {
      throw new BillingError(err.message, "idempotency.fn_failed", 500, {
        cause: err.name,
      });
    }
    throw new BillingError("Idempotent function failed", "idempotency.fn_failed", 500);
  }
}

/** Stable stringify so deriveKey() is deterministic across machines. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(",")}}`;
}
