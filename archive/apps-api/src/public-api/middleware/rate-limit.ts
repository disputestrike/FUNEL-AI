/**
 * Per-API-key rate limiting for /v1.
 *
 * Looks up the plan ceiling on the resolved ApiKeyPrincipal, then defers to
 * the Cloudflare rate-limit binding (RL_PUBLIC_API). Always writes the
 * X-RateLimit-* response headers so SDKs can self-throttle without polling.
 */

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../../lib/context.js";
import { RATE_LIMITS_PER_HOUR } from "../lib/types.js";

const WINDOW_SEC = 3600;

export const publicApiRateLimit = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const principal = c.get("apiKey");
    if (!principal) {
      // Auth middleware should run first; refuse to fail open.
      throw new HTTPException(401, { message: "Unauthenticated." });
    }

    const limit = principal.rate_limit_override ?? RATE_LIMITS_PER_HOUR[principal.plan];
    const key = `pubapi:${principal.api_key_id}`;

    const result = await c.env.RL_PUBLIC_API.limit({ key });
    const now = Math.floor(Date.now() / 1000);
    const reset = now + WINDOW_SEC;

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - (result.consumed ?? 1))));
    c.header("X-RateLimit-Reset", String(reset));
    c.header("X-RateLimit-Policy", `${limit};w=${WINDOW_SEC}`);

    if (!result.success) {
      c.header("Retry-After", String(WINDOW_SEC));
      throw new HTTPException(429, { message: "Rate limit exceeded." });
    }

    await next();
  };
};
