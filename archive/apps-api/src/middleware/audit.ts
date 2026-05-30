/**
 * Auto-audit middleware. Wraps a route in a try/finally that emits an audit
 * log row regardless of outcome. Use sparingly — tRPC procedures already
 * write their own audit rows inside the transaction. This is for REST routes
 * where the audit context isn't naturally established.
 */

import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "../lib/context.js";
import { getRequestContext } from "../lib/context.js";
import { writeAuditLog, type AuditAction, type AuditLogInput } from "../lib/audit.js";

export interface AutoAuditOptions {
  action: AuditAction;
  resource: string;
  /** Extract resource id from the request, if any. */
  resourceIdFn?: (c: Parameters<MiddlewareHandler<HonoEnv>>[0]) => string | undefined;
}

export function autoAudit(opts: AutoAuditOptions): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const ctx = getRequestContext(c);
    let outcome: AuditLogInput["outcome"] = "success";
    try {
      await next();
      if (c.res.status >= 400) outcome = c.res.status === 403 ? "denied" : "failure";
    } catch (err) {
      outcome = "failure";
      throw err;
    } finally {
      // Audit best-effort — never block the response.
      void writeAuditLog(ctx, {
        workspace_id: ctx.workspaceId,
        action: opts.action,
        resource: opts.resource,
        resource_id: opts.resourceIdFn?.(c),
        outcome,
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[audit] failed", e);
      });
    }
  };
}
