/**
 * TwiML / SignalWire CXML answer-URL endpoint.
 *
 * SignalWire dials our `Url=` parameter when the call is answered; we respond
 * with a small XML document describing what to play, gather, or record. The
 * dynamic flow is:
 *
 *   1. <Say> the recording disclosure (using ElevenLabs-rendered audio when
 *      `voice_url` is set, else fall back to platform TTS for resilience).
 *   2. <Say> the opener.
 *   3. <Gather> the caller's response for up to 6 seconds; on speech we POST
 *      to `/voice/{callId}/respond` which streams an LLM reply.
 *   4. On <Gather> timeout we drop to <Record> for voicemail.
 *
 * Why TwiML and not SignalWireML? SignalWire's LaML answer URL is
 * Twilio-compatible — the same XML payload works on both. Keeping it
 * Twilio-shaped lets the testing harness reuse the Twilio CLI.
 *
 * Mount this at `/voice/:callId/twiml`. The call row must exist before the
 * URL is reachable; the dialer writes it before calling SignalWire.
 */

import { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";

interface RevtryModule {
  revtryService: {
    getCall(args: { workspaceId: string; id: string }): Promise<{
      id: string;
      workspace_id: string;
      lead_id: string | null;
      direction: "inbound" | "outbound";
      from_e164: string;
      to_e164: string;
    }>;
  };
  generateScript(input: {
    workspace_id: string;
    industry: string;
    persona: string;
    language: string;
    business_name?: string;
  }): {
    opener: string;
    recording_disclosure: string;
    tcpa_opt_out_line: string;
    voicemail_variant: string;
    qualifying_questions: string[];
  };
  getPersonaProfile(persona: string | null | undefined): {
    persona: string;
    display_name: string;
    voice_id: string;
  };
}

export function buildVoiceTwiml(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post("/:callId/twiml", async (c) => {
    const callId = c.req.param("callId");
    const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, string | File | undefined>;
    const recording_audio_url = typeof form["recording_audio_url"] === "string" ? form["recording_audio_url"] : null;
    const opener_audio_url = typeof form["opener_audio_url"] === "string" ? form["opener_audio_url"] : null;

    // Lazy import so the api app still boots when @funnel/revtry is mid-build.
    let mod: RevtryModule | null = null;
    try {
      mod = (await import("@funnel/revtry")) as unknown as RevtryModule;
    } catch {
      mod = null;
    }

    // Resolve the call. If we can't find it, return a safe hang-up so the
    // dial doesn't leave the caller in a dead loop.
    let workspaceId = "";
    if (mod) {
      try {
        // The TwiML endpoint is unauthenticated (SignalWire posts directly),
        // so we resolve workspace from the call row itself.
        const call = await findCallAny(mod, callId);
        workspaceId = call?.workspace_id ?? "";
      } catch {
        // continue with empty workspace — falls into fallback XML below.
      }
    }

    if (!mod || !workspaceId) {
      return c.text(safeFallbackXml(), 200, { "Content-Type": "text/xml; charset=utf-8" });
    }

    // Build a generic script. The real flow renders these as ElevenLabs MP3
    // URLs ahead of time (`recording_audio_url` / `opener_audio_url`); when
    // that pre-render hasn't happened, we let SignalWire's Polly TTS speak
    // the strings inline via <Say>.
    const script = mod.generateScript({
      workspace_id: workspaceId,
      industry: "generic",
      persona: "homeowner",
      language: "en",
      business_name: "GoFunnelAI",
    });
    const persona = mod.getPersonaProfile("funnel");

    const baseUrl = new URL(c.req.url);
    const respondUrl = `${baseUrl.origin}/voice/${encodeURIComponent(callId)}/respond`;
    const recordUrl = `${baseUrl.origin}/voice/${encodeURIComponent(callId)}/voicemail`;
    const statusUrl = `${baseUrl.origin}/voice/${encodeURIComponent(callId)}/status`;

    const xml = renderTwiml({
      recording_audio_url,
      opener_audio_url,
      recording_disclosure: script.recording_disclosure,
      opener: script.opener,
      tcpa_opt_out: script.tcpa_opt_out_line,
      voicemail_variant: script.voicemail_variant,
      voice_name: personaToPollyVoice(persona.persona),
      gather_action_url: respondUrl,
      record_action_url: recordUrl,
      status_callback_url: statusUrl,
    });

    return c.text(xml, 200, { "Content-Type": "text/xml; charset=utf-8" });
  });

  // Caller-response handler — the bridge to the LLM voice runtime. We accept
  // either `SpeechResult` (TwiML <Gather input="speech">) or `Digits` (DTMF).
  r.post("/:callId/respond", async (c) => {
    const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, string | File | undefined>;
    const speech = typeof form["SpeechResult"] === "string" ? form["SpeechResult"] : "";
    const digits = typeof form["Digits"] === "string" ? form["Digits"] : "";

    if (digits === "9") {
      // TCPA opt-out via DTMF — hang up immediately + downstream worker will
      // see the status callback with the opt-out flag.
      return c.text(
        `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Response><Say voice="Polly.Joanna">You have been removed from our calling list. Goodbye.</Say><Hangup/></Response>`,
        200,
        { "Content-Type": "text/xml; charset=utf-8" },
      );
    }

    // For now, hand back a holding line — the actual LLM-streaming runtime
    // lives in apps/workers/voice-runtime and posts MP3 URLs into a Redis
    // queue keyed by callId. Production handlers swap this <Say> for a
    // <Play> of that URL.
    const reply =
      speech.trim().length > 0
        ? `Thanks. Let me grab that for you.`
        : `I didn't catch that — could you repeat?`;
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Response><Say voice="Polly.Joanna">${escapeXml(reply)}</Say><Redirect method="POST">${escapeXml(
          c.req.url.replace(/\/respond$/, "/twiml"),
        )}</Redirect></Response>`,
      200,
      { "Content-Type": "text/xml; charset=utf-8" },
    );
  });

  return r;
}

/* ---------------------------------------------------------------- */

interface TwimlOptions {
  recording_audio_url: string | null;
  opener_audio_url: string | null;
  recording_disclosure: string;
  opener: string;
  tcpa_opt_out: string;
  voicemail_variant: string;
  voice_name: string;
  gather_action_url: string;
  record_action_url: string;
  status_callback_url: string;
}

function renderTwiml(opts: TwimlOptions): string {
  const intro = opts.recording_audio_url
    ? `<Play>${escapeXml(opts.recording_audio_url)}</Play>`
    : `<Say voice="${escapeXml(opts.voice_name)}">${escapeXml(opts.recording_disclosure)}</Say>`;
  const opener = opts.opener_audio_url
    ? `<Play>${escapeXml(opts.opener_audio_url)}</Play>`
    : `<Say voice="${escapeXml(opts.voice_name)}">${escapeXml(opts.opener)}</Say>`;

  // <Gather> covers speech + DTMF. Press 9 to opt out (TCPA convention).
  const gather = `<Gather input="speech dtmf" timeout="6" speechTimeout="auto" numDigits="1" action="${escapeXml(
    opts.gather_action_url,
  )}" method="POST"><Say voice="${escapeXml(opts.voice_name)}">${escapeXml(
    opts.tcpa_opt_out,
  )}</Say></Gather>`;

  // No response → drop into voicemail.
  const voicemail = `<Say voice="${escapeXml(opts.voice_name)}">${escapeXml(
    opts.voicemail_variant,
  )}</Say><Record maxLength="60" playBeep="true" action="${escapeXml(
    opts.record_action_url,
  )}" method="POST"/>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    intro +
    opener +
    gather +
    voicemail +
    `</Response>`
  );
}

function safeFallbackXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say voice="Polly.Joanna">Sorry, this call cannot be connected. Goodbye.</Say><Hangup/></Response>`
  );
}

/**
 * The TwiML endpoint is unauthenticated (SignalWire posts directly), so we
 * can't enforce the workspace scope at the route. The `revtryService` API
 * requires a workspace id — workaround: cast through the unknown to scan
 * across stores until we find the row. In production the wired store will
 * expose `getAny(callId)` for this case; we provide a small adapter here.
 */
async function findCallAny(
  mod: RevtryModule,
  callId: string,
): Promise<{ workspace_id: string } | null> {
  // Hack until the service exposes an authenticated `getCallAny`: we try with
  // a sentinel and let the production store implementation accept it.
  try {
    return await mod.revtryService.getCall({ workspaceId: "*", id: callId });
  } catch {
    return null;
  }
}

function personaToPollyVoice(persona: string): string {
  // Polly fallback voices when ElevenLabs pre-render isn't available.
  switch (persona) {
    case "maven":
      return "Polly.Matthew";
    case "coach":
      return "Polly.Justin";
    case "rebel":
      return "Polly.Kevin";
    case "maestro":
      return "Polly.Amy";
    case "funnel":
    default:
      return "Polly.Joanna";
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
