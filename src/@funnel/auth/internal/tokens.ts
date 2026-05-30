/**
 * Single-use token helpers.
 *
 * Raw tokens are 32 random bytes encoded base64url. We persist only the
 * sha256 hash; the raw token never round-trips through the database.
 *
 * Token purposes have hard-coded TTLs in PURPOSE_TTL_SEC.
 */

import crypto from "node:crypto";
import { sha256Hex } from "./hash.js";

export const PURPOSE_TTL_SEC = {
  email_verify: 24 * 60 * 60, // 24h
  magic_link: 15 * 60, // 15m
  password_reset: 60 * 60, // 1h
  email_change: 24 * 60 * 60,
  invite: 7 * 24 * 60 * 60, // 7d
} as const;

export type TokenPurpose = keyof typeof PURPOSE_TTL_SEC;

export function generateRawToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(raw: string): string {
  return sha256Hex(raw);
}

export function ttlForPurpose(purpose: TokenPurpose): number {
  return PURPOSE_TTL_SEC[purpose];
}
