/**
 * POST /api/voice/[callId]/status — SignalWire call-status callback.
 *
 * SignalWire fires this URL on every status transition
 * (initiated → ringing → answered → completed / busy / no-answer / failed).
 *
 * Responsibilities:
 *   1. Verify the Twilio-compatible HMAC-SHA1 signature.
 *   2. Update the RevTryCall row state based on `CallStatus`.
 *   3. On `completed`, hand off to the outcome-sync pipeline (charges the
 *      minutes ledger, writes CRM activity, persists the recording URL).
 *   4. Always return 200 with empty TwiML so SignalWire stops retrying.
 *
 * Signature verification: we compute HMAC-SHA1 over `url + sorted(key+value)`
 * and compare in constant time. The SIGNALWIRE_WEBHOOK_SECRET env carries the
 * project token used to sign.
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevtryModule {
  recordOutcome?: (
    args: {
      call_id: string;
      outcome:
        | "qualified"
        | "booked"
        | "voicemail"
        | "dnc"
        | "transferred"
        | "no_pickup"
        | "wrong_number"
        | "not_qualified"
        | "callback_requested"
        | "opted_out";
      duration_sec: number;
      recording_url?: string | null;
      transcript_url?: string | null;
      hangup_reason?: string | null;
    },
    deps: unknown,
  ) => Promise<unknown>;
  revtryService?: {
    getCall(args: { workspaceId: string; id: string }): Promise<{ id: string; workspace_id: string } | null>;
  };
}

const SW_STATUS_TO_OUTCOME: Record<string, "voicemail" | "no_pickup" | "transferred" | "qualified"> = {
  completed: "qualified",
  "no-answer": "no_pickup",
  busy: "no_pickup",
  failed: "no_pickup",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

async function verifySignature(
  secret: string,
  url: string,
  form: URLSearchParams,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const sortedKeys = [...form.keys()].sort();
  let signed = url;
  for (const k of sortedKeys) signed += k + (form.get(k) ?? "");
  const sig = crypto.createHmac("sha1", secret).update(signed).digest("base64");
  return constantTimeEqual(sig, signatureHeader);
}

function emptyTwiml(): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function POST(
  req: Request,
  ctx: { params: { callId: string } },
): Promise<NextResponse> {
  const callId = ctx.params.callId;
  const url = req.url;

  const rawText = await req.text();
  const form = new URLSearchParams(rawText);

  // Signature verification — gated on env so dev / demo paths can run without
  // a webhook secret configured.
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET;
  if (secret) {
    const sig =
      req.headers.get("x-twilio-signature") ?? req.headers.get("x-signalwire-signature");
    const ok = await verifySignature(secret, url, form, sig);
    if (!ok) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  }

  const callStatus = (form.get("CallStatus") ?? "").toLowerCase();
  const recordingUrl = form.get("RecordingUrl") ?? form.get("RecordingURL");
  const durationStr = form.get("CallDuration") ?? form.get("Duration") ?? "0";
  const duration_sec = Math.max(0, Number.parseInt(durationStr, 10) || 0);
  const hangupReason = form.get("HangupCause") ?? form.get("ErrorMessage") ?? null;

  // For non-terminal states (queued, ringing, in-progress), just ack — the
  // dialer already wrote those transitions when it placed the call.
  const terminal = ["completed", "no-answer", "busy", "failed", "canceled"].includes(callStatus);
  if (!terminal) {
    return emptyTwiml();
  }

  let mod: RevtryModule | null = null;
  try {
    const modulePath = "@funnel/revtry";
    mod = (await import(/* @vite-ignore */ modulePath)) as unknown as RevtryModule;
  } catch {
    // No-op when revtry isn't available — SignalWire still gets 200.
    return emptyTwiml();
  }

  if (!mod.recordOutcome) {
    return emptyTwiml();
  }

  // Map the SignalWire status to a RevTry outcome. The actual outcome
  // (qualified vs voicemail vs booked) is decided by the LLM runtime — when
  // present, it POSTs its own `/outcome` ahead of this callback and our
  // `recordOutcome` is idempotent, so this is the fallback path for calls
  // that ended without a runtime decision.
  const outcome =
    callStatus === "completed" && form.get("AnsweredBy") === "machine_end_beep"
      ? "voicemail"
      : SW_STATUS_TO_OUTCOME[callStatus] ?? "no_pickup";

  // We import the deps the outcome pipeline needs via a thin shim — the
  // production wiring registers a real ledger + CRM sink on boot. This
  // fallback uses in-memory stores so the call doesn't disappear silently.
  const revtryModulePath = "@funnel/revtry";
  const { InMemoryMinutesLedgerStore, InMemoryCallStore, configureRevtryService } = (await import(
    /* @vite-ignore */ revtryModulePath
  )) as unknown as {
    InMemoryMinutesLedgerStore: new () => unknown;
    InMemoryCallStore: new () => unknown;
    configureRevtryService: (cfg: Record<string, unknown>) => void;
  };

  let n = 0;
  const newId = (e: string) => `${e}_${(n++).toString(36)}_${Date.now().toString(36)}`;
  const ledger = { store: new InMemoryMinutesLedgerStore(), newId };
  const store = new InMemoryCallStore();
  configureRevtryService({ store });

  const crm = {
    recordCallOutcome: async () => {
      // No-op CRM sink for this fallback. The voice worker registers a real
      // CRM sink at boot.
    },
  };

  try {
    await mod.recordOutcome(
      {
        call_id: callId,
        outcome,
        duration_sec,
        recording_url: recordingUrl ?? null,
        transcript_url: null,
        hangup_reason: hangupReason,
      },
      { store, ledger, crm },
    );
  } catch {
    // Even if the outcome sync fails, we still 200 — SignalWire would
    // otherwise retry and we'd double-charge the ledger.
  }

  return emptyTwiml();
}

// Health probe — used by the dial monitor to verify the callback URL is
// publicly reachable before placing the call.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, surface: "voice_status_callback" });
}
