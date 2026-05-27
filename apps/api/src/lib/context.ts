/**
 * Request context shared between Hono middleware and tRPC procedures.
 *
 * Every request flows through `middleware/auth.ts` which attaches:
 *   - `session`        present for cookie-authenticated requests
 *   - `apiKey`         present for `Authorization: Bearer fnlk_live_…` requests
 *   - `workspaceId`    resolved from either session.wsid or apiKey.workspace_id
 *   - `actor`          identifies the human or service driving the call
 *
 * Procedures consume context via `ctx.workspaceId`, never reading raw cookies.
 */

import type { Context } from "hono";
import type { Session } from "@funnel/auth";
import type { Env } from "./env.js";

export type ActorType = "user" | "agent" | "system" | "admin" | "anonymous" | "api_key";

export interface RequestActor {
  type: ActorType;
  user_id?: string;
  agent_id?: string;
  api_key_id?: string;
  /** Set when a Funnel admin is impersonating a customer. */
  impersonator_user_id?: string;
  /** Admin role at the time of request. */
  admin_role?: string;
}

export interface ApiKeyContext {
  id: string;
  workspace_id: string;
  scopes: ReadonlyArray<string>;
  prefix: string;
}

export interface RequestContext {
  /** Globally unique request id — set in `error.ts` middleware. */
  requestId: string;
  /** Distributed-trace id (W3C traceparent or generated). */
  traceId: string;
  /** Cloudflare-derived IP + country. */
  ip: string | null;
  ipHash: string;
  country: string | null;
  userAgent: string | null;
  /** Logged-in session, if any. */
  session: Session | null;
  /** API key auth, if any. */
  apiKey: ApiKeyContext | null;
  /** Workspace the request is operating on. Required for any workspace-scoped op. */
  workspaceId: string | null;
  /** Who is driving the request. */
  actor: RequestActor;
  /** Locale negotiated from Accept-Language. */
  locale: string;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    ctx: RequestContext;
  };
};

export type HonoCtx = Context<HonoEnv>;

export function setRequestContext(c: HonoCtx, ctx: RequestContext): void {
  c.set("ctx", ctx);
}

export function getRequestContext(c: HonoCtx): RequestContext {
  const ctx = c.get("ctx");
  if (!ctx) throw new Error("RequestContext not initialized — auth middleware did not run");
  return ctx;
}
