/**
 * PII helpers â€” hashing, redaction, normalization.
 *
 * GoFunnelAI never logs raw PII. We hash with SHA-256 (with an optional pepper)
 * to allow dedupe-without-disclosure in the data lake, and we redact strings
 * before they hit log sinks.
 *
 * The pepper for hashing is read from the `FUNNEL_PII_PEPPER` env variable.
 * If unset (e.g. unit tests), the empty string is used â€” callers in
 * production MUST set it.
 */

import { createHash } from "node:crypto";

const PEPPER_ENV = "FUNNEL_PII_PEPPER";

function pepper(): string {
  return process.env[PEPPER_ENV] ?? "";
}

/** Lowercase + trim â€” used before hashing emails. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize a phone number into E.164 if possible. This is a deliberately
 * simple normalizer: strips spaces, dashes, dots, parens. Real production
 * code should use libphonenumber; this is the canonical low-level pass.
 */
export function normalizePhoneE164(phone: string): string {
  const cleaned = phone.trim().replace(/[\s\-.()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+1${cleaned}`; // assume US if 10 digits
  if (!cleaned.startsWith("+")) return `+${cleaned}`;
  return cleaned;
}

/** SHA-256 hash with pepper. Returns lowercase hex. */
export function hash(value: string): string {
  const peppered = `${pepper()}|${value}`;
  return createHash("sha256").update(peppered, "utf8").digest("hex");
}

/** Hash an email after normalization. */
export function hashEmail(email: string): string {
  return hash(normalizeEmail(email));
}

/** Hash a phone number after E.164 normalization. */
export function hashPhone(phone: string): string {
  return hash(normalizePhoneE164(phone));
}

/** Hash an IP address. Use to attach to events without retaining the raw IP. */
export function hashIp(ip: string): string {
  return hash(ip.trim());
}

/** SHA-256 of an arbitrary value (no pepper). Useful for content hashes. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// ---- Redaction ----------------------------------------------------------

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;
// 13â€“19 digit luhn-ish credit card (very rough).
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/g;
// US SSN
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// IPv4
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

/**
 * Replace PII tokens in a string with their type marker, e.g. `[email]`.
 *
 * Use before writing arbitrary user content to logs. Not authoritative â€”
 * for absolute correctness, redact at the field level using the typed
 * `Contact` model.
 */
export function redactPII(s: string): string {
  if (!s) return s;
  return s
    .replace(EMAIL_RE, "[email]")
    .replace(SSN_RE, "[ssn]")
    .replace(IPV4_RE, "[ip]")
    .replace(CC_RE, (m) => (looksLikeCC(m) ? "[card]" : m))
    .replace(PHONE_RE, (m) => (looksLikePhone(m) ? "[phone]" : m));
}

function looksLikeCC(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 13 && digits.length <= 19;
}

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Redact an object recursively. Keys whose name matches a PII pattern are
 * replaced with their marker; string values are passed through `redactPII`.
 */
const PII_KEY_RE = /(email|phone|ssn|tax_id|dob|date_of_birth|password|secret|token|authorization|api_key)/i;

export function redactObject<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === "string") return redactPII(input) as unknown as T;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactObject(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PII_KEY_RE.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = redactObject(v);
    }
  }
  return out as unknown as T;
}

/** PII tiering enum mirroring doc 03 section 0. */
export enum PiiClass {
  P0 = "P0",
  P1 = "P1",
  P2 = "P2",
  P3 = "P3",
}
