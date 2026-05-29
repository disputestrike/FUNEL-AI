/**
 * Typed error hierarchy.
 *
 * Every domain failure inside GoFunnelAI extends `FunnelError`. Each subclass
 * has a stable `code` string that the API layer maps to an HTTP status. The
 * `details` payload is the structured context — fields that violated a
 * schema, the entity that was missing, etc.
 *
 * In log sinks, errors render as JSON via `toJSON()`. The renderer never
 * leaks `details` to the public; the API layer strips them based on the
 * route's trust level.
 */

export type ErrorDetails = Record<string, unknown>;

export class FunnelError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: ErrorDetails;
  public override readonly cause?: unknown;

  constructor(message: string, opts: { code: string; status?: number; details?: ErrorDetails; cause?: unknown } = { code: "internal_error" }) {
    super(message);
    this.name = new.target.name;
    this.code = opts.code;
    this.status = opts.status ?? 500;
    this.details = opts.details ?? {};
    if (opts.cause !== undefined) {
      this.cause = opts.cause;
      // Node 16.9+: preserve the cause chain.
      (this as { cause?: unknown }).cause = opts.cause;
    }
    // Restore prototype chain after `super` (esp. on older TS targets).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): { name: string; code: string; status: number; message: string; details: ErrorDetails } {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
    };
  }
}

/** Validation failure — bad request shape, regex fail, schema mismatch. */
export class ValidationError extends FunnelError {
  constructor(message: string, details: ErrorDetails = {}, cause?: unknown) {
    super(message, { code: "validation_error", status: 400, details, cause });
  }
}

/** Entity not found. */
export class NotFoundError extends FunnelError {
  constructor(message: string, details: ErrorDetails = {}, cause?: unknown) {
    super(message, { code: "not_found", status: 404, details, cause });
  }
}

/** Authentication/authorization failure. */
export class AuthError extends FunnelError {
  constructor(message: string, opts: { reason?: "unauthenticated" | "forbidden" | "mfa_required"; details?: ErrorDetails; cause?: unknown } = {}) {
    const status = opts.reason === "forbidden" ? 403 : 401;
    super(message, {
      code: `auth.${opts.reason ?? "unauthenticated"}`,
      status,
      details: opts.details ?? {},
      cause: opts.cause,
    });
  }
}

/** Billing-domain failure — declined card, ineligible upgrade, suspended account. */
export class BillingError extends FunnelError {
  constructor(message: string, opts: { code?: string; status?: number; details?: ErrorDetails; cause?: unknown } = {}) {
    super(message, {
      code: opts.code ?? "billing.error",
      status: opts.status ?? 402,
      details: opts.details ?? {},
      cause: opts.cause,
    });
  }
}

/** Compliance/Trust-and-Safety failure — blocked publish, claim flag, attestation missing. */
export class ComplianceError extends FunnelError {
  constructor(message: string, opts: { code?: string; details?: ErrorDetails; cause?: unknown } = {}) {
    super(message, {
      code: opts.code ?? "compliance.blocked",
      status: 422,
      details: opts.details ?? {},
      cause: opts.cause,
    });
  }
}

/** Rate-limit hit. */
export class RateLimitError extends FunnelError {
  public readonly retryAfterSec: number;

  constructor(message: string, opts: { retryAfterSec: number; details?: ErrorDetails; cause?: unknown }) {
    super(message, {
      code: "rate_limited",
      status: 429,
      details: { retry_after_sec: opts.retryAfterSec, ...(opts.details ?? {}) },
      cause: opts.cause,
    });
    this.retryAfterSec = opts.retryAfterSec;
  }
}

/** External-service unavailable (Stripe, SignalWire, Anthropic). */
export class UpstreamError extends FunnelError {
  constructor(message: string, opts: { upstream: string; details?: ErrorDetails; cause?: unknown }) {
    super(message, {
      code: `upstream.${opts.upstream}`,
      status: 502,
      details: opts.details ?? {},
      cause: opts.cause,
    });
  }
}

/** Conflict — version mismatch, duplicate slug, idempotency replay. */
export class ConflictError extends FunnelError {
  constructor(message: string, details: ErrorDetails = {}, cause?: unknown) {
    super(message, { code: "conflict", status: 409, details, cause });
  }
}

/** Type-guard helper for catch blocks. */
export function isFunnelError(e: unknown): e is FunnelError {
  return e instanceof FunnelError;
}
