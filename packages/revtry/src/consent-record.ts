/**
 * Consent + recording ledger.
 *
 *   - Every call (outbound or inbound-recorded) plays a preamble in the first
 *     7 seconds before LLM dialogue starts.
 *   - We persist a `consent_ledger.voice` row before the LLM is allowed to
 *     speak — recording disposition, state rule, retention window.
 *   - Retention: 7 years per Doc 07a §13.2 (regulated industries) and the
 *     RevTry-specific 7-year retention requested in the build sheet.
 */

import { consentRuleForState } from "./state-rules.js";
import type { Call, ConsentLedgerEntry, StateConsentRule } from "./types.js";

export interface ConsentLedgerStore {
  insert(row: ConsentLedgerEntry): Promise<ConsentLedgerEntry>;
  hasOptOut(e164: string): Promise<boolean>;
  recordOptOut(e164: string, reason: string): Promise<void>;
}

export const PREAMBLE_TEMPLATE = (agent_name: string, business_name: string) =>
  `Hi, this is ${agent_name} calling on behalf of ${business_name}. This call is being recorded for quality and compliance. If you'd prefer not to be recorded, say 'opt out' now and I'll end the call.`;

export const RETENTION_YEARS = 7;

export function retentionUntil(startIso: string): string {
  const t = new Date(startIso);
  t.setUTCFullYear(t.getUTCFullYear() + RETENTION_YEARS);
  return t.toISOString();
}

export interface ConsentRecordDeps {
  store: ConsentLedgerStore;
  newId: (entity: "consent") => string;
  clock?: { iso(): string };
}
const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Record the preamble played + opt-out decision before LLM dialogue starts.
 * Returns `state_rule` so the caller knows whether to gate recording.
 */
export async function recordPreamble(
  args: {
    call_id: string;
    e164: string;
    direction: Call["direction"];
    callee_state_iso2: string | null;
    opt_out_detected: boolean;
    recording_url: string | null;
  },
  deps: ConsentRecordDeps,
): Promise<{ entry: ConsentLedgerEntry; state_rule: StateConsentRule }> {
  const clock = deps.clock ?? defaultClock;
  const rule = consentRuleForState(args.callee_state_iso2);
  const now = clock.iso();
  const entry: ConsentLedgerEntry = {
    id: deps.newId("consent"),
    call_id: args.call_id,
    e164: args.e164,
    direction: args.direction,
    preamble_played_at: now,
    opt_out_detected: args.opt_out_detected,
    state_rule: rule,
    call_recording_url: args.recording_url ?? null,
    retention_until: retentionUntil(now),
    created_at: now,
  };
  const inserted = await deps.store.insert(entry);
  if (args.opt_out_detected) {
    await deps.store.recordOptOut(args.e164, "voice_optout_inline");
  }
  return { entry: inserted, state_rule: rule };
}
