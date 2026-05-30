/**
 * Demo / dev-mode simulator for the RevTry speed-to-lead flow.
 *
 * When SIGNALWIRE_PROJECT_ID is unset (or NODE_ENV=development with an
 * explicit `REVTRY_DEMO_MODE=1`), we don't have a way to place a real call.
 * The simulator drives the same state machine on a wall-clock timer so the
 * dashboard sees:
 *
 *   t+0s   → lead_captured  (call_id allocated, state="queued")
 *   t+5s   → dialing        (state="ringing")
 *   t+12s  → connected      (state="in_progress")
 *   t+25s  → completed      (state="completed", outcome="booked")
 *
 * The simulator emits the same internal events the real path emits so the
 * UI updates without any code branching:
 *   - revtry_call_started
 *   - revtry_call_progress (custom, demo-only — useful for transcript stream)
 *   - revtry_call_completed
 *
 * Wire in `apps/workers/src/workers/speed-to-lead.ts` by branching on
 * `isDemoMode()` and calling `simulateOutboundCall` instead of the real
 * `placeOutboundCall`. Both share the same return shape.
 */

import { generateScript } from "./scripts.js";
import type { CallStore } from "./store.js";
import { consentRuleForState } from "./state-rules.js";
import type { Call, CallOutcome } from "./types.js";

export interface DemoDeps {
  store: CallStore;
  newId: (entity: "revtryCall") => string;
  clock?: { iso(): string; nowMs(): number };
  emit?: (
    name: "revtry_call_started" | "revtry_call_progress" | "revtry_call_completed",
    payload: Record<string, unknown>,
  ) => Promise<void> | void;
  /** Default 1.0; set lower to fast-forward time in tests (0.01 = 100x). */
  speedFactor?: number;
}

const defaultClock = { iso: () => new Date().toISOString(), nowMs: () => Date.now() };

export interface SimulateInput {
  workspace_id: string;
  lead_id: string;
  funnel_id: string | null;
  from_e164: string;
  to_e164: string;
  language?: string;
  industry?: string;
  persona?: string;
  first_name?: string | null;
  business_name?: string | null;
  /** Force an outcome instead of the default "booked". */
  force_outcome?: CallOutcome;
}

export interface SimulateResult {
  call: Call;
  /** Resolves after the simulated completion event has fired. */
  completion: Promise<Call>;
}

/**
 * Returns true when we should skip the real telephony path. Default rule:
 *   - REVTRY_DEMO_MODE=1 always wins (forces demo).
 *   - Otherwise: NODE_ENV!=="production" AND no SIGNALWIRE_PROJECT_ID.
 */
export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  if (env.REVTRY_DEMO_MODE === "1" || env.REVTRY_DEMO_MODE === "true") return true;
  if (env.NODE_ENV === "production") return false;
  return !env.SIGNALWIRE_PROJECT_ID || !env.SIGNALWIRE_API_TOKEN;
}

/**
 * Drive a fake call through the state machine. Returns immediately with the
 * `queued` row; `result.completion` resolves when the simulator finishes.
 */
export function simulateOutboundCall(input: SimulateInput, deps: DemoDeps): SimulateResult {
  const clock = deps.clock ?? defaultClock;
  const speed = deps.speedFactor ?? 1;
  const id = deps.newId("revtryCall");
  const language = input.language ?? "en";

  // Build the script for the demo so the UI can render an opener.
  const script = generateScript({
    workspace_id: input.workspace_id,
    industry: input.industry ?? "generic",
    persona: input.persona ?? "homeowner",
    language,
    business_name: input.business_name ?? "GoFunnelAI",
  });

  const baseCall: Call = {
    id,
    workspace_id: input.workspace_id,
    lead_id: input.lead_id,
    funnel_id: input.funnel_id,
    direction: "outbound",
    from_e164: input.from_e164,
    to_e164: input.to_e164,
    language,
    script_version: script.version,
    provider: "signalwire",
    provider_call_id: `demo_${id}`,
    state: "queued",
    duration_sec: 0,
    recording_url: null,
    recording_retention_until: null,
    outcome: null,
    transcript_url: null,
    consent_recording: null,
    consent_state_rule: consentRuleForState(null),
    hangup_reason: null,
    created_at: clock.iso(),
    started_at: null,
    ended_at: null,
  };

  const insertPromise = deps.store.insert(baseCall);

  const completion: Promise<Call> = (async () => {
    await insertPromise;

    // t+5s — Dialing.
    await delay(5_000 * speed);
    const ringing = await deps.store.updateState(id, "ringing", { started_at: clock.iso() });
    await deps.emit?.("revtry_call_started", {
      call_id: id,
      workspace_id: input.workspace_id,
      lead_id: input.lead_id,
      to_e164: input.to_e164,
      demo: true,
    });

    // t+12s — Connected.
    await delay(7_000 * speed);
    const connected = await deps.store.updateState(id, "in_progress", {
      consent_recording: "preamble_played",
    });
    await deps.emit?.("revtry_call_progress", {
      call_id: id,
      stage: "connected",
      transcript_preview: script.opener.replace("{{first_name}}", input.first_name ?? "there"),
      demo: true,
    });

    // t+25s — Completed (qualified + booked by default).
    await delay(13_000 * speed);
    const outcome: CallOutcome = input.force_outcome ?? "booked";
    const completed = await deps.store.markOutcome(id, outcome, {
      duration_sec: 25,
      state: "completed",
      ended_at: clock.iso(),
      transcript_url: `https://demo.gofunnelai.com/transcripts/${id}.json`,
    });
    await deps.emit?.("revtry_call_completed", {
      call_id: id,
      workspace_id: input.workspace_id,
      lead_id: input.lead_id,
      outcome,
      duration_sec: 25,
      demo: true,
    });
    return completed;
  })();

  // Surface the in-flight error to the caller — but don't let it become an
  // unhandled rejection on the side channel.
  completion.catch(() => {});

  return { call: baseCall, completion };
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((res) => setTimeout(res, ms));
}
