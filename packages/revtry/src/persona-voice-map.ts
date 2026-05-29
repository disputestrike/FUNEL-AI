/**
 * Persona → ElevenLabs voice id mapping.
 *
 * GoFunnelAI ships 5 voice personas; each one maps to a curated ElevenLabs
 * stock voice. Workspaces on Scale+ tiers can override per-workspace via a
 * cloned voice — the override lives in `workspace_settings.voice_overrides`
 * and falls through to the defaults here when absent.
 *
 * Voice IDs are the public ElevenLabs voice library ids. They are stable
 * across the library — if ElevenLabs deprecates one, swap the literal here
 * (no workspace migration needed because we resolve at call time).
 */

import type { Script } from "./types.js";

export type Persona = "funnel" | "maven" | "coach" | "rebel" | "maestro";

export interface PersonaProfile {
  /** Internal slug used in scripts + analytics. */
  persona: Persona;
  /** Human-readable name played back in the opener. */
  display_name: string;
  /** ElevenLabs stock voice id. */
  voice_id: string;
  /** Short marketing description — surfaced in the UI picker. */
  description: string;
  /** Stability / style sliders tuned for the persona. */
  voice_settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  /** Persona-specific tone prompt fragment used to bias LLM responses. */
  tone_prompt: string;
}

/**
 * Defaults — public ElevenLabs voice ids. These are real voice ids from the
 * stock library; we keep them in code (not a DB column) because they're part
 * of the product spec, not workspace config.
 *
 * If you need to add a persona, add it here AND extend the `Persona` union.
 */
export const PERSONA_VOICE_MAP: Record<Persona, PersonaProfile> = {
  funnel: {
    persona: "funnel",
    display_name: "Maya",
    // "Rachel" — warm, mid-30s, conversational.
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    description: "Warm, mid-30s, slight wit. The default brand voice.",
    voice_settings: { stability: 0.55, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true },
    tone_prompt:
      "Speak warmly and conversationally with a hint of wit. Lead with the customer's outcome, not your product.",
  },
  maven: {
    persona: "maven",
    display_name: "Marcus",
    // "Adam" — analytical, precise, mid-40s.
    voice_id: "pNInz6obpgDQGcFmaJgB",
    description: "Precise, analytical, mid-40s. For B2B + technical buyers.",
    voice_settings: { stability: 0.7, similarity_boost: 0.7, style: 0.15, use_speaker_boost: true },
    tone_prompt:
      "Speak precisely. Use numbers when helpful. Avoid hype words. Acknowledge nuance.",
  },
  coach: {
    persona: "coach",
    display_name: "Alex",
    // "Antoni" — energetic, motivational.
    voice_id: "ErXwobaYiN019PkySvjV",
    description: "Energetic, motivational. For coaches, fitness, ed-tech.",
    voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true },
    tone_prompt:
      "Speak with energy and momentum. Use action verbs. Anchor to the next step.",
  },
  rebel: {
    persona: "rebel",
    display_name: "Jordan",
    // "Sam" — direct, blunt, no-bullshit.
    voice_id: "yoZ06aMxZJJ28mfd3POQ",
    description: "Direct, no-bullshit. For disruptive brands.",
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
    tone_prompt:
      "Be direct. Skip the small talk. Call out the obvious. Respect the listener's time.",
  },
  maestro: {
    persona: "maestro",
    display_name: "Charlotte",
    // "Charlotte" — sophisticated, premium.
    voice_id: "XB0fDUnXU5powFXDhCwa",
    description: "Sophisticated, luxury. For high-ticket + concierge.",
    voice_settings: { stability: 0.6, similarity_boost: 0.78, style: 0.3, use_speaker_boost: true },
    tone_prompt:
      "Speak with composure. Long vowels. Take your time. Treat the listener as a peer.",
  },
};

export function getPersonaProfile(persona: string | null | undefined): PersonaProfile {
  const key = (persona ?? "funnel").toLowerCase() as Persona;
  return PERSONA_VOICE_MAP[key] ?? PERSONA_VOICE_MAP.funnel;
}

/** Convenience: pick the voice id for a script (falls back to funnel). */
export function voiceIdForScript(script: Pick<Script, "persona">): string {
  return getPersonaProfile(script.persona).voice_id;
}
