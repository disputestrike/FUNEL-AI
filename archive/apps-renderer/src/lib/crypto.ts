/**
 * Crypto helpers — runs on Web Crypto, which is the only crypto available
 * in the Cloudflare Workers runtime. No Node `crypto` module.
 */

const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bufToHex(buf);
}

export async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
  return bufToHex(sig);
}

export async function hmacSha256Verify(
  key: string,
  msg: string,
  expectedHex: string
): Promise<boolean> {
  const actual = await hmacSha256Hex(key, msg);
  return constantTimeEqual(actual, expectedHex);
}

export function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i]!;
    out += (v < 16 ? "0" : "") + v.toString(16);
  }
  return out;
}

/** Length-mismatch-safe constant-time string compare. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Deterministic 32-bit hash from a string. Used for A/B bucketing — NOT for
 * security purposes. We can't use SHA-256 in the hot bucketing path because
 * it's async, so we use a synchronous FNV-1a variant. The mixed input is
 * `visitor_id + funnel_id + experiment_id`, which is hard to game and is the
 * same scheme our experiments framework uses.
 */
export function fnv1aHash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Random-but-stable visitor ID. Uses crypto.randomUUID() under the hood and
 * is what we set in the `fn_vid` cookie.
 */
export function newVisitorId(): string {
  return crypto.randomUUID();
}

/**
 * Normalize an email for hashing — lowercase + strip whitespace. This is what
 * Meta CAPI, Google EC, and TikTok Events all do, so a single hashed value
 * works everywhere.
 */
export function normalizeEmailForHash(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalize a phone number to E.164 digits-only. */
export function normalizePhoneForHash(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}
