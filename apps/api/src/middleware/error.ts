/**
 * Error mapping + request-id stamping.
 *
 * Translates thrown errors into stable HTTP responses:
 *   - ZodError                  → 400 validation_error
 *   - AuthError (unauth)        → 401 auth.unauthenticated
 *   - AuthError (forbidden)     → 403 auth.forbidden
 *   - NotFoundError             → 404 not_found
 *   - RateLimitError            → 429 rate_limited
 *   - BillingError              → 402 billing.*
 *   - FunnelError (other)       → 400-599 per `status`
 *   - default                   → 500 internal_error
 *
 * Every response carries `X-Request-Id` so support can correlate user reports
 * back to logs. Sentry capture is best-effort and bound to ctx.requestId.
 */

import type { MiddlewareHandler } from "hono";
import { ulid } from "ulid";
import { ZodError } from "zod";
import { AuthError, FunnelError, NotFoundError, ValidationError, BillingError } from "@funnel/shared";
import type { HonoEnv } from "../lib/context.js";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: Record<string, unknown>;
  };
}

function pickStatus(err: unknown): { status: number; code: string; message: string; details?: Record<string, unknown> } {
  if (err instanceof ZodError) {
    return {
      status: 400,
      code: "validation_error",
      message: "Request body failed validation",
      details: { issues: err.issues },
    };
  }
  if (err instanceof ValidationError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof AuthError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, code: "not_found", message: err.message, details: err.details };
  }
  if (err instanceof BillingError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof FunnelError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    const e = err as { status: number; message?: string; code?: string };
    return { status: e.status, code: e.code ?? "error", message: e.message ?? "Error" };
  }
  return {
    status: 500,
    code: "internal_error",
    message: "Internal server error",
  };
}

export const errorMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const requestId = c.req.header("cf-ray") ?? `req_${ulid()}`;
  c.header("X-Request-Id", requestId);

  try {
    await next();
  } catch (err) {
    const mapped = pickStatus(err);
    const body: ApiErrorBody = {
      error: {
        code: mapped.code,
        message: mapped.message,
        request_id: requestId,
        ...(mapped.details ? { details: mapped.details } : {}),
      },
    };

    // Sentry capture (best effort; the binding is created in src/index.ts).
    const sentry = (c.env as { __sentry?: { captureException: (e: unknown, ctx?: unknown) => void } })
      .__sentry;
    sentry?.captureException(err, {
      tags: { request_id: requestId, route: c.req.path, method: c.req.method },
    });

    // 5xx logs at error; 4xx logs at info to keep noise low.
    if (mapped.status >= 500) {
      // eslint-disable-next-line no-console
      console.error("[api] 5xx", { requestId, path: c.req.path, err });
    } else {
      // eslint-disable-next-line no-console
      console.info("[api] 4xx", { requestId, path: c.req.path, code: mapped.code });
    }

    return c.json(body, mapped.status as 400);
  }
};
