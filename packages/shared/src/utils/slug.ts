/**
 * URL-safe slug generation.
 *
 * Used for workspace slugs, funnel slugs, page slugs, short links. Slugs are
 * lowercase, ASCII, dash-separated, 1..80 chars.
 */

import { customAlphabet } from "nanoid";

const SLUG_MAX = 80;
const SLUG_DEFAULT_SUFFIX_LEN = 6;

const generateSuffix = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", SLUG_DEFAULT_SUFFIX_LEN);

/**
 * Convert arbitrary text into a URL-safe slug.
 *
 * @example
 *   slugify("Texas Solar â€” Summer 2026!"); // "texas-solar-summer-2026"
 *   slugify("  spaces  &  things  ");      // "spaces-and-things"
 */
export function slugify(input: string, opts: { maxLength?: number } = {}): string {
  const max = opts.maxLength ?? SLUG_MAX;
  const intermediate = input
    .normalize("NFKD")
    // Strip diacritics
    .replace(/[̀-ͯ]/g, "")
    // Replace ampersand semantics
    .replace(/&/g, " and ")
    // Lowercase everything
    .toLowerCase()
    // Replace any non-alphanumeric run with a single dash
    .replace(/[^a-z0-9]+/g, "-")
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, "");
  return intermediate.slice(0, max).replace(/-+$/g, "");
}

/**
 * Return a slug with a random short suffix appended. Use when uniqueness is
 * required and the caller can't query the DB up-front.
 *
 * @example
 *   slugifyWithSuffix("Texas Solar"); // "texas-solar-k3p9wm"
 */
export function slugifyWithSuffix(input: string, opts: { maxLength?: number; suffixLength?: number } = {}): string {
  const suffixLen = opts.suffixLength ?? SLUG_DEFAULT_SUFFIX_LEN;
  const max = (opts.maxLength ?? SLUG_MAX) - suffixLen - 1;
  const base = slugify(input, { maxLength: max });
  if (!base) return generateSuffix();
  return `${base}-${generateSuffix()}`;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True iff `s` is a valid GoFunnelAI slug. */
export function isValidSlug(s: string): boolean {
  if (typeof s !== "string") return false;
  if (s.length < 1 || s.length > SLUG_MAX) return false;
  return SLUG_REGEX.test(s);
}

/**
 * Given a desired slug and a list of taken ones (or a check function), return
 * a unique slug by appending `-2`, `-3`, â€¦ until a free one is found.
 */
export function ensureUniqueSlug(
  desired: string,
  taken: ReadonlySet<string> | ((candidate: string) => boolean)
): string {
  const isTaken = typeof taken === "function" ? taken : (s: string) => taken.has(s);
  const base = slugify(desired);
  if (!isTaken(base)) return base;
  let n = 2;
  while (n < 10_000) {
    const candidate = `${base}-${n}`;
    if (!isTaken(candidate)) return candidate;
    n++;
  }
  // Fallback to suffixed form rather than throw.
  return slugifyWithSuffix(desired);
}
