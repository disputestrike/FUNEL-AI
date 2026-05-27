/**
 * Layered rate limiter (L3 + L4) backed by the `rate_limits` Postgres table.
 *
 * Layers L1 (Cloudflare WAF) and L2 (Cloudflare Rate Limiting rule) live
 * outside the app. Layer L5 (cost governor) is in `cost-governor.ts`.
 * Layer L6 (Turnstile) is verified in `turnstile.ts`.
 *
 * We use a "sliding-fixed-window" approximation: each window is rounded down
 * to its boundary (hour or day). This is precise enough for abuse control and
 * cheap to query (single primary-key lookup).
 */

import { prisma } from "@funnel/db";
import { RATE_LIMITS } from "@funnel/shared";

export type RateLimitWindow = "hourly" | "daily";

function windowKey(now: Date, window: RateLimitWindow): string {
  if (window === "hourly") {
    return now.toISOString().slice(0, 13); // "2026-05-26T14"
  }
  return now.toISOString().slice(0, 10); // "2026-05-26"
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  scope: string;
  layer: string;
}

async function bumpAndCheck(
  scope: string,
  layer: string,
  window: RateLimitWindow,
  limit: number,
  now: Date,
): Promise<RateLimitResult> {
  const key = windowKey(now, window);

  // Upsert + return new count atomically.
  const row = await prisma.rateLimit.upsert({
    where: { scope_windowKey: { scope, windowKey: key } },
    create: { scope, windowKey: key, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });

  const resetAt = new Date(now);
  if (window === "hourly") {
    resetAt.setUTCMinutes(0, 0, 0);
    resetAt.setUTCHours(resetAt.getUTCHours() + 1);
  } else {
    resetAt.setUTCHours(0, 0, 0, 0);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  }

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    limit,
    resetAt,
    scope,
    layer,
  };
}

/** Check both per-IP (hourly + daily) and per-target-domain (daily). */
export async function checkAuditRateLimits(opts: {
  ip: string | null;
  hostname: string;
  now?: Date;
}): Promise<{ ok: true; results: RateLimitResult[] } | { ok: false; blocked: RateLimitResult }> {
  const now = opts.now ?? new Date();
  const checks: RateLimitResult[] = [];

  if (opts.ip) {
    checks.push(
      await bumpAndCheck(`ip:${opts.ip}`, "L3:ip:hourly", "hourly", RATE_LIMITS.PER_IP_HOURLY, now),
    );
    checks.push(
      await bumpAndCheck(`ip-day:${opts.ip}`, "L3:ip:daily", "daily", RATE_LIMITS.PER_IP_DAILY, now),
    );
  }

  checks.push(
    await bumpAndCheck(
      `domain:${opts.hostname}`,
      "L4:domain:daily",
      "daily",
      RATE_LIMITS.PER_DOMAIN_DAILY,
      now,
    ),
  );

  const blocked = checks.find((c) => !c.allowed);
  if (blocked) return { ok: false, blocked };
  return { ok: true, results: checks };
}

/** Refund a single rate-limit bump (e.g. after we return a cached result). */
export async function refundAuditRateLimits(opts: {
  ip: string | null;
  hostname: string;
  now?: Date;
}): Promise<void> {
  const now = opts.now ?? new Date();
  const scopes: Array<[string, RateLimitWindow]> = [
    [`domain:${opts.hostname}`, "daily"],
  ];
  if (opts.ip) {
    scopes.push([`ip:${opts.ip}`, "hourly"]);
    scopes.push([`ip-day:${opts.ip}`, "daily"]);
  }

  await Promise.all(
    scopes.map(([scope, window]) =>
      prisma.rateLimit
        .update({
          where: { scope_windowKey: { scope, windowKey: windowKey(now, window) } },
          data: { count: { decrement: 1 } },
        })
        .catch(() => null),
    ),
  );
}
