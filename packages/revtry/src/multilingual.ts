/**
 * Multilingual detection + script variant lookup.
 *
 * Caller passes the lead's declared language; if absent we fall back to a
 * lightweight heuristic on the lead's geography. Detection on speech happens
 * in the speech-to-text layer; we just route the result back here to pick the
 * script variant.
 */

const COUNTRY_TO_LANG: Record<string, string> = {
  US: "en", CA: "en", GB: "en", AU: "en", NZ: "en", IE: "en",
  MX: "es", ES: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  FR: "fr", BE: "fr", LU: "fr",
  DE: "de", AT: "de", CH: "de",
  IT: "it",
  NL: "nl",
  PT: "pt", BR: "pt",
  JP: "ja",
  KR: "ko",
  CN: "zh", TW: "zh", HK: "zh",
  IN: "en", PH: "en", SG: "en",
};

/** Two-letter ISO-639-1 lang for a country, or `'en'` fallback. */
export function defaultLanguageForCountry(country_iso2: string | null | undefined): string {
  if (!country_iso2) return "en";
  return COUNTRY_TO_LANG[country_iso2.toUpperCase()] ?? "en";
}

/** Normalize an inbound declared language to ISO-639-1 short form. */
export function normalizeLang(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0] ?? "en";
}
