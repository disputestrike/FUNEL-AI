/**
 * RevTry domain types.
 *
 * Telephony provider is SignalWire (NOT Twilio). The provider is injected via
 * `SignalWireClient` so a higher-tier provider (or an additional fallback) can
 * be slotted in without changing call sites.
 */

import { z } from "zod";

export const CallDirectionEnum = z.enum(["outbound", "inbound"]);
export type CallDirection = z.infer<typeof CallDirectionEnum>;

export const CallStateEnum = z.enum([
  "queued",
  "ringing",
  "in_progress",
  "transferring",
  "completed",
  "no_answer",
  "voicemail",
  "busy",
  "failed",
  "blocked_dnc",
  "blocked_consent",
  "blocked_quiet_hours",
]);
export type CallState = z.infer<typeof CallStateEnum>;

export const CallOutcomeEnum = z.enum([
  "qualified",
  "booked",
  "voicemail",
  "dnc",
  "transferred",
  "no_pickup",
  "wrong_number",
  "not_qualified",
  "callback_requested",
  "opted_out",
]);
export type CallOutcome = z.infer<typeof CallOutcomeEnum>;

export const ConsentRecordingDispositionEnum = z.enum([
  "preamble_played",
  "opted_out",
  "continued",
  "n/a_one_party",
]);
export type ConsentRecordingDisposition = z.infer<typeof ConsentRecordingDispositionEnum>;

export const StateConsentRuleEnum = z.enum(["one_party", "two_party"]);
export type StateConsentRule = z.infer<typeof StateConsentRuleEnum>;

export const CallSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  lead_id: z.string().min(1).nullable(),
  funnel_id: z.string().min(1).nullable(),
  direction: CallDirectionEnum,
  from_e164: z.string(),
  to_e164: z.string(),
  language: z.string().default("en"),
  script_version: z.string().nullable(),
  provider: z.enum(["signalwire"]).default("signalwire"),
  provider_call_id: z.string().nullable(),
  state: CallStateEnum,
  duration_sec: z.number().int().nonnegative().default(0),
  recording_url: z.string().url().nullable(),
  recording_retention_until: z.string().datetime().nullable(),
  outcome: CallOutcomeEnum.nullable(),
  transcript_url: z.string().url().nullable(),
  consent_recording: ConsentRecordingDispositionEnum.nullable(),
  consent_state_rule: StateConsentRuleEnum.nullable(),
  hangup_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
});
export type Call = z.infer<typeof CallSchema>;

export const ScriptSchema = z.object({
  workspace_id: z.string().min(1),
  industry: z.string(),
  persona: z.string(),
  language: z.string(),
  opener: z.string(),
  qualifying_questions: z.array(z.string()),
  objection_handlers: z.array(z.object({ objection: z.string(), response: z.string() })),
  booking_close: z.string(),
  voicemail_variant: z.string(),
  tcpa_opt_out_line: z.string(),
  recording_disclosure: z.string(),
  version: z.string(),
  updated_at: z.string().datetime(),
});
export type Script = z.infer<typeof ScriptSchema>;

export const MinutesLedgerEntrySchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  cycle_yyyy_mm: z.string().regex(/^\d{4}-\d{2}$/),
  call_id: z.string().min(1).nullable(),
  /** Negative = consumed; positive = top-up. */
  minutes_delta: z.number(),
  reason: z.enum(["consumed", "topup", "plan_credit", "overage", "refund"]),
  cost_cents_overage: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
});
export type MinutesLedgerEntry = z.infer<typeof MinutesLedgerEntrySchema>;

export const ConsentLedgerEntrySchema = z.object({
  id: z.string().min(1),
  call_id: z.string().min(1),
  e164: z.string(),
  direction: CallDirectionEnum,
  preamble_played_at: z.string().datetime(),
  opt_out_detected: z.boolean(),
  state_rule: StateConsentRuleEnum,
  call_recording_url: z.string().url().nullable(),
  retention_until: z.string().datetime(),
  created_at: z.string().datetime(),
});
export type ConsentLedgerEntry = z.infer<typeof ConsentLedgerEntrySchema>;

export const DialInputSchema = z.object({
  workspace_id: z.string().min(1),
  lead_id: z.string().min(1),
  funnel_id: z.string().min(1).nullable(),
  from_e164: z.string().regex(/^\+\d{8,15}$/),
  to_e164: z.string().regex(/^\+\d{8,15}$/),
  language: z.string().default("en"),
  callee_local_hour: z.number().int().min(0).max(23),
  callee_state_iso: z.string().nullable().optional(),
});
export type DialInput = z.infer<typeof DialInputSchema>;
