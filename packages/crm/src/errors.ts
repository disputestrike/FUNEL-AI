/**
 * Typed CRM errors. Every error carries an http-like `status` so api layers
 * don't have to switch on instanceof checks.
 */

export class CrmError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CrmError";
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends CrmError {
  constructor(entity: string, id: string) {
    super("not_found", `${entity} ${id} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends CrmError {
  constructor(message: string) {
    super("conflict", message, 409);
    this.name = "ConflictError";
  }
}

export class PermissionDeniedError extends CrmError {
  constructor(message: string) {
    super("permission_denied", message, 403);
    this.name = "PermissionDeniedError";
  }
}

export class ValidationError extends CrmError {
  public readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super("validation", message, 422);
    this.name = "ValidationError";
    this.issues = issues;
  }
}
