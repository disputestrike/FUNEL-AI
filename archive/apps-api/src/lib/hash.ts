/**
 * Edge-compatible hashing helpers. Uses Web Crypto (available in Workers).
 *
 * IP hashes use a per-environment salt so the same IP yields a stable id
 * inside one deployment but is not correlatable across environments or
 * with raw logs.
 */

const enc = new TextEncoder();

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const buf = typeof input === "string" ? enc.encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, body: string | Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = typeof body === "string" ? enc.encode(body) : body;
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Base64(secret: string, body: string | Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = typeof body === "string" ? enc.encode(body) : body;
  const sig = await crypto.subtle.sign("HMAC", key, data);
  let s = "";
  const view = new Uint8Array(sig);
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]!);
  return btoa(s);
}

/**
 * Constant-time string compare. Both sides padded to the longer length to
 * avoid early-exit timing leaks on differing lengths.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    result |= ca ^ cb;
  }
  return result === 0;
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  return `sha256:${await sha256Hex(`${salt}:${ip}`)}`;
}
