/**
 * SHA-256 helpers. Used for:
 *  - URL hash (cache key)
 *  - IP hashing (telemetry; never store raw IPs in events)
 *  - Email hashing (telemetry)
 */

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalize a URL for cache-key purposes: lowercase host, sorted query, no fragment. */
export function normalizeUrlForHash(u: URL): string {
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const search = params.length ? "?" + new URLSearchParams(params).toString() : "";
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.protocol.toLowerCase()}//${u.hostname.toLowerCase()}${pathname}${search}`;
}

export async function hashUrl(u: URL): Promise<string> {
  return sha256Hex(normalizeUrlForHash(u));
}

export async function hashIp(ip: string, salt = process.env.RATE_LIMIT_DAILY_SALT ?? "dev-salt"): Promise<string> {
  return sha256Hex(`${salt}:${ip}`);
}

export async function hashEmail(email: string): Promise<string> {
  return sha256Hex(email.trim().toLowerCase());
}
