/**
 * Internal event bus for the CRM package.
 *
 * The canonical events live in `docs/03-event-taxonomy-and-schemas.md` §A.5.
 * `@funnel/events` v0.1 ships audit-grader events only; rather than block on
 * that backlog, we declare CRM event schemas here and emit through a
 * pluggable sink. Production bootstrap binds the sink to PostHog +
 * Cloudflare Analytics Engine; tests bind to an in-memory recorder.
 */

import { z } from "zod";

// ---- schemas (subset relevant to packages/crm) ----

const Envelope = z.object({
  workspace_id: z.string(),
  occurred_at: z.string(),
  actor_user_id: z.string().nullable().optional(),
  trace_id: z.string().optional(),
});

export const LeadCapturedSchema = Envelope.extend({
  lead_id: z.string(),
  funnel_id: z.string(),
  funnel_version_id: z.string(),
  capture_source: z.string(),
  consent_id: z.string().nullable(),
  contact_fields_hashed: z.object({
    email_sha256: z.string().nullable(),
    phone_e164_sha256: z.string().nullable(),
  }),
  utm: z.record(z.string()).optional(),
  ip_hash: z.string().nullable().optional(),
  geo_country: z.string().nullable().optional(),
});

export const LeadScoredSchema = Envelope.extend({
  lead_id: z.string(),
  score: z.number(),
  band: z.enum(["hot", "warm", "cold"]),
  model_version: z.string(),
  features_hash: z.string(),
  explanations: z.array(z.string()).optional(),
});

export const LeadQualifiedSchema = Envelope.extend({
  lead_id: z.string(),
  qualifier: z.string(),
  qualifier_method: z.enum(["agent", "human", "rule"]),
  criteria_id: z.string().nullable(),
});

export const LeadDisqualifiedSchema = Envelope.extend({
  lead_id: z.string(),
  reason_code: z.string(),
  disqualifier: z.string(),
});

export const LeadBookingCreatedSchema = Envelope.extend({
  lead_id: z.string(),
  booking_id: z.string(),
  calendar_event_id: z.string().nullable(),
  scheduled_for: z.string(),
  host_user_id: z.string().nullable(),
});

export const LeadBookingCanceledSchema = Envelope.extend({
  booking_id: z.string(),
  canceled_by: z.string(),
  cancel_reason: z.string().nullable(),
});

export const LeadRevtryEnqueuedSchema = Envelope.extend({
  lead_id: z.string(),
  attempt_n: z.number().int().positive(),
  scheduled_for: z.string(),
  reason: z.enum(["speed_to_lead", "retry", "manual"]),
});

export const ConsentCapturedSchema = Envelope.extend({
  consent_id: z.string(),
  channels: z.array(z.string()),
  subject_kind: z.enum(["lead", "contact"]),
  subject_id: z.string(),
});

export const DataExportRequestedSchema = Envelope.extend({
  export_id: z.string(),
  format: z.enum(["csv", "json", "webhook"]),
  filter_hash: z.string(),
});

export const DataExportDeliveredSchema = Envelope.extend({
  export_id: z.string(),
  rows: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

export const CrmEventSchemas = {
  lead_captured: LeadCapturedSchema,
  lead_scored: LeadScoredSchema,
  lead_qualified: LeadQualifiedSchema,
  lead_disqualified: LeadDisqualifiedSchema,
  lead_booking_created: LeadBookingCreatedSchema,
  lead_booking_canceled: LeadBookingCanceledSchema,
  lead_revtry_enqueued: LeadRevtryEnqueuedSchema,
  consent_captured: ConsentCapturedSchema,
  data_export_requested: DataExportRequestedSchema,
  data_export_delivered: DataExportDeliveredSchema,
} as const;

export type CrmEventName = keyof typeof CrmEventSchemas;
export type CrmEventPayload<N extends CrmEventName> = z.infer<(typeof CrmEventSchemas)[N]>;

export type CrmEventSink = (name: CrmEventName, payload: unknown, ts: number) => void | Promise<void>;

const consoleSink: CrmEventSink = (name, payload, ts) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: name, ts, ...((payload as object) ?? {}) }));
};

let sink: CrmEventSink = consoleSink;
export const setCrmEventSink = (s: CrmEventSink): void => {
  sink = s;
};

export async function emitCrm<N extends CrmEventName>(name: N, payload: CrmEventPayload<N>): Promise<void> {
  const parsed = CrmEventSchemas[name].parse(payload);
  await sink(name, parsed, Date.now());
}
