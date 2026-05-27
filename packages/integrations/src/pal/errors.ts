/**
 * Typed error hierarchy. The retry layer dispatches on subclass —
 * adapters never implement their own retry loops.
 *
 * docs/04-integration-matrix-and-pal.md §A.3
 */

export class ProviderError extends Error {
  public readonly providerKey: string;
  public readonly code: string;
  public readonly httpStatus?: number;
  public readonly raw?: unknown;
  public readonly retryable: boolean;
  public readonly retryAfterSec?: number;

  constructor(
    providerKey: string,
    code: string,
    message: string,
    httpStatus?: number,
    raw?: unknown,
    retryable = false,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ProviderError";
    this.providerKey = providerKey;
    this.code = code;
    this.httpStatus = httpStatus;
    this.raw = raw;
    this.retryable = retryable;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Caller should back off and retry; payload was valid. */
export class TransientError extends ProviderError {
  constructor(
    p: string,
    c: string,
    m: string,
    status?: number,
    raw?: unknown,
    retryAfter?: number,
  ) {
    super(p, c, m, status, raw, true, retryAfter);
    this.name = "TransientError";
  }
}

/** Provider says slow down. Honor retryAfterSec if present. */
export class RateLimitError extends TransientError {
  constructor(p: string, c: string, m: string, retryAfter?: number, raw?: unknown) {
    super(p, c, m, 429, raw, retryAfter);
    this.name = "RateLimitError";
  }
}

/** Auth/refresh failed. Mark connection degraded; do NOT retry the failed write. */
export class AuthError extends ProviderError {
  constructor(p: string, c: string, m: string, status?: number, raw?: unknown) {
    super(p, c, m, status ?? 401, raw, false);
    this.name = "AuthError";
  }
}

/** Resource doesn't exist or was deleted upstream. Don't retry; reconcile. */
export class NotFoundError extends ProviderError {
  constructor(p: string, c: string, m: string, raw?: unknown) {
    super(p, c, m, 404, raw, false);
    this.name = "NotFoundError";
  }
}

/** Payload, policy, or scope is wrong. Don't retry; surface to user. */
export class PermanentError extends ProviderError {
  constructor(p: string, c: string, m: string, status?: number, raw?: unknown) {
    super(p, c, m, status, raw, false);
    this.name = "PermanentError";
  }
}

/** Thrown only as a structural placeholder — every shipped adapter overrides it. */
export class NotImplementedError extends PermanentError {
  constructor(p: string, op: string) {
    super(p, "not_implemented", `Operation ${op} is not supported by adapter ${p}`, 501);
    this.name = "NotImplementedError";
  }
}

/** Webhook signature mismatch. Always logged as a security event by the router. */
export class WebhookVerificationError extends PermanentError {
  constructor(p: string, m = "Webhook signature verification failed") {
    super(p, "webhook_verification_failed", m, 401);
    this.name = "WebhookVerificationError";
  }
}

/**
 * Map an HTTP status code + provider error code to a typed error subclass.
 * Adapters import this so error mapping is consistent across the codebase.
 */
export function classifyHttpError(
  providerKey: string,
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ProviderError {
  const code = (body as { code?: string; error?: { code?: string } } | undefined)?.code
    ?? (body as { error?: { code?: string } } | undefined)?.error?.code
    ?? `http_${status}`;
  const message = (body as { message?: string; error?: { message?: string } } | undefined)?.message
    ?? (body as { error?: { message?: string } } | undefined)?.error?.message
    ?? `HTTP ${status}`;
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

  if (status === 401 || status === 403) return new AuthError(providerKey, code, message, status, body);
  if (status === 404) return new NotFoundError(providerKey, code, message, body);
  if (status === 429) return new RateLimitError(providerKey, code, message, retryAfter, body);
  if (status >= 500 && status < 600) {
    return new TransientError(providerKey, code, message, status, body, retryAfter);
  }
  if (status >= 400 && status < 500) {
    return new PermanentError(providerKey, code, message, status, body);
  }
  return new ProviderError(providerKey, code, message, status, body, false);
}
