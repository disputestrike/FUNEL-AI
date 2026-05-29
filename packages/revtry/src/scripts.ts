/**
 * Industry × persona × language script generator.
 *
 *   - Returns the full script bundle: opener, qualifying questions, objection
 *     handlers, booking close, voicemail variant, TCPA opt-out line, and
 *     recording disclosure.
 *   - Library is keyed by `industry × persona × language`. We ship a starter
 *     set; the LLM-generated full library lives in the KB pack (Doc 02a).
 *   - Lead-data interpolation: `{{first_name}}`, `{{business_name}}`,
 *     `{{agent_name}}`, `{{funnel_offer}}` are substituted when provided.
 *   - Persona tone (when `persona` matches a brand persona —
 *     funnel/maven/coach/rebel/maestro — we bias the opener style).
 */

import { getPersonaProfile } from "./persona-voice-map.js";
import type { Script } from "./types.js";

/* ------------------- Recording disclosures (10 launch langs) ------------------- */

const RECORDING_DISCLOSURES: Record<string, string> = {
  en: `This call is being recorded for quality and compliance. Say 'opt out' now if you'd prefer not to be recorded.`,
  es: `Esta llamada está siendo grabada para control de calidad. Diga 'no grabe' ahora si prefiere no ser grabado.`,
  fr: `Cet appel est enregistré pour le contrôle qualité. Dites 'refuser' maintenant si vous préférez ne pas être enregistré.`,
  de: `Dieser Anruf wird zur Qualitätssicherung aufgezeichnet. Sagen Sie jetzt 'ablehnen', wenn Sie nicht aufgezeichnet werden möchten.`,
  it: `Questa chiamata è registrata per il controllo qualità. Dica 'rifiuto' ora se preferisce non essere registrato.`,
  pt: `Esta chamada está sendo gravada para controle de qualidade. Diga 'recusar' agora se preferir não ser gravado.`,
  nl: `Dit gesprek wordt opgenomen voor kwaliteitscontrole. Zeg nu 'weigeren' als u liever niet wordt opgenomen.`,
  ja: `この通話は品質管理のため録音されています。録音を希望されない場合は、今すぐ「拒否」と言ってください。`,
  ko: `이 통화는 품질 관리를 위해 녹음됩니다. 녹음을 원하지 않으시면 지금 '거부'라고 말씀해 주세요.`,
  zh: `此通话出于质量目的正在录音。如果您不希望被录音，请现在说"拒绝"。`,
};

const TCPA_OPTOUTS: Record<string, string> = {
  en: `If you'd like us to stop calling, just say 'remove me' or press 9 and we'll take care of it right now.`,
  es: `Si desea que dejemos de llamar, diga 'quítenme' o presione 9 y lo haremos de inmediato.`,
  fr: `Pour ne plus être appelé, dites 'retirez-moi' ou appuyez sur 9.`,
  de: `Wenn Sie keine weiteren Anrufe wünschen, sagen Sie 'entfernen' oder drücken Sie 9.`,
  it: `Per non essere più chiamato, dica 'rimuovimi' o prema 9.`,
  pt: `Para não receber mais chamadas, diga 'remova-me' ou pressione 9.`,
  nl: `Zeg 'verwijder mij' of druk op 9 om geen oproepen meer te ontvangen.`,
  ja: `今後の電話を希望されない場合は、「削除」と言うか9を押してください。`,
  ko: `더 이상 전화를 받지 않으시려면 '제거'라고 말씀하시거나 9번을 눌러주세요.`,
  zh: `如果您不希望再接到电话，请说"删除"或按9。`,
};

/* ----------------------- Starter library (industry packs) ---------------------- */

