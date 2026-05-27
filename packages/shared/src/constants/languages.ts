/**
 * The 10 launch languages for v1.
 *
 * The funnel renderer supports each one with a locale bundle (AI disclosure
 * copy, error messages, form validation). The AI generation engine targets
 * the same set for copy generation.
 *
 * Locale codes are BCP47 with the canonical region.
 */

export interface LanguageMeta {
  code: string; // BCP47 e.g. "en-US"
  base: string; // ISO 639-1 e.g. "en"
  name_en: string; // English display name
  name_native: string; // Native display name
  /** Right-to-left script. */
  rtl: boolean;
}

export const LANGUAGES: readonly LanguageMeta[] = [
  { code: "en-US", base: "en", name_en: "English (US)", name_native: "English (US)", rtl: false },
  { code: "en-GB", base: "en", name_en: "English (UK)", name_native: "English (UK)", rtl: false },
  { code: "es-MX", base: "es", name_en: "Spanish (Mexico)", name_native: "Español (México)", rtl: false },
  { code: "es-ES", base: "es", name_en: "Spanish (Spain)", name_native: "Español (España)", rtl: false },
  { code: "pt-BR", base: "pt", name_en: "Portuguese (Brazil)", name_native: "Português (Brasil)", rtl: false },
  { code: "fr-FR", base: "fr", name_en: "French", name_native: "Français", rtl: false },
  { code: "de-DE", base: "de", name_en: "German", name_native: "Deutsch", rtl: false },
  { code: "it-IT", base: "it", name_en: "Italian", name_native: "Italiano", rtl: false },
  { code: "hi-IN", base: "hi", name_en: "Hindi", name_native: "हिन्दी", rtl: false },
  { code: "ja-JP", base: "ja", name_en: "Japanese", name_native: "日本語", rtl: false },
] as const;

export const LANGUAGES_BY_CODE: Readonly<Record<string, LanguageMeta>> = Object.freeze(
  Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))
);

export const DEFAULT_LANGUAGE: LanguageMeta = LANGUAGES[0]!;

export function getLanguage(code: string): LanguageMeta | undefined {
  return LANGUAGES_BY_CODE[code];
}
