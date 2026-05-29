/**
 * Outbound dialer.
 *
 * Pipeline (60-second SLA from lead-arrives → first ring):
 *   1. DNC check (hard gate — federal + state + internal).
 *   2. Voice-DNC opt-out check via consent_ledger.
 *   3. TCPA hours + Sunday opt-in.
 *   4. Quiet hours / state-rule guard.
 *   5. Place the call via SignalWire adapter (fallback configured at the
 *      adapter level — we keep the dialer logic provider-agnostic).
 *   6. Persist the call row in `queued` → `ringing`.
 *
 * The actual LLM dialogue is driven by `apps/workers/voice-runtime`; this
 * module exposes the placement function.
 */

import { recordPreamble } from "./consent-record.js";
import type { ConsentLedgerStore } from "./consent-record.js";
import { consentRuleForState, withinTcpaHours } from "./state-rules.js";
import type { CallStore } from "./store.js";
import type { Call, DialInput } from "./types.js";

export interface DncChecker {
  isOnFederalDnc(e164: string): Promise<boolean>;
  isOnStateDnc(e164: string, state_iso2: string | null | undefined): Promise<boolean>;
  isOnInternalDnc(e164: string): Promise<boolean>;
}

export interface SignalWireClient {
  /** Place an outbound call. Returns the provider-side call id. */
  placeCall(args: {
    from_e164: string;
    to_e164: string;
    answer_url: string;        // SignalWire CXML / LaML endpoint
    status_callback_url: string;
    language: string;
  }): Promise<{ provider_call_id: string }>;
}

/**
 * Optional gates injected by the caller. These run AFTER the structural DNC
 * gate and BEFORE we hand off to SignalWire — both fail-closed if the lookup
 * throws (we'd rather block a legit call than place a non-compliant one).
 */
export interface ExtraGates {
  /** Resolve true when the lead has an active PEWC voice consent on file. */
  hasVoiceConsent?: (args: { workspace_id: string; phone_e164: string; lead_id: string }) => Promise<boolean>;
  /** Remaining voice minutes for the workspace; <=0 blocks the dial. */
  remainingMinutes?: (workspace_id: string) => Promise<number>;
}

export interface DialDeps {
  store: CallStore;
  consentStore: ConsentLedgerStore;
  newId: (entity: "revtryCall") => string;
  dnc: DncChecker;
  signalwire: SignalWireClient;
  answerUrlFor: (call_id: string) => string;
  statusCallbackUrlFor: (call_id: string) => string;
  clock?: { iso(): string };
  emit?: (
    name: "revtry_call_started" | "revtry_call_blocked" | "revtry_sla_breached",
    payload: Record<string, unknown>,
  ) => Promise<void>;
  /** Optional: ms since lead capture. Used to alert if the dial breaches the 60-sec SLA. */
  lead_captured_ms_ago?: number;
  /** Optional extra gates (PEWC consent record, minutes balance). */
  gates?: ExtraGates;
}

/** PRD §3 — 60 sec wall from lead capture → first ring. */
export const SLA_BUDGET_MS = 60_000;

const defaultClock = { iso: () => new Date().toISOString() };

export interface DialResult {
  call: Call;
  blocked_reason: string | null;
}

