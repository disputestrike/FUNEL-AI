/**
 * Helpers for WriteOptions — every state-changing adapter call requires an
 * idempotency key. We centralize generation + validation so adapters can't
 * accidentally call create() without one.
 */

import { z } from "zod";
import { ulid } from "ulid";
import { PermanentError } from "./errors.js";
import type { WriteOptions } from "./types.js";

export const WriteOptionsSchema = z.object({
  idempotencyKey: z.string().min(1, "idempotencyKey is required on every write"),
  reviewGated: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  traceId: z.string().optional(),
  workspaceId: z.string().optional(),
});

/** Throws PermanentError if opts is missing required fields. */
export function assertWriteOptions(providerKey: string, opts: unknown): WriteOptions {
  const parsed = WriteOptionsSchema.safeParse(opts);
  if (!parsed.success) {
    throw new PermanentError(
      providerKey,
      "invalid_write_options",
      `WriteOptions invalid: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      400,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

/** Build a deterministic idempotency key from caller context. */
export function buildIdempotencyKey(
  providerKey: string,
  resource: string,
  externalRef: string | undefined,
  nonce: string = ulid(),
): string {
  return [providerKey, resource, externalRef ?? "_", nonce].join(":");
}

/** Random fallback for ad-hoc orchestrator calls. */
export function newIdempotencyKey(): string {
  return `idem_${ulid()}`;
}
