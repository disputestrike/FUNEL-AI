/**
 * Voice personas (doc 20).
 *
 * Five canonical personas drive every word the platform writes or speaks on a
 * customer's behalf. `VoicePersona` is the enum; `PersonaProfile` is the
 * runtime metadata the agent pipeline reads to load system prompts.
 */

export enum VoicePersona {
  Funnel = "funnel",
  Maven = "maven",
  Coach = "coach",
  Rebel = "rebel",
  Maestro = "maestro",
}

export interface PersonaProfile {
  slug: VoicePersona;
  name: string;
  essence: string;
  default_for_industries: string[];
  /** ElevenLabs voice ID per BCP47 language tag. */
  voice_ids: Record<string, { female: string; male: string }>;
  /** Soft style toggles read by the agent pipeline. */
  style: {
    sentence_length_max_words: number;
    contractions: boolean;
    max_exclamations_per_piece: number;
    emoji_policy: "none" | "sparing" | "moderate";
  };
}
