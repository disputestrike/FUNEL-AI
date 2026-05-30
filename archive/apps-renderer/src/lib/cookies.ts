/**
 * Cookie helpers for Workers — Hono has cookie helpers but we keep this
 * tiny + sync so we don't pull anything heavy.
 */

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(eq + 1));
    } catch {
      out[k] = part.slice(eq + 1);
    }
  }
  return out;
}

export interface SetCookieOpts {
  maxAgeSeconds?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

export function buildSetCookie(
  name: string,
  value: string,
  opts: SetCookieOpts = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAgeSeconds != null) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure !== false) parts.push("Secure");
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

export const COOKIE_VISITOR_ID = "fn_vid";
export const COOKIE_AB_PREFIX = "fn_ab_";
export const COOKIE_AFFILIATE = "fn_ref";
export const COOKIE_CONSENT = "fn_consent";