export async function placeOutboundCall(input: DialInput, deps: DialDeps): Promise<DialResult> {
  const clock = deps.clock ?? defaultClock;
  const id = deps.newId("revtryCall");
  const baseCall: Call = {
    id,
    workspace_id: input.workspace_id,
    lead_id: input.lead_id,
    funnel_id: input.funnel_id,
    direction: "outbound",
    from_e164: input.from_e164,
    to_e164: input.to_e164,
    language: input.language,
    script_version: null,
    provider: "signalwire",
    provider_call_id: null,
    state: "queued",
    duration_sec: 0,
    recording_url: null,
    recording_retention_until: null,
    outcome: null,
    transcript_url: null,
    consent_recording: null,
    consent_state_rule: consentRuleForState(input.callee_state_iso),
    hangup_reason: null,
    created_at: clock.iso(),
    started_at: null,
    ended_at: null,
  };
  await deps.store.insert(baseCall);

  // Hard-gate: DNC checks. Federal + state + internal voice opt-outs.
  const [federal, state, internal, voice_opted_out] = await Promise.all([
    deps.dnc.isOnFederalDnc(input.to_e164),
    deps.dnc.isOnStateDnc(input.to_e164, input.callee_state_iso ?? null),
    deps.dnc.isOnInternalDnc(input.to_e164),
    deps.consentStore.hasOptOut(input.to_e164),
  ]);
  if (federal || state || internal || voice_opted_out) {
    const updated = await deps.store.updateState(id, "blocked_dnc", {
      hangup_reason: federal
        ? "federal_dnc"
        : state
          ? "state_dnc"
          : voice_opted_out
            ? "voice_opted_out"
            : "internal_dnc",
    });
    if (deps.emit) {
      await deps.emit("revtry_call_blocked", { call_id: id, reason: updated.hangup_reason });
    }
    return { call: updated, blocked_reason: updated.hangup_reason ?? "dnc" };
  }

  // PEWC consent gate — only fires when the caller wired a checker. Missing
  // consent is a HARD block (FCC 2024 ruling on AI voice).
  if (deps.gates?.hasVoiceConsent) {
    let hasConsent = false;
    try {
      hasConsent = await deps.gates.hasVoiceConsent({
        workspace_id: input.workspace_id,
        phone_e164: input.to_e164,
        lead_id: input.lead_id,
      });
    } catch {
      hasConsent = false; // fail closed
    }
    if (!hasConsent) {
      const updated = await deps.store.updateState(id, "blocked_consent", {
        hangup_reason: "no_voice_consent",
      });
      if (deps.emit) {
        await deps.emit("revtry_call_blocked", { call_id: id, reason: "no_voice_consent" });
      }
      return { call: updated, blocked_reason: "no_voice_consent" };
    }
  }

  // Minutes gate — block when the workspace has no remaining voice minutes.
  if (deps.gates?.remainingMinutes) {
    let remaining = 1;
    try {
      remaining = await deps.gates.remainingMinutes(input.workspace_id);
    } catch {
      remaining = 0; // fail closed
    }
    if (remaining <= 0) {
      const updated = await deps.store.updateState(id, "failed", {
        hangup_reason: "no_minutes",
      });
      if (deps.emit) {
        await deps.emit("revtry_call_blocked", { call_id: id, reason: "no_minutes" });
      }
      return { call: updated, blocked_reason: "no_minutes" };
    }
  }

  // TCPA quiet hours.
  if (!withinTcpaHours(input.callee_local_hour)) {
    const updated = await deps.store.updateState(id, "blocked_quiet_hours", {
      hangup_reason: "tcpa_quiet_hours",
    });
    if (deps.emit) {
      await deps.emit("revtry_call_blocked", { call_id: id, reason: "tcpa_quiet_hours" });
    }
    return { call: updated, blocked_reason: "tcpa_quiet_hours" };
  }

  // Place the call via SignalWire.
  const { provider_call_id } = await deps.signalwire.placeCall({
    from_e164: input.from_e164,
    to_e164: input.to_e164,
    answer_url: deps.answerUrlFor(id),
    status_callback_url: deps.statusCallbackUrlFor(id),
    language: input.language,
  });
  const ringing = await deps.store.updateState(id, "ringing", {
    provider_call_id,
    started_at: clock.iso(),
  });
  if (deps.emit) {
    await deps.emit("revtry_call_started", {
      call_id: id,
      workspace_id: input.workspace_id,
      lead_id: input.lead_id,
      to_e164: input.to_e164,
    });
    // 60-sec speed-to-lead SLA — fire an alert event so monitoring can
    // page if we ever breach the budget. We do this AFTER the call is
    // placed; missing the budget is not a hard failure (the call still
    // goes out).
    if (
      typeof deps.lead_captured_ms_ago === "number" &&
      deps.lead_captured_ms_ago > SLA_BUDGET_MS
    ) {
      await deps.emit("revtry_sla_breached", {
        call_id: id,
        workspace_id: input.workspace_id,
        lead_id: input.lead_id,
        elapsed_ms: deps.lead_captured_ms_ago,
        budget_ms: SLA_BUDGET_MS,
      });
    }
  }
  return { call: ringing, blocked_reason: null };
}
