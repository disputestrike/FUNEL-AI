/**
 * Shared types for the public REST API.
 *
 * Imported by routes, middleware, and the OpenAPI generator. Keeps the
 * public surface decoupled from the internal tRPC context.
 */

import { z } from "zod";

/** Plan tiers — drive per-key rate-limit ceilings and feature gating. */
export const PlanTier = z.enum(["free", "starter", "growth", "scale", "agency"]);
export type PlanTier = z.infer<typeof PlanTier>;

/** Rate limits, requests per hour, per API key. */
export const RATE_LIMITS_PER_HOUR: Record<PlanTier, number> = {
  free: 100,
  starter: 500,
  growth: 5_000,
  scale: 50_000,
  agency: 250_000,
};

/** Resolved API-key principal placed on the request context by api-key-auth. */
export interface ApiKeyPrincipal {
  api_key_id: string;
  workspace_id: string;
  /** sha256 hex of the raw key — never the raw key itself. */
  key_hash: string;
  /** Subset of scopes granted to this key (RBAC). */
  scopes: string[];
  /** Plan that owns this key — drives the rate-limit binding. */
  plan: PlanTier;
  /** Optional override (e.g. enterprise custom limit). */
  rate_limit_override?: number;
  created_at: string;
}

/** Standard pagination envelope. */
export const PaginationQuery = z.object({
  cursor: z.string().optional().describe("Opaque cursor returned by a previous page."),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  });

/** Standard error envelope (mirrors Stripe). */
export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    type: z.enum([
      "invalid_request",
      "authentication",
      "permission",
      "not_found",
      "conflict",
      "rate_limited",
      "server_error",
    ]),
    request_id: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
