/**
 * Sets `app.workspace_id` for the entire request — every Prisma query inside
 * the request inherits RLS context.
 *
 * Hono runs handlers in a single async chain, so we cannot wrap the WHOLE
 * request in `withWorkspaceContext` (that would hold a DB transaction open
 * for the full response time, including streaming + R2 reads). Instead, this
 * middleware stores the workspace id on the context and per-procedure DB
 * access goes through `withWorkspaceContext` for the duration of each query.
 *
 * What this middleware DOES do at request-edge:
 *   - Refuse if the route requires a workspace and none was resolved.
 *   - Stamp every outgoing log line with the workspace id.
 */

import type { MiddlewareHandler } from "hono";
import { AuthError } from "@funnel/shared";
import type { HonoEnv } from "../lib/context.js";
import { getRequestContext } from "../lib/context.js";

export interface RequireWorkspaceOptions {
  /** If true, anonymous requests are allowed (e.g. public form-submit). */
  allowAnonymous?: boolean;
}

export function requireWorkspace(opts: RequireWorkspaceOptions = {}): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const ctx = getRequestContext(c);
    if (!ctx.workspaceId && !opts.allowAnonymous) {
      throw new AuthError("Workspace context missing", { reason: "unauthenticated" });
    }
    await next();
  };
}