const STARTER_LIBRARY: Record<string, Partial<Script>> = {
  "solar.homeowner.en": {
    opener: `Hi {{first_name}}, I'm {{agent_name}} with {{business_name}} — you asked about lowering your power bill on solar. Got a quick minute?`,
    qualifying_questions: [
      `What's your average monthly electric bill?`,
      `Do you own the home or rent?`,
      `When you say 'looking into solar,' are you weeks away or months out?`,
      `Have you had a quote from anyone else?`,
      `Is anyone else involved in the decision?`,
    ],
    objection_handlers: [
      { objection: "price", response: `Totally fair — most folks I talk to start there. Want me to send you the all-in number for your house and you can decide?` },
      { objection: "spam", response: `Got it. We can absolutely stop calling. Want me to text you the estimate instead, or just remove you from the list?` },
      { objection: "not_now", response: `No problem — what would need to change for this to be a good time? I'll set a reminder.` },
    ],
    booking_close: `Two slots this week — Tuesday at 6pm or Thursday at 11am for a 15-minute walk-through. Which works better?`,
    voicemail_variant: `Hey {{first_name}} — {{agent_name}} from {{business_name}}. Looks like I missed you. Quick 15 minutes is usually enough to know if solar is worth it. I'll try once more tomorrow morning.`,
  },
  "real-estate.buyer.en": {
    opener: `Hi {{first_name}}, I'm {{agent_name}} with {{business_name}} — you filled out a form about buying. Got a minute?`,
    qualifying_questions: [
      `Where are you looking?`,
      `Pre-approved yet, or still shopping for a lender?`,
      `Timeline — weeks or months?`,
      `Price range you're comfortable in?`,
      `Anyone else on the decision with you?`,
    ],
    objection_handlers: [
      { objection: "just_browsing", response: `Totally — most of my best buyers started like that. Want me to send 3 listings that match what you described so you can keep browsing without the noise?` },
      { objection: "price", response: `Yeah, the market is wild. Want me to text you 3 picks under your number so you can see what's realistic?` },
      { objection: "not_now", response: `Fine — when's a better time to circle back? I'll add a reminder.` },
    ],
    booking_close: `15 minutes with {{agent_name}}, either Wednesday 7pm or Saturday 10am — which works?`,
    voicemail_variant: `Hey {{first_name}} — {{agent_name}} from {{business_name}}. Got your form. I'll call once more tomorrow at noon — or you can text me back.`,
  },
  "coaching.lead.en": {
    opener: `Hey {{first_name}}, {{agent_name}} from {{business_name}}. You grabbed my free guide — want me to help you actually use it? Two minutes.`,
    qualifying_questions: [
      `What outcome are you chasing in the next 90 days?`,
      `What's the biggest thing in the way right now?`,
      `Have you worked with a coach before?`,
      `If we mapped a plan today, are you in a spot to start this month?`,
    ],
    objection_handlers: [
      { objection: "price", response: `I hear you. Here's the thing — what's the cost of not solving this for another quarter? Want me to walk you through what the smallest first step looks like?` },
      { objection: "think_about_it", response: `Cool — what's the part you need to think about? Maybe I can answer it now.` },
    ],
    booking_close: `Two 20-minute strategy slots open — Tuesday 3pm or Friday 10am. Which one?`,
    voicemail_variant: `Hey {{first_name}} — {{agent_name}}. Quick voicemail. Grab a slot at {{business_name}}/book — Tuesday or Friday this week. Talk soon.`,
  },
};

const RECORDING_DEFAULT = RECORDING_DISCLOSURES.en!;
const TCPA_DEFAULT = TCPA_OPTOUTS.en!;

export function scriptKey(industry: string, persona: string, language: string): string {
  return `${industry.toLowerCase()}.${persona.toLowerCase()}.${language.toLowerCase()}`;
}

export interface LeadData {
  first_name?: string | null;
  last_name?: string | null;
  /** Marketing offer the lead opted in for — used in opener interpolation. */
  funnel_offer?: string | null;
}

export interface ScriptGenInput {
  workspace_id: string;
  industry: string;
  persona: string;
  language: string;
  agent_name?: string;
  business_name?: string;
  lead_data?: LeadData;
}

/**
 * Build a complete script for the requested industry/persona/language. Pulls
 * the starter snippet from the library if available; otherwise returns a
 * generic-but-compliant fallback. Interpolates lead-data when provided.
 */
