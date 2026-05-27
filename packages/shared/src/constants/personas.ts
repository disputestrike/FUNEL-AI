/**
 * Voice persona catalog (doc 20).
 *
 * Each entry maps a `VoicePersona` to its high-level profile plus the
 * ElevenLabs voice IDs to use for each launch language.
 */

import { VoicePersona } from "../types/persona.js";
import type { PersonaProfile } from "../types/persona.js";

export const PERSONAS: readonly PersonaProfile[] = [
  {
    slug: VoicePersona.Funnel,
    name: "Funnel",
    essence: "The smart friend who runs marketing and would never let you publish something cringe.",
    default_for_industries: [],
    voice_ids: {
      "en-US": { female: "Rachel", male: "Adam" },
      "en-GB": { female: "Rachel", male: "Adam" },
      "es-MX": { female: "Valentina", male: "Mateo" },
      "es-ES": { female: "Valentina", male: "Mateo" },
      "pt-BR": { female: "Camila", male: "Antonio" },
      "fr-FR": { female: "Charlotte", male: "Hugo" },
      "de-DE": { female: "Anika", male: "Lukas" },
    },
    style: {
      sentence_length_max_words: 22,
      contractions: true,
      max_exclamations_per_piece: 1,
      emoji_policy: "sparing",
    },
  },
  {
    slug: VoicePersona.Maven,
    name: "Maven",
    essence: "The trusted advisor who's seen the spreadsheet and read the regs. Authoritative without being stiff.",
    default_for_industries: [
      "insurance",
      "financial_advisors",
      "mortgage",
      "b2b_saas",
      "recruiting",
      "accounting",
      "legal_general",
      "personal_injury_law",
      "family_law",
    ],
    voice_ids: {
      "en-US": { female: "Bella", male: "Sam" },
      "en-GB": { female: "Bella", male: "Sam" },
      "es-MX": { female: "Valentina", male: "Mateo" },
      "es-ES": { female: "Valentina", male: "Mateo" },
      "pt-BR": { female: "Camila", male: "Antonio" },
      "fr-FR": { female: "Charlotte", male: "Hugo" },
      "de-DE": { female: "Anika", male: "Lukas" },
    },
    style: {
      sentence_length_max_words: 26,
      contractions: true,
      max_exclamations_per_piece: 0,
      emoji_policy: "none",
    },
  },
  {
    slug: VoicePersona.Coach,
    name: "Coach",
    essence: "Direct, motivating, no-nonsense — the trainer who tells you the truth and gets you moving.",
    default_for_industries: [
      "fitness",
      "life_coaching",
      "hvac",
      "roofing",
      "plumbing",
      "pest_control",
      "landscaping",
      "weight_loss",
      "chiropractic",
    ],
    voice_ids: {
      "en-US": { female: "Domi", male: "Josh" },
      "en-GB": { female: "Domi", male: "Josh" },
      "es-MX": { female: "Valentina", male: "Mateo" },
      "es-ES": { female: "Valentina", male: "Mateo" },
      "pt-BR": { female: "Camila", male: "Antonio" },
      "fr-FR": { female: "Charlotte", male: "Hugo" },
      "de-DE": { female: "Anika", male: "Lukas" },
    },
    style: {
      sentence_length_max_words: 18,
      contractions: true,
      max_exclamations_per_piece: 2,
      emoji_policy: "sparing",
    },
  },
  {
    slug: VoicePersona.Rebel,
    name: "Rebel",
    essence: "The category-shaker. Edgy, opinionated, willing to call out the BS.",
    default_for_industries: [
      "course_creators",
      "business_coaching",
      "ecommerce_dtc",
      "supplements",
    ],
    voice_ids: {
      "en-US": { female: "Elli", male: "Antoni" },
      "en-GB": { female: "Elli", male: "Antoni" },
      "es-MX": { female: "Valentina", male: "Mateo" },
      "es-ES": { female: "Valentina", male: "Mateo" },
      "pt-BR": { female: "Camila", male: "Antonio" },
      "fr-FR": { female: "Charlotte", male: "Hugo" },
      "de-DE": { female: "Anika", male: "Lukas" },
    },
    style: {
      sentence_length_max_words: 20,
      contractions: true,
      max_exclamations_per_piece: 2,
      emoji_policy: "moderate",
    },
  },
  {
    slug: VoicePersona.Maestro,
    name: "Maestro",
    essence: "Refined, restrained, premium. The concierge voice for luxury and aesthetics.",
    default_for_industries: [
      "med_spa",
      "cosmetic_surgery",
      "luxury_real_estate",
      "hair_restoration",
      "dental",
    ],
    voice_ids: {
      "en-US": { female: "Grace", male: "Daniel" },
      "en-GB": { female: "Grace", male: "Daniel" },
      "es-MX": { female: "Valentina", male: "Mateo" },
      "es-ES": { female: "Valentina", male: "Mateo" },
      "pt-BR": { female: "Camila", male: "Antonio" },
      "fr-FR": { female: "Charlotte", male: "Hugo" },
      "de-DE": { female: "Anika", male: "Lukas" },
    },
    style: {
      sentence_length_max_words: 24,
      contractions: false,
      max_exclamations_per_piece: 0,
      emoji_policy: "none",
    },
  },
] as const;

export const PERSONAS_BY_SLUG: Readonly<Record<VoicePersona, PersonaProfile>> = Object.freeze(
  Object.fromEntries(PERSONAS.map((p) => [p.slug, p])) as Record<VoicePersona, PersonaProfile>
);

export function getPersona(slug: VoicePersona): PersonaProfile {
  const p = PERSONAS_BY_SLUG[slug];
  if (!p) throw new Error(`unknown persona: ${slug as string}`);
  return p;
}
