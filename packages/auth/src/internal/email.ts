/**
 * Email normalization + validation.
 *
 * - Lowercases.
 * - Strips `+tag` only when explicitly requested (we do NOT do this by default
 *   because users want plus-tags to differentiate accounts).
 * - Validates with zod's email check (RFC-5321-ish; sufficient for signup).
 */

import { z } from "zod";

const EmailSchema = z.string().trim().toLowerCase().email().max(320);

export function normalizeEmail(input: string): string {
  return EmailSchema.parse(input);
}

export function isValidEmail(input: string): boolean {
  return EmailSchema.safeParse(input).success;
}

/**
 * Returns a stable display-form (we keep the original case for outbound
 * mail, but the lookup key is always normalized).
 */
export function emailDisplay(input: string): string {
  return input.trim();
}
