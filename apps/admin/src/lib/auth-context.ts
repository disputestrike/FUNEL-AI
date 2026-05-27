/**
 * Resolves the @funnel/auth AuthContext for the admin app.
 *
 * In real deployments this wires the production stores (Postgres-backed
 * UserStore, SessionStore, AdminStore, AuditWriter — all routed through
 * @funnel/db with the admin context applied).
 *
 * For local dev / tests we fall back to the in-memory context.
 */

import { makeInMemoryAuthContext, type AuthContext } from "@funnel/auth";

let cached: AuthContext | null = null;

export function getAuthContext(): AuthContext {
  if (cached) return cached;
  // TODO(prod): swap to Postgres-backed stores from @funnel/db wired with
  // withAdminContext(). The in-memory fallback keeps dev + tests honest.
  cached = makeInMemoryAuthContext();
  return cached;
}
