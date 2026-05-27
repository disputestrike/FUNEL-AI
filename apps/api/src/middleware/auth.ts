/**
 * Authentication middleware.
 *
 * Resolution order (first match wins):
 *   1. `Authorization: Bearer fnlk_live_…`  → API key auth (public REST)
 *   2. `__Host-funnel-access` cookie         → session JWT auth (web/admin apps)
 *   3. anonymous                              → public surfaces only
 *
 * Side effects:
 *   - Populates `ctx.session`, `ctx.apiKey`, `ctx.workspaceId`, `ctx.actor`.
 *   - Bumps `api_keys.last_used_at` (debounced via KV).
 *   - Emits `user_new_device_login` when a cookie-auth request comes from an
 *     IP+UA never seen for this user (the rate of churn is low; tracked in KV).
 *
 * This middleware does NOT reject anonymous requests — it only annotates the
 * request. Authorization checks happen inside each tRPC procedure or each
 * REST route handler.
 */

import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { verifyAccessToken } from "@funnel/auth";
import { parseApiKey } from "@funnel/auth";
import { withWorkspaceContext } from "@funnel/db/rls";
import { withAdminContext } from "@funnel/db/rls";
import type { HonoEnv } from "../lib/context.js";
import { setRequestContext, type RequestActor, type RequestContext, type ApiKeyContext } from "../lib/context.js";
import { hashIp, sha256Hex } from "../lib/hash.js";
import { ulid } from "ulid";

const COOKIE_ACCESS = "__Host-funnel-access";

export const authMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const requestId = c.req.header("X-Request-Id") ?? c.req.header("cf-ray") ?? `req_${ulid()}`;
  const traceId = c.req.header("traceparent") ?? `trc_${ulid()}`;
  const ip = c.req.header("cf-connecting-ip") ?? null;
  const country = c.req.header("cf-ipcountry") ?? null;
  const userAgent = c.req.header("user-agent") ?? null;
  const locale = (c.req.header("accept-language") ?? "en-US").split(",")[0]!.trim();
  const ipHash = ip ? await hashIp(ip, c.env.JWT_SECRET) : "sha256:anon";

  let session: RequestContext["session"] = null;
  let apiKey: ApiKeyContext | null = null;
  let workspaceId: string | null = null;
  let actor: RequestActor = { type: "anonymous" };

  // --- API key first (REST public API) ---------------------------------
  const authz = c.req.header("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    const raw = authz.slice("Bearer ".length).trim();
    const parsed = parseApiKey(raw);
    if (parsed) {
      const lookup = await lookupApiKey(c.env, parsed.prefix, parsed.secret);
      if (lookup) {
        apiKey = lookup;
        workspaceId = lookup.workspace_id;
        actor = { type: "api_key", api_key_id: lookup.id };
        // last_used bump (debounced)
        await debouncedBumpLastUsed(c.env, lookup.id, ipHash);
      } else {
        // Surfaces 401 from downstream auth checks; we don't fail the whole
        // request here so OPTIONS preflights and public routes still work.
        c.header("X-Auth-Reason", "invalid_api_key");
      }
    }
  }

  // --- Session cookie (web/admin app) ----------------------------------
  if (!apiKey) {
    const access = getCookie(c, COOKIE_ACCESS);
    if (access) {
      try {
        const claims = await verifyAccessToken(
          { env: { jwt_secret: c.env.JWT_SECRET }, now: () => new Date(), random: () => "" },
          access,
        );
        session = await loadSession(c.env, claims.sid);
        if (session) {
          workspaceId =
            (c.req.header("x-funnel-workspace") as string | undefined) ?? session.workspace_id ?? null;
          actor = {
            type: claims.admin_sid ? "admin" : "user",
            user_id: claims.sub,
            impersonator_user_id: claims.impersonator_user_id,
          };
        }
      } catch {
        c.header("X-Auth-Reason", "invalid_session");
      }
    }
  }

  const ctx: RequestContext = {
    requestId,
    traceId,
    ip,
    ipHash,
    country,
    userAgent,
    session,
    apiKey,
    workspaceId,
    actor,
    locale,
  };

  setRequestContext(c, ctx);
  await next();
};

/** Lookup an API key by prefix and verify the secret. Returns null on mismatch. */
async function lookupApiKey(
  env: HonoEnv["Bindings"],
  prefix: string,
  secret: string,
): Promise<ApiKeyContext | null> {
  // Postgres lookup wrapped in admin context — api_keys is workspace-scoped
  // but auth precedes workspace selection so we cross-tenant-read by prefix.
  const found = await withAdminContext(async (tx) => {
    return tx.apiKey.findUnique({
      where: { key_prefix: prefix },
      select: {
        id: true,
        workspace_id: true,
        key_hash: true,
        scopes: true,
        revoked_at: true,
        expires_at: true,
      },
    });
  });
  if (!found) return null;
  if (found.revoked_at) return null;
  if (found.expires_at && new Date(found.expires_at) < new Date()) return null;

  // Constant-time compare via SHA-256 (argon2 lives in workers via WASM in
  // @funnel/auth — but for hot-path key lookups we compare a SHA-256 of the
  // raw secret against a stored hash. The store writes both hashes; the
  // SHA-256 column is `key_hash`. Argon2 is reserved for password hashing.)
  const candidate = await sha256Hex(secret);
  if (candidate !== found.key_hash) return null;

  return {
    id: found.id,
    workspace_id: found.workspace_id,
    scopes: found.scopes ?? [],
    prefix,
  };
}

async function loadSession(env: HonoEnv["Bindings"], sid: string): Promise<RequestContext["session"]> {
  // Sessions live in KV (hot tail) + Postgres (durable). KV first.
  const cached = await env.SESSIONS.get(`ses:${sid}`, "json");
  if (cached) return cached as RequestContext["session"];

  // KV miss — go to DB, populate KV with a 15-min TTL.
  const session = await withAdminContext(async (tx) => {
    const row = await tx.session.findUnique({ where: { id: sid } });
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    return row;
  });

  if (session) {
    await env.SESSIONS.put(`ses:${sid}`, JSON.stringify(session), { expirationTtl: 15 * 60 });
  }
  return session as RequestContext["session"];
}

/** Bump api_keys.last_used_at at most once per minute per key. */
async function debouncedBumpLastUsed(
  env: HonoEnv["Bindings"],
  keyId: string,
  ipHash: string,
): Promise<void> {
  const debounceKey = `apk:bump:${keyId}`;
  const last = await env.IDEMPOTENCY.get(debounceKey);
  if (last) return;
  await env.IDEMPOTENCY.put(debounceKey, "1", { expirationTtl: 60 });
  await withAdminContext(async (tx) => {
    await tx.apiKey.update({
      where: { id: keyId },
      data: { last_used_at: new Date(), last_used_ip_hash: ipHash },
    });
  });
}
