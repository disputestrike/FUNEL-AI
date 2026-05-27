/**
 * Shared Zod primitives mirroring our Postgres conventions.
 *
 * - IDs are `<prefix>_<26 char ULID>` — see src/ids.ts.
 * - Money is BIGINT minor units (cents). Zod can't carry `bigint` literals
 *   through JSON, so we accept `bigint | number | string` and coerce.
 * - Timestamps are ISO strings on the wire, Date in-process.
 */
import { z } from "zod";

export const ID_REGEX = /^[a-z]{2,5}_[0-9A-HJKMNP-TV-Z]{26}$/i;

export const id = (entity?: string) =>
  z
    .string()
    .regex(ID_REGEX, `expected ULID-prefixed id${entity ? ` for ${entity}` : ""}`);

export const ulidOnly = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i);

export const isoDateTime = z
  .union([z.string().datetime({ offset: true }), z.date()])
  .transform((v) => (typeof v === "string" ? new Date(v) : v));

export const isoDateTimeNullable = isoDateTime.nullable().optional();

export const moneyMicros = z
  .union([z.bigint(), z.number().int(), z.string().regex(/^-?\d+$/)])
  .transform((v) => BigInt(v));

export const currencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "expected ISO-4217 currency code");

export const piiTier = z.enum(["P0", "P1", "P2", "P3"]);

export const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(jsonValue),
  ])
);

export const jsonObject = z.record(jsonValue);
export const jsonArray = z.array(jsonValue);

export const sha256Hex = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected 64-char hex sha256");

export const tags = z.array(z.string().min(1).max(64)).max(100).default([]);
