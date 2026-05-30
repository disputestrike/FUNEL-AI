/**
 * Auth-specific rate limits — reuses the `rate_limits` Postgres table that
 * the grader rate limiter already uses (see src/lib/grader/rate-limit.ts).
 *
 * Sliding-fixed-window approximation: each window is rounded down to the
 * hour. Single primary-key upsert per check, cheap and idempotent across
 * concurrent requests.
 *
 * Limits chosen to make password-spray and mass-signup expensive without
 * burdening real users:
 *   - SIGNUP_PER_IP_HOURLY = 10  (catches automated farms, not human typos)
 *   - LOGIN_PER_EMAIL_HOURLY = 8  (lets a real user retry, blocks spraying)
 *   - LOGIN_PER_IP_HOURLY = 30   (defends against single-IP enumeration)
 */
import { prisma } from "@funnel/db";

export const SIGNUP_PER_IP_HOURLY = 10;
export const LOGIN_PER_EMAIL_HOURLY = 8;
export const LOGIN_PER_IP_HOURLY = 30;

function hourKey(now: Date): string {
  return now.toISOString().slice(0, 13); // "2026-05-30T13"
}

export interface AuthLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

async function bump(
  scope: string,
  limit: number,
  now: Date,
): Promise<AuthLimitResult> {
  const windowKey = hourKey(now);
  const row = await prisma.rateLimit.upsert({
    where: { scope_windowKey: { scope, windowKey } },
    create: { scope, windowKey, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });

  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((nextHour.getTime() - now.getTime()) / 1000),
  );

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    limit,
    retryAfterSeconds,
  };
}

/** Bump + check the signup-per-IP limit. Call once per POST /api/auth/signup. */
export async function checkSignupRateLimit(
  ip: string | null,
  now: Date = new Date(),
): Promise<AuthLimitResult> {
  if (!ip) {
    // No IP (local dev / proxy stripped) — fail-open with a small allowance.
    return { allowed: true, remaining: SIGNUP_PER_IP_HOURLY, limit: SIGNUP_PER_IP_HOURLY, retryAfterSeconds: 0 };
  }
  return bump(`auth:signup:ip:${ip}`, SIGNUP_PER_IP_HOURLY, now);
}

/** Bump + check the login-per-email and login-per-IP limits. Worst result wins. */
export async function checkLoginRateLimit(
  email: string | null,
  ip: string | null,
  now: Date = new Date(),
): Promise<AuthLimitResult> {
  const checks: AuthLimitResult[] = [];

  if (email) {
    checks.push(
      await bump(`auth:login:email:${email}`, LOGIN_PER_EMAIL_HOURLY, now),
    );
  }
  if (ip) {
    checks.push(
      await bump(`auth:login:ip:${ip}`, LOGIN_PER_IP_HOURLY, now),
    );
  }

  if (checks.length === 0) {
    return { allowed: true, remaining: LOGIN_PER_EMAIL_HOURLY, limit: LOGIN_PER_EMAIL_HOURLY, retryAfterSeconds: 0 };
  }
  // Worst (least-remaining) wins.
  return checks.reduce((worst, c) =>
    !c.allowed || c.remaining < worst.remaining ? c : worst,
  );
}

/**
 * Extract the client IP from a Next.js Request. Trusts the proxy chain when
 * running behind Railway / Cloudflare / Vercel.
 */
export function clientIpFrom(headers: Headers): string | null {
  // Cloudflare → Railway / Vercel
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.split(",")[0]?.trim() ?? null;
  // Standard reverse-proxy header
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
