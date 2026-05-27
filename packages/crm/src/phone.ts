/**
 * Phone normalization helper. Production wraps Google libphonenumber-js, but
 * we keep a strict E.164 regex fallback so this package builds and tests
 * without pulling the heavy locale data file at import time.
 */

const E164_RE = /^\+[1-9]\d{1,14}$/;

export interface NormalizedPhone {
  e164: string | null;
  country: string | null;
  valid: boolean;
}

/**
 * Normalize a phone string. If `defaultCountry` is set we add the country
 * dialing code when one is missing. Returns `{valid:false}` on garbage.
 */
export function normalizePhone(input: string | null | undefined, defaultCountry?: string): NormalizedPhone {
  if (!input) return { e164: null, country: null, valid: false };
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned) return { e164: null, country: null, valid: false };

  let candidate = cleaned;
  if (!candidate.startsWith("+")) {
    if (defaultCountry === "US" || defaultCountry === "CA") {
      // North America: 10-digit local → +1XXXXXXXXXX
      if (candidate.length === 10) candidate = `+1${candidate}`;
      else if (candidate.length === 11 && candidate.startsWith("1")) candidate = `+${candidate}`;
    } else if (defaultCountry) {
      candidate = `+${candidate}`;
    }
  }

  if (!E164_RE.test(candidate)) {
    return { e164: null, country: defaultCountry ?? null, valid: false };
  }

  const country = inferCountry(candidate) ?? defaultCountry ?? null;
  return { e164: candidate, country, valid: true };
}

const COUNTRY_PREFIXES: Array<[string, string]> = [
  ["+1", "US"],
  ["+44", "GB"],
  ["+49", "DE"],
  ["+33", "FR"],
  ["+34", "ES"],
  ["+39", "IT"],
  ["+351", "PT"],
  ["+55", "BR"],
  ["+52", "MX"],
  ["+61", "AU"],
  ["+64", "NZ"],
  ["+81", "JP"],
  ["+91", "IN"],
];

function inferCountry(e164: string): string | null {
  for (const [pfx, iso] of COUNTRY_PREFIXES) {
    if (e164.startsWith(pfx)) return iso;
  }
  return null;
}

/** SHA-256 hex of an E.164 phone number — used for hashed dedupe + DNC lookups. */
export async function hashPhone(e164: string): Promise<string> {
  const enc = new TextEncoder().encode(e164);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex of a lowercased email — used for dedupe + suppression lookups. */
export async function hashEmail(emailRaw: string): Promise<string> {
  const enc = new TextEncoder().encode(emailRaw.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
