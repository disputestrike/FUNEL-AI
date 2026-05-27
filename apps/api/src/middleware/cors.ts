/**
 * CORS lockdown.
 *
 * We never use `Access-Control-Allow-Origin: *`. The allowlist is built from:
 *   1. `env.ALLOWED_ORIGINS` (comma-separated) â€” fixed GoFunnelAI surfaces.
 *   2. Workspace custom domains â€” looked up by Origin host when present.
 *
 * Webhook endpoints under `/webhooks` and OAuth callbacks under `/oauth`
 * intentionally have NO CORS (they are server-to-server only).
 */

import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../lib/context.js";

function parseAllowed(env: { ALLOWED_ORIGINS: string }): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Build the CORS middleware. Returns a Hono middleware tied to this Worker's env. */
export function buildCors(): MiddlewareHandler<HonoEnv> {
  return cors({
    origin: (origin, c) => {
      if (!origin) return null;
      const env = (c as unknown as { env: { ALLOWED_ORIGINS: string } }).env;
      const allowed = new Set(parseAllowed(env));
      if (allowed.has(origin)) return origin;
      // Workspace custom domains: production wires a lookup against
      // `custom_domains` table. The stub returns null (denied) â€” strict by
      // default. Once the lookup is implemented, swap in `lookupCustomDomain`.
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "X-CSRF-Token",
      "X-Requested-With",
      "Idempotency-Key",
      "X-Funnel-Workspace",
      "Last-Event-ID",
    ],
    exposeHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: true,
    maxAge: 600,
  });
}
