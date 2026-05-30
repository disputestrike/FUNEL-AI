/**
 * Idempotency for `POST /v1/generations` (Doc 19 §A.5).
 *
 * The orchestrator derives a *content* hash from (workspaceId, userId,
 * businessProfile, options) and treats it as the de-facto idempotency key
 * when the caller didn't supply one. Duplicate calls return the existing
 * generation's SSE stream instead of starting a new run.
 *
 * Hashing is intentionally synchronous + dependency-free (no Web Crypto)
 * so this module works in Workers, Node, and tests with no setup.
 */

import type { GenerationInput } from "./types.js";

/** Stable, key-sorted JSON stringify. Avoids hash drift from key ordering. */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        JSON.stringify(k) + ":" + canonicalStringify((value as Record<string, unknown>)[k]),
    );
  return "{" + entries.join(",") + "}";
}

/**
 * FNV-1a 64-bit, then hex. Not cryptographic — but we don't need that here;
 * the hash is a dedupe key, not a security boundary. Collisions across
 * workspaces would still be scoped by `(workspaceId, hash)`.
 */
export function stableHash(input: string): string {
  let h = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = (BigInt(1) << BigInt(64)) - BigInt(1);
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

export function inputHash(input: GenerationInput): string {
  const seed = canonicalStringify({
    w: input.workspaceId,
    u: input.userId,
    bp: input.businessProfile,
    lang: input.language,
    geo: input.geography,
    opts: input.options ?? {},
  });
  return stableHash(seed);
}

export function effectiveIdempotencyKey(input: GenerationInput): string {
  if (input.idempotencyKey && input.idempotencyKey.length > 0) {
    return input.idempotencyKey;
  }
  return `auto:${input.workspaceId}:${inputHash(input)}`;
}

/** Generation IDs — short ULID-ish prefix + the input hash for traceability. */
export function generationId(input: GenerationInput, nowMs: number): string {
  const t = nowMs.toString(36);
  const h = inputHash(input).slice(0, 12);
  return `gen_${t}_${h}`;
}
