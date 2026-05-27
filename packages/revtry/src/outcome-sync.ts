/**
 * Outcome sync.
 *
 * SignalWire posts status webhooks; the LLM runtime posts outcomes (qualified,
 * booked, voicemail, dnc, transferred, etc.). We:
 *   1. Update the call row with the outcome + duration + recording URL.
 *   2. Charge the minutes ledger.
 *   3. Sync the outcome to the CRM via the injected sink.
 *   4. Emit `revtry_call_completed`.
 */

import { consume } from "./minutes-ledger.js";
import type { MinutesLedgerDeps } from "./minutes-ledger.js";
import type { CallStore } from "./store.js";
import type { Call, CallOutcome } from "./types.js";

export interface CrmSyncSink {
  recordCallOutcome(args: {
    workspace_id: string;
    lead_id: string | null;
    call_id: string;
    outcome: CallOutcome;
    transcript_url: string | null;
    recording_url: string | null;
    duration_sec: number;
  }): Promise<void>;
}

export interface OutcomeSyncDeps {
  store: CallStore;
  ledger: MinutesLedgerDeps;
  crm: CrmSyncSink;
  clock?: { iso(): string };
  emit?: (
    name: "revtry_call_completed",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export interface OutcomeWebhookPayload {
  call_id: string;
  outcome: CallOutcome;
  duration_sec: number;
  recording_url?: string | null;
  transcript_url?: string | null;
  hangup_reason?: string | null;
}

export async function recordOutcome(
  args: OutcomeWebhookPayload,
  deps: OutcomeSyncDeps,
): Promise<Call> {
  const clock = deps.clock ?? defaultClock;
  const cur = await deps.store.get(args.call_id);
  if (!cur) throw new Error("call not found");
  if (cur.outcome) return cur; // idempotent

  const cycle = clock.iso().slice(0, 7); // YYYY-MM
  await consume(
    {
      workspace_id: cur.workspace_id,
      cycle,
      call_id: cur.id,
      duration_sec: args.duration_sec,
    },
    deps.ledger,
  );

  const next = await deps.store.markOutcome(args.call_id, args.outcome, {
    duration_sec: args.duration_sec,
    recording_url: args.recording_url ?? cur.recording_url,
    transcript_url: args.transcript_url ?? cur.transcript_url,
    hangup_reason: args.hangup_reason ?? cur.hangup_reason,
    state: "completed",
    ended_at: clock.iso(),
  });

  await deps.crm.recordCallOutcome({
    workspace_id: next.workspace_id,
    lead_id: next.lead_id,
    call_id: next.id,
    outcome: args.outcome,
    transcript_url: next.transcript_url,
    recording_url: next.recording_url,
    duration_sec: next.duration_sec,
  });

  if (deps.emit) {
    await deps.emit("revtry_call_completed", {
      call_id: next.id,
      workspace_id: next.workspace_id,
      lead_id: next.lead_id,
      outcome: next.outcome,
      duration_sec: next.duration_sec,
    });
  }
  return next;
}