export function generateScript(input: ScriptGenInput): Script {
  const lang = normalizeLanguage(input.language);
  const key = scriptKey(input.industry, input.persona, lang);
  const seed = STARTER_LIBRARY[key] ?? {};

  const recording = RECORDING_DISCLOSURES[lang] ?? RECORDING_DEFAULT;
  const tcpa = TCPA_OPTOUTS[lang] ?? TCPA_DEFAULT;

  const personaProfile = getPersonaProfile(input.persona);
  const agentName = input.agent_name ?? personaProfile.display_name;
  const businessName = input.business_name ?? "GoFunnelAI";
  const firstName = input.lead_data?.first_name ?? "there";

  const interp = (s: string): string =>
    s
      .replaceAll("{{first_name}}", firstName)
      .replaceAll("{{agent_name}}", agentName)
      .replaceAll("{{business_name}}", businessName)
      .replaceAll("{{funnel_offer}}", input.lead_data?.funnel_offer ?? "our offer");

  const opener =
    seed.opener ?? defaultOpenerForPersona(input.persona, lang);
  const qualifying =
    seed.qualifying_questions ??
    DEFAULT_QUALIFIERS[lang] ??
    DEFAULT_QUALIFIERS.en!;
  const objections =
    seed.objection_handlers ??
    DEFAULT_OBJECTIONS[lang] ??
    DEFAULT_OBJECTIONS.en!;
  const close =
    seed.booking_close ??
    `Two options this week — Tuesday at 2pm or Thursday at 11am for a quick chat. Which works?`;
  const vm =
    seed.voicemail_variant ??
    `Hey {{first_name}} — ${agentName} from {{business_name}}. Just following up on your request. No rush — I'll try once more tomorrow.`;

  return {
    workspace_id: input.workspace_id,
    industry: input.industry,
    persona: input.persona,
    language: lang,
    opener: interp(opener),
    qualifying_questions: qualifying.map(interp),
    objection_handlers: objections.map((o) => ({ objection: o.objection, response: interp(o.response) })),
    booking_close: interp(close),
    voicemail_variant: interp(vm),
    tcpa_opt_out_line: tcpa,
    recording_disclosure: recording,
    version: "1.1.0",
    updated_at: new Date().toISOString(),
  };
}

/* ----------------------------- helpers ------------------------------ */

function normalizeLanguage(lang: string): string {
  const short = lang.toLowerCase().split(/[-_]/)[0] ?? "en";
  return RECORDING_DISCLOSURES[short] ? short : "en";
}

function defaultOpenerForPersona(persona: string, lang: string): string {
  if (lang !== "en") {
    return `{{first_name}}, soy {{agent_name}} de {{business_name}}. ¿Tienes un minuto?`;
  }
  switch (persona.toLowerCase()) {
    case "maven":
      return `Hi {{first_name}}, this is {{agent_name}} with {{business_name}}. I have your numbers in front of me — got 90 seconds for the short version?`;
    case "coach":
      return `Hey {{first_name}}! {{agent_name}} from {{business_name}} — you took the first step. Want to lock in the next one right now?`;
    case "rebel":
      return `{{first_name}} — {{agent_name}}, {{business_name}}. I'll skip the script. You asked about {{funnel_offer}}. What's the actual blocker?`;
    case "maestro":
      return `Good afternoon {{first_name}}, this is {{agent_name}} with {{business_name}}. Thank you for your interest in {{funnel_offer}}. Is now a convenient moment?`;
    case "funnel":
    default:
      return `Hi {{first_name}}, this is {{agent_name}} with {{business_name}} — you reached out about {{funnel_offer}}. Got a quick minute?`;
  }
}

const DEFAULT_QUALIFIERS: Record<string, string[]> = {
  en: [
    `What made you reach out today?`,
    `How soon are you looking to move forward?`,
    `Who else is involved in the decision?`,
    `Have you looked at other options?`,
  ],
  es: [
    `¿Qué le hizo contactarnos hoy?`,
    `¿Qué tan pronto quiere avanzar?`,
    `¿Hay alguien más involucrado en la decisión?`,
  ],
};

const DEFAULT_OBJECTIONS: Record<string, Array<{ objection: string; response: string }>> = {
  en: [
    { objection: "price", response: `Totally fair. Want me to send you the all-in number and you can decide if it's a fit?` },
    { objection: "not_now", response: `Got it — what would need to change for this to be a good time?` },
    { objection: "no_trust", response: `Fair. Want me to send 2 customers who started exactly where you are?` },
  ],
  es: [
    { objection: "price", response: `Entiendo. ¿Le envío el número total para que decida?` },
    { objection: "not_now", response: `Entendido — ¿qué necesitaría cambiar para que sea un buen momento?` },
  ],
};
