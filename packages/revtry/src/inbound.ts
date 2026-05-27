/**
 * Inbound call handler.
 *
 *   - SignalWire posts to our answer URL with the inbound caller's E.164.
 *   - We persist the call row, play the recording preamble, then hand off to
 *     the LLM voice runtime.
 */

import { recordPreamble } from "./consent-record.js";
import type { ConsentLedgerStore } from "./consent-record.js";
import { consentRuleForState } from "./state-rules.js";
import type { CallStore } from "./store.js";
import type { Call } from "./types.js";

export interface InboundDeps {
  store: CallStore;
  consentStore: ConsentLedgerStore;
  newId: (entity: "revtryCall") => string;
  clock?: { iso(): string };
  /** Recording URL of the in-progress call (SignalWire returns it). */
  recordingUrlFor?: (provider_call_id: string) => string | null;
  /** Lookup the workspace owner of the inbound number. */
  resolveWorkspaceForInboundNumber: (e164: string) => Promise<string | null>;
  emit?: (
    name: "revtry_inbound_received" | "revtry_inbound_blocked",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export interface InboundInput {
  provider_call_id: string;
  from_e164: string;
  to_e164: string;
  callee_state_iso2?: string | null;
  language?: string;
}

export async function handleInbound(input: InboundInput, deps: InboundDeps): Promise<Call> {
  const clock = deps.clock ?? defaultClock;
  const workspace_id = await deps.resolveWorkspaceForInboundNumber(input.to_e164);
  if (!workspace_id) {
    // We received a call to a number we don't own — drop silently with a row.
    return deps.store.insert({
      id: deps.newId("revtryCall"),
      workspace_id: "unknown",
      lead_id: null,
      funnel_id: null,
      direction: "inbound",
      from_e164: input.from_e164,
      to_e164: input.to_e164,
      language: input.language ?? "en",
      script_version: null,
      provider: "signalwire",
      provider_call_id: input.provider_call_id,
      state: "failed",
      duration_sec: 0,
      recording_url: null,
      recording_retention_until: null,
      outcome: null,
      transcript_url: null,
      consent_recording: null,
      consent_state_rule: null,
      hangup_reason: "unowned_number",
      created_at: clock.iso(),
      started_at: null,
      ended_at: null,
    });
  }

  // Opt-out check.
  if (await deps.consentStore.hasOptOut(input.from_e164)) {
    return deps.store.insert({
      id: deps.newId("revtryCall"),
      workspace_id,
      lead_id: null,
      funnel_id: null,
      direction: "inbound",
      from_e164: input.from_e164,
      to_e164: input.to_e164,
      language: input.language ?? "en",
      script_version: null,
      provider: "signalwire",
      provider_call_id: input.provider_call_id,
      state: "blocked_consent",
      duration_sec: 0,
      recording_url: null,
      recording_retention_until: null,
      outcome: "opted_out",
      transcript_url: null,
      consent_recording: "opted_out",
      consent_state_rule: consentRuleForState(input.callee_state_iso2),
      hangup_reason: "caller_opted_out",
      created_at: clock.iso(),
      started_at: null,
      ended_at: null,
    });
  }

  const call: Call = {
    id: deps.newId("revtryCall"),
    workspace_id,
    lead_id: null,
    funnel_id: null,
    direction: "inbound",
    from_e164: input.from_e164,
    to_e164: input.to_e164,
    language: input.language ?? "en",
    script_version: null,
    provider: "signalwire",
    provider_call_id: input.provider_call_id,
    state: "in_progress",
    duration_sec: 0,
    recording_url: deps.recordingUrlFor?.(input.provider_call_id) ?? null,
    recording_retention_until: null,
    outcome: null,
    transcript_url: null,
    consent_recording: "preamble_played",
    consent_state_rule: consentRuleForState(input.callee_state_iso2),
    hangup_reason: null,
    created_at: clock.iso(),
    started_at: clock.iso(),
    ended_at: null,
  };
  const inserted = await deps.store.insert(call);

  await recordPreamble(
    {
      call_id: inserted.id,
      e164: input.from_e164,
      direction: "inbound",
      callee_state_iso2: input.callee_state_iso2 ?? null,
      opt_out_detected: false,
      recording_url: inserted.recording_url,
    },
    { store: deps.consentStore, newId: () => `consent_${inserted.id}` },
  );

  if (deps.emit) {
    await deps.emit("revtry_inbound_received", {
      call_id: inserted.id,
      workspace_id,
      from_e164: input.from_e164,
    });
  }
  return inserted;
}
