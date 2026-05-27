/**
 * Rate limiting middleware. Uses Cloudflare's native Rate Limiting binding
 * when available, falls back to KV-based counters for self-hosted runs.
 *
 * Strategies wired here:
 *   - `RL_PUBLIC_API`     1000 req/hr/key (default — overridable per-plan)
 *   - `RL_AUTH`           30 req/min/IP (login, MFA, password reset)
 *   - `RL_FORM_SUBMIT`    60 req/min/funnel (form-submit endpoint)
 *
 * Per-account caps that vary by plan are enforced inside individual tRPC
 * procedures via @funnel/cost-governor, not at the edge.
 */

import type { MiddlewareHandler } from "hono";
import { FunnelError } from "@funnel/shared";
import type { HonoEnv } from "../lib/context.js";

class RateLimitError extends FunnelError {
  constructor(retryAfterSec: number, key: string) {
    super("Too many requests", {
      code: "rate_limited",
      status: 429,
      details: { retry_after_sec: retryAfterSec, key },
    });
  }
}

export type RateLimitBinding = "RL_PUBLIC_API" | "RL_AUTH" | "RL_FORM_SUBMIT";

export interface RateLimitOptions {
  /** Cloudflare binding to use. */
  binding: RateLimitBinding;
  /** How to derive the key. */
  keyFn: (c: Parameters<MiddlewareHandler<HonoEnv>>[0]) => string;
  /** Window in seconds for the X-RateLimit-Reset header (informational). */
  windowSec: number;
  /** Max requests allowed (informational; the binding owns enforcement). */
  limit: number;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const key = opts.keyFn(c);
    const binding = c.env[opts.binding];

    if (binding && typeof binding.limit === "function") {
      const { success } = await binding.limit({ key });
      if (!success) {
        c.header("Retry-After", String(opts.windowSec));
        throw new RateLimitError(opts.windowSec, key);
      }
    } else {
      // Fallback: KV-based fixed window.
      const ok = await kvFixedWindow(c.env.RATE_LIMIT_FALLBACK, key, opts.limit, opts.windowSec);
      if (!ok) throw new RateLimitError(opts.windowSec, key);
    }

    c.header("X-RateLimit-Limit", String(opts.limit));
    c.header("X-RateLimit-Window", String(opts.windowSec));
    await next();
  };
}

async function kvFixedWindow(
  kv: HonoEnv["Bindings"]["RATE_LIMIT_FALLBACK"],
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const bucket = `${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const raw = await kv.get(bucket);
  const n = raw ? parseInt(raw, 10) : 0;
  if (n >= limit) return false;
  await kv.put(bucket, String(n + 1), { expirationTtl: windowSec + 5 });
  return true;
}

// Common key fns -------------------------------------------------------------
export const byApiKey = (c: Parameters<MiddlewareHandler<HonoEnv>>[0]): string => {
  const ctx = c.get("ctx");
  return ctx?.apiKey?.id ?? `ip:${c.req.header("cf-connecting-ip") ?? "unknown"}`;
};

export const byIp = (c: Parameters<MiddlewareHandler<HonoEnv>>[0]): string => {
  return `ip:${c.req.header("cf-connecting-ip") ?? "unknown"}`;
};

export const byFunnel = (c: Parameters<MiddlewareHandler<HonoEnv>>[0]): string => {
  return `funnel:${c.req.param("funnelId") ?? "unknown"}`;
};
