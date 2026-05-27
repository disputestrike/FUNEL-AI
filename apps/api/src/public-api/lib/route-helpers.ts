/**
 * Tiny wrappers around @hono/zod-openapi's createRoute() to cut boilerplate.
 *
 * Every public-API route declares request/response shapes once — this helper
 * stamps the shared error responses, security scheme, and pagination headers
 * so the per-route file only declares what's unique.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { ErrorResponse } from "./types.js";

const SHARED_ERRORS = {
  400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Unauthenticated", content: { "application/json": { schema: ErrorResponse } } },
  403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  409: { description: "Conflict", content: { "application/json": { schema: ErrorResponse } } },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorResponse } } },
  500: { description: "Server error", content: { "application/json": { schema: ErrorResponse } } },
} as const;

type CreateRouteArgs = Parameters<typeof createRoute>[0];

export const route = (args: CreateRouteArgs) =>
  createRoute({
    ...args,
    security: [{ bearerAuth: [] }],
    responses: {
      ...SHARED_ERRORS,
      ...args.responses,
    },
  });

export const jsonBody = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { "application/json": { schema } },
  required: true,
});

export const jsonResponse = <S extends z.ZodTypeAny>(description: string, schema: S) => ({
  description,
  content: { "application/json": { schema } },
});

export const idParam = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) });
