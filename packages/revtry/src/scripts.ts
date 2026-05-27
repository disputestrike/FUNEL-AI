/**
 * Industry × persona × language script generator.
 *
 *   - Returns the full script bundle: opener, qualifying questions, objection
 *     handlers, booking close, voicemail variant, TCPA opt-out line, and
 *     recording disclosure.
 *   - Library is keyed by `industry × persona × language`. We ship a starter
 *     set; the LLM-generated full library lives in the KB pack (Doc 02a).
 */

import type { Script } from "./types.js";

const RECORDING_DISCLOSURE_EN = `This call is being recorded for quality and compliance. Say 'opt out' now if you'd prefer not to be recorded.`;
const RECORDING_DISCLOSURE_ES = `Esta llamada está siendo grabada para control de calidad. Diga 'no grabe' ahora si prefiere no ser grabado.`;
const TCPA_OPTOUT_EN = `If you'd like us to stop calling, just say 'remove me' or 'do not call' and we'll take care of it right now.`;

const STARTER_LIBRARY: Record<string, Partial<Script>> = {
  "solar.homeowner.en": {
    opener: `Hi, I'm Maya with {{business_name}} — you asked about lowering your power bill. Have a quick minute?`,
    qualifying_questions: [
      `What's your average monthly electric bill?`,
      `Do you own the home or rent?`,
      `When you say 'looking into solar,' are you weeks away or months out?`,
    ],
    objection_handlers: [
      { objection: "price", response: `Totally fair — most folks I talk to start there. Want me to send you the all-in number for your house and you can decide?` },
      { objection: "spam", response: `Got it. We can absolutely stop calling. Want me to text you the estimate instead, or just remove you from the list?` },
    ],
    booking_close: `Two slots this week — Tuesday at 6pm or Thursday at 11am for a 15-minute walk-through. Which works better?`,
    voicemail_variant: `Hey {{first_name}} — Maya from {{business_name}}. Looks like I missed you. Quick 15 minutes is usually enough to know if solar is worth it. I'll try once more tomorrow morning.`,
  },
  "real-estate.buyer.en": {
    opener: `Hi, I'm Alex with {{business_name}} — you filled out a quick form about buying. Got a minute?`,
    qualifying_questions: [
      `Where are you looking?`,
      `Pre-approved yet, or still shopping for a lender?`,
      `Timeline — weeks or months?`,
    ],
    objection_handlers: [
      { objection: "just_browsing", response: `Totally — most of my best buyers started like that. Want me to send 3 listings that match what you described so you can keep browsing without the noise?` },
    ],
    booking_close: `15 minutes with {{agent_name}}, either Wednesday 7pm or Saturday 10am — which works?`,
    voicemail_variant: `Hey {{first_name}} — Alex from {{business_name}}. Got your form. I'll call once more tomorrow at noon — or you can text me back.`,
  },
};

export function scriptKey(industry: string, persona: string, language: string): string {
  return `${industry.toLowerCase()}.${persona.toLowerCase()}.${language.toLowerCase()}`;
}

export interface ScriptGenInput {
  workspace_id: string;
  industry: string;
  persona: string;
  language: string;
  agent_name?: string;
  business_name?: string;
}

/**
 * Build a complete script for the requested industry/persona/language. Pulls
 * the starter snippet from the library if available; otherwise returns a
 * generic-but-compliant fallback.
 */
export function generateScript(input: ScriptGenInput): Script {
  const key = scriptKey(input.industry, input.persona, input.language);
  const seed = STARTER_LIBRARY[key] ?? {};

  const isES = input.language.toLowerCase().startsWith("es");
  const recording = isES ? RECORDING_DISCLOSURE_ES : RECORDING_DISCLOSURE_EN;

  return {
    workspace_id: input.workspace_id,
    industry: input.industry,
    persona: input.persona,
    language: input.language,
    opener:
      seed.opener ?? `Hi, this is your AI assistant calling on behalf of {{business_name}}. Got a quick minute?`,
    qualifying_questions:
      seed.qualifying_questions ?? [
        `What made you reach out today?`,
        `How soon are you looking to move forward?`,
        `Who else is involved in the decision?`,
      ],
    objection_handlers:
      seed.objection_handlers ?? [
        { objection: "price", response: `Totally fair. Want me to send you the all-in number and you can decide if it's a fit?` },
        { objection: "not_now", response: `Got it — what would need to change for this to be a good time?` },
      ],
    booking_close:
      seed.booking_close ?? `Two options this week — Tuesday at 2pm or Thursday at 11am for a quick chat. Which works?`,
    voicemail_variant:
      seed.voicemail_variant ?? `Hey {{first_name}} — your AI assistant from {{business_name}}. Just following up on your request. No rush — I'll try once more tomorrow.`,
    tcpa_opt_out_line: TCPA_OPTOUT_EN,
    recording_disclosure: recording,
    version: "1.0.0",
    updated_at: new Date().toISOString(),
  };
}
