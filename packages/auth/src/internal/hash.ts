/**
 * Hash helpers.
 *
 * - `hashPassword` / `verifyPassword`: argon2id at the OWASP profile
 *   (memoryCost = 64 MiB, timeCost = 3, parallelism = 4).
 * - `sha256Hex` for single-use token hashes and IP-hash inputs.
 * - `hashIp` is a salted SHA-256 to keep IPs out of plaintext storage.
 *
 * `argon2` is loaded eagerly because dynamic import in serverless contexts
 * adds latency on cold starts; the package size is acceptable.
 */

import argon2 from "argon2";
import crypto from "node:crypto";

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret, ARGON2_OPTIONS);
}

export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secret, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function hashIp(ip: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(ip).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Classify a UA into a small bucket so we can store *something* without
 * persisting raw UA strings (which can be PII-adjacent fingerprints).
 *
 * Returns one of: "ios", "android", "macos", "windows", "linux", "bot", "other".
 */
export function classifyUserAgent(ua: string | undefined | null): string | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (/bot|crawler|spider/.test(s)) return "bot";
  if (/iphone|ipad|ios/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  if (/macintosh|mac os x/.test(s)) return "macos";
  if (/windows/.test(s)) return "windows";
  if (/linux/.test(s)) return "linux";
  return "other";
}
