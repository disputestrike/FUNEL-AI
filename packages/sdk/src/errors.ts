/**
 * Typed error hierarchy for the Funnel SDK.
 *
 * All thrown errors descend from FunnelAPIError so user code can do a
 * single `instanceof` check at the top of a try/catch. Specific subtypes
 * (RateLimitError, AuthError, …) carry the extra fields needed to recover
 * gracefully (retry-after, missing scopes, etc).
 */

export interface FunnelErrorPayload {
  code: string;
  message: string;
  type: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

export class FunnelAPIError extends Error {
  readonly code: string;
  readonly type: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;
  readonly rawBody?: unknown;

  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(payload.message);
    this.name = "FunnelAPIError";
    this.code = payload.code;
    this.type = payload.type;
    this.status = status;
    this.requestId = payload.request_id;
    this.details = payload.details;
    this.rawBody = rawBody;
  }
}

export class AuthError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "AuthError";
  }
}

export class PermissionError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "PermissionError";
  }
}

export class NotFoundError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "ConflictError";
  }
}

export class ValidationError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends FunnelAPIError {
  readonly retryAfterSec: number;
  constructor(status: number, payload: FunnelErrorPayload, retryAfterSec: number, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class ServerError extends FunnelAPIError {
  constructor(status: number, payload: FunnelErrorPayload, rawBody?: unknown) {
    super(status, payload, rawBody);
    this.name = "ServerError";
  }
}

export function classifyError(
  status: number,
  body: unknown,
  retryAfter?: number,
): FunnelAPIError {
  const payload: FunnelErrorPayload =
    body && typeof body === "object" && "error" in body
      ? (body as { error: FunnelErrorPayload }).error
      : {
          code: "unknown",
          type: "server_error",
          message: typeof body === "string" ? body : `HTTP ${status}`,
        };

  switch (status) {
    case 400:
      return new ValidationError(status, payload, body);
    case 401:
      return new AuthError(status, payload, body);
    case 403:
      return new PermissionError(status, payload, body);
    case 404:
      return new NotFoundError(status, payload, body);
    case 409:
      return new ConflictError(status, payload, body);
    case 429:
      return new RateLimitError(status, payload, retryAfter ?? 60, body);
    default:
      if (status >= 500) return new ServerError(status, payload, body);
      return new FunnelAPIError(status, payload, body);
  }
}
