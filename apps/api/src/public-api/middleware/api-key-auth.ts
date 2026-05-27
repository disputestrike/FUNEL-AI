/**
 * API-key authentication for /v1.
 *
 * Reads `Authorization: Bearer <key>`, hashes it (sha256), looks up the
 * matching row in `api_keys`, and stamps the workspace context onto the
 * Hono request. The raw key is never logged or stored.
 *
 * Key format: `fnl_<env>_<rand>` (32+ chars of base62). The prefix lets us
 * route keys by environment (live / test) without a DB hit.
 */

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { db, eq, and, isNull } from "@funnel/db";
import { apiKeys } from "@funnel/db/schema";
import type { HonoEnv } from "../../lib/context.js";
import type { ApiKeyPrincipal, PlanTier } from "../lib/types.js";

const ENC = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", ENC.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ApiKeyAuthOptions {
  /** Required scopes — request rejected with 403 if any are missing. */
  scopes?: string[];
}

export const apiKeyAuth = (opts: ApiKeyAuthOptions = {}): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const match = header.match(/^Bearer\s+(fnl_(live|test)_[A-Za-z0-9]{24,})$/);
    if (!match) {
      throw new HTTPException(401, {
        message: "Missing or malformed Authorization header. Expected: Bearer fnl_live_…",
      });
    }
    const raw = match[1]!;
    const keyHash = await sha256Hex(raw);

    const row = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
      with: { workspace: { columns: { id: true, plan: true } } },
    });

    if (!row) {
      throw new HTTPException(401, { message: "Invalid API key." });
    }

    if (opts.scopes?.length) {
      const granted = new Set(row.scopes ?? []);
      const missing = opts.scopes.filter((s) => !granted.has(s) && !granted.has("*"));
      if (missing.length) {
        throw new HTTPException(403, {
          message: `Missing required scope(s): ${missing.join(", ")}`,
        });
      }
    }

    const principal: ApiKeyPrincipal = {
      api_key_id: row.id,
      workspace_id: row.workspaceId,
      key_hash: keyHash,
      scopes: row.scopes ?? [],
      plan: (row.workspace?.plan ?? "free") as PlanTier,
      rate_limit_override: row.rateLimitOverride ?? undefined,
      created_at: row.createdAt.toISOString(),
    };

    c.set("apiKey", principal);
    // Reuse the existing workspace-context contract used by tRPC handlers.
    c.set("workspaceId", principal.workspace_id);

    // Fire-and-forget — update last_used_at without blocking the request.
    c.executionCtx.waitUntil(
      db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, row.id))
        .catch(() => {}),
    );

    await next();
  };
};
