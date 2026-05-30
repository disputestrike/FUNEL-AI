/**
 * Password policy.
 *
 * - Minimum 10 chars (NIST 800-63B).
 * - Disallows trivially weak passwords (common-password short-list).
 * - Disallows the user's own email local-part as a substring.
 *
 * We deliberately avoid composition rules ("must have a special char") —
 * NIST 800-63B §5.1.1 explicitly recommends against them. Length + a small
 * blocklist is what we enforce.
 */

import { Errors } from "../errors.js";

const COMMON_PASSWORDS = new Set<string>([
  "password",
  "password1",
  "password123",
  "qwerty123",
  "letmein",
  "iloveyou",
  "admin123",
  "welcome1",
  "12345678",
  "123456789",
  "1234567890",
  "abc12345",
  "monkey123",
  "passw0rd",
  "p@ssw0rd",
  "trustno1",
]);

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  maxLength: 256,
};

export function assertPasswordOk(
  password: string,
  hints: { email?: string } = {},
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): void {
  if (password.length < policy.minLength) {
    throw Errors.weakPassword(`Password must be at least ${policy.minLength} characters.`);
  }
  if (password.length > policy.maxLength) {
    throw Errors.weakPassword(`Password must be at most ${policy.maxLength} characters.`);
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    throw Errors.weakPassword("That password is too common. Pick something less guessable.");
  }
  if (hints.email) {
    const local = hints.email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && lower.includes(local)) {
      throw Errors.weakPassword("Password cannot contain your email.");
    }
  }
  // Reject passwords that are entirely one repeated character (e.g. "aaaaaaaaaa").
  if (/^(.)\1+$/.test(password)) {
    throw Errors.weakPassword("Password cannot be a single repeated character.");
  }
}
