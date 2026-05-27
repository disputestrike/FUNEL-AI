/**
 * 6-char base32 share codes (Crockford alphabet, no I/L/O/U to avoid confusion).
 * 32^6 = 1,073,741,824 unique codes — plenty for v1.
 */

import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)
const SHARE_CODE_LEN = 6;

const generate = customAlphabet(ALPHABET, SHARE_CODE_LEN);

/** Generate a fresh, lowercase 6-char share code. */
export function newShareCode(): string {
  return generate().toLowerCase();
}

/** Loose validation — six valid chars only. Used at the route boundary. */
export function isValidShareCode(s: string): boolean {
  if (typeof s !== "string") return false;
  if (s.length !== SHARE_CODE_LEN) return false;
  return /^[0-9a-z]+$/i.test(s) && [...s].every((c) => ALPHABET.includes(c.toUpperCase()));
}
