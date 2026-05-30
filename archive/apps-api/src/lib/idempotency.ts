/**
 * Idempotency helper.
 *
 * Public-API mutations accept an `Idempotency-Key` header. tRPC procedures
 * compute a deterministic key from `(workspace_id, route, hash(input))` so
 * UI double-clicks don't create double resources.
 *
 * Storage: Cloudflare KV with a 24h TTL — long enough to absorb client
 * retries, short enough to bound storage. Production also writes to the
 * `idempotency_records` Postgres table for cross-region replay protection.
 *
 * Webhooks have their own dedupe in `WEBHOOK_DEDUPE` KV (90d TTL) — they are
 * a stricter case because providers replay aggressively.
 */

import type { KVNamespace } from "@cloudflare/workers-types";

export interface IdempotentResult<T> {
  result: T;
  /** True if served from cache; false if computed fresh. */
  replayed: boolean;
}

export interface IdempotencyOptions {
  ttlSec?: number;
}

const DEFAULT_TTL_SEC = 24 * 60 * 60;

/**
 * Run `compute` exactly once for `key`. Subsequent calls with the same key
 * return the cached value without re-executing.
 *
 * The cache stores JSON-serialized `result`. Throwing inside `compute`
 * does NOT cache — the next call retries.
 */
export async function withIdempotency<T>(
  kv: KVNamespace,
  key: string,
  compute: () => Promise<T>,
  opts: IdempotencyOptions = {},
): Promise<IdempotentResult<T>> {
  const cached = await kv.get(key, "json");
  if (cached !== null) {
    return { result: cached as T, replayed: true };
  }

  const result = await compute();
  await kv.put(key, JSON.stringify(result), { expirationTtl: opts.ttlSec ?? DEFAULT_TTL_SEC });
  return { result, replayed: false };
}

/**
 * Deterministic key for tRPC procedures.
 *
 * Format: `idem:{workspace_id}:{route}:{sha256(input)}`.
 *
 * SHA-256 via Web Crypto (available in Workers). Returned key fits inside
 * KV's 512-byte limit comfortably.
 */
export async function deriveTrpcIdempotencyKey(args: {
  workspaceId: string;
  route: string;
  input: unknown;
}): Promise<string> {
  const body = JSON.stringify(args.input ?? null);
  const buf = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `idem:${args.workspaceId}:${args.route}:${hex}`;
}

/**
 * Convenience helper for webhook dedupe — slightly different semantics: we
 * want a boolean "have we seen this event_id" answer, not a cached result.
 */
export async function webhookSeen(
  kv: KVNamespace,
  provider: string,
  eventId: string,
): Promise<boolean> {
  const key = `wh:${provider}:${eventId}`;
  return (await kv.get(key)) !== null;
}

export async function webhookMark(
  kv: KVNamespace,
  provider: string,
  eventId: string,
  ttlSec = 90 * 24 * 60 * 60,
): Promise<void> {
  const key = `wh:${provider}:${eventId}`;
  await kv.put(key, "1", { expirationTtl: ttlSec });
}
