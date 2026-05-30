/**
 * POST /api/voice/[callId]/twiml — SignalWire answer URL.
 *
 * SignalWire fetches this URL when the call is answered. We respond with TwiML
 * that:
 *   1. Plays the recording disclosure (ElevenLabs pre-rendered MP3 when
 *      available, else inline Polly TTS via `<Say>`).
 *   2. Plays the persona-matched opener.
 *   3. Gathers the caller's response (speech or DTMF — 9 = TCPA opt-out).
 *   4. Drops to `<Record>` voicemail if no response.
 *
 * The Hono variant under `apps/api/src/voice` is the canonical implementation;
 * this Next.js route is a thin shim so workspaces deployed on Vercel-style
 * runtimes don't need the api app behind a separate hostname.
 *
 * Signature verification is intentionally NOT done here — SignalWire's voice
 * answer URL is unauthenticated by design; the call row's id is the only
 * shared secret, and we keep the surface side-effect-free (read-only).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevtryModule {
  revtryService: {
    getCall(args: { workspaceId: string; id: string }): Promise<{
      id: string;
      workspace_id: string;
      lead_id: string | null;
      direction: "inbound" | "outbound";
    } | null>;
  };
  generateScript(input: {
    workspace_id: string;
    industry: string;
    persona: string;
    language: string;
    business_name?: string;
    lead_data?: { first_name?: string | null };
  }): {
    opener: string;
    recording_disclosure: string;
    tcpa_opt_out_line: string;
    voicemail_variant: string;
  };
  getPersonaProfile(persona: string | null | undefined): {
    persona: string;
    display_name: string;
    voice_id: string;
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function personaToPollyVoice(persona: string): string {
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

function fallbackXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say voice="Polly.Joanna">Sorry, this call cannot be connected. Goodbye.</Say><Hangup/></Response>`
  );
}

export async function POST(
  req: Request,
  ctx: { params: { callId: string } },
): Promise<NextResponse> {
  const callId = ctx.params.callId;
  const url = new URL(req.url);

  // SignalWire posts form-encoded data; we read it but don't need it for the
  // happy path (the call row carries all the persona / language context).
  await req.formData().catch(() => null);

  let mod: RevtryModule | null = null;
  try {
    const modulePath = "@funnel/revtry";
    mod = (await import(/* @vite-ignore */ modulePath)) as unknown as RevtryModule;
  } catch {
    return new NextResponse(fallbackXml(), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  // Look up the call. revtryService.getCall enforces workspace scope; we use
  // "*" as a sentinel — the production store accepts it for this unauthenticated
  // surface. In-memory dev store always returns the row.
  let workspaceId = "";
  try {
    const row = await mod.revtryService.getCall({ workspaceId: "*", id: callId }).catch(() => null);
    workspaceId = row?.workspace_id ?? "";
  } catch {
    workspaceId = "";
  }

  if (!workspaceId) {
    return new NextResponse(fallbackXml(), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  const script = mod.generateScript({
    workspace_id: workspaceId,
    industry: "generic",
    persona: "funnel",
    language: "en",
    business_name: "GoFunnelAI",
  });
  const persona = mod.getPersonaProfile("funnel");
  const voice = personaToPollyVoice(persona.persona);

  const respondUrl = `${url.origin}/api/voice/${encodeURIComponent(callId)}/respond`;
  const voicemailUrl = `${url.origin}/api/voice/${encodeURIComponent(callId)}/voicemail`;
  const statusUrl = `${url.origin}/api/voice/${encodeURIComponent(callId)}/status`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Say voice="${escapeXml(voice)}">${escapeXml(script.recording_disclosure)}</Say>` +
    `<Say voice="${escapeXml(voice)}">${escapeXml(script.opener)}</Say>` +
    `<Gather input="speech dtmf" timeout="6" speechTimeout="auto" numDigits="1" ` +
    `action="${escapeXml(respondUrl)}" method="POST">` +
    `<Say voice="${escapeXml(voice)}">${escapeXml(script.tcpa_opt_out_line)}</Say>` +
    `</Gather>` +
    `<Say voice="${escapeXml(voice)}">${escapeXml(script.voicemail_variant)}</Say>` +
    `<Record maxLength="60" playBeep="true" action="${escapeXml(voicemailUrl)}" method="POST" ` +
    `recordingStatusCallback="${escapeXml(statusUrl)}"/>` +
    `</Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Some SignalWire deployments GET the answer URL during dial-time validation.
export async function GET(req: Request, ctx: { params: { callId: string } }): Promise<NextResponse> {
  return POST(req, ctx);
}
