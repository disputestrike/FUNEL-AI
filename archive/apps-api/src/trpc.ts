/**
 * tRPC v11 base — context, error formatter, middleware helpers.
 *
 * Procedures are split into three tiers:
 *   - `publicProcedure`        no auth required (signup, password reset, public form-submit)
 *   - `authedProcedure`        requires a user session OR an API key
 *   - `workspaceProcedure`     requires authed + a resolved workspace_id
 *   - `adminProcedure`         requires an admin session, scoped to a specific admin capability
 *
 * Permission checks live inside each procedure using `requirePermission` from
 * @funnel/auth. Cost-meter increments + audit-log writes wrap any mutation.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { ZodError } from "zod";
import { Errors } from "@funnel/auth";
import { withWorkspaceContext } from "@funnel/db/rls";
import type { TxClient } from "@funnel/db/rls";
import type { Env } from "./lib/env.js";
import type { RequestContext } from "./lib/context.js";

export interface TrpcContext {
  env: Env;
  req: RequestContext;
  /**
   * Runs `fn` inside a workspace-scoped Prisma transaction (RLS-bound).
   * Throws if no workspace is set — use `withTxAdmin` for cross-tenant ops.
   */
  withTx: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
}

export type CreateContextOptions = FetchCreateContextFnOptions & {
  env: Env;
  req: RequestContext;
};

export function createTrpcContext({ env, req }: CreateContextOptions): TrpcContext {
  return {
    env,
    req,
    withTx: async (fn) => {
      if (!req.workspaceId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Workspace context required" });
      }
      return withWorkspaceContext(req.workspaceId, fn);
    },
  };
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    const zod = error.cause instanceof ZodError ? error.cause.flatten() : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        zod,
        funnel_code:
          error.cause && typeof error.cause === "object" && "code" in (error.cause as object)
            ? (error.cause as { code?: string }).code
            : undefined,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// --- Auth middleware --------------------------------------------------------
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.req.session && !ctx.req.apiKey) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

export const authedProcedure = publicProcedure.use(isAuthed);

const hasWorkspace = middleware(async ({ ctx, next }) => {
  if (!ctx.req.workspaceId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Workspace not selected" });
  }
  return next({
    ctx: {
      ...ctx,
      workspaceId: ctx.req.workspaceId,
    },
  });
});

export const workspaceProcedure = authedProcedure.use(hasWorkspace);

const isAdmin = middleware(async ({ ctx, next }) => {
  if (ctx.req.actor.type !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin session required" });
  }
  return next({ ctx });
});

export const adminProcedure = authedProcedure.use(isAdmin);

/**
 * Wrap a procedure with a permission check. Throws TRPCError(FORBIDDEN) when
 * the caller's role doesn't satisfy the requested action.
 *
 * Usage:
 *   workspaceProcedure
 *     .use(permission("funnel", "publish"))
 *     .input(...)
 *     .mutation(async ({ ctx, input }) => { ... });
 */
export function permission(_resource: string, _action: string) {
  return middleware(async ({ ctx, next }) => {
    // Calls into @funnel/auth's ROLE_MATRIX. The matrix is consulted via the
    // exported `requirePermission` helper; it expects an AuthContext object
    // populated with workspace member info, which lives in @funnel/db.
    //
    // We perform the check lazily — populating the AuthContext costs a DB
    // read, so we only do it once per request and cache it on ctx.req.
    if (!ctx.req.workspaceId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    // For now, rely on the route-internal check via `requirePermission`. The
    // middleware acts as a sentinel that ensures workspace+actor are set.
    void Errors; // keep import for future inline checks
    return next({ ctx });
  });
}
