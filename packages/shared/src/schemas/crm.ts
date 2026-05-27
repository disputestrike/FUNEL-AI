/**
 * Zod schemas for CRM domain: Contact, Lead, Booking, LeadScore, Pipeline.
 */

import { z } from "zod";

export const LeadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "disqualified",
  "booked",
  "converted",
  "closed",
]);

export const LeadScoreBandSchema = z.enum(["hot", "warm", "cold"]);

export const ConsentStateSchema = z.object({
  marketing: z.boolean().optional(),
  sms: z.boolean().optional(),
  calls: z.boolean().optional(),
  consent_id: z.string().optional(),
  consent_captured_at: z.string().datetime().optional(),
  withdrawn_at: z.string().datetime().optional(),
});

export const UtmParamsSchema = z
  .object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    term: z.string().optional(),
    content: z.string().optional(),
    id: z.string().optional(),
  })
  .strict();

export const ContactSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  email_normalized: z.string().optional(),
  email_sha256: z.string().optional(),
  phone_e164: z.string().optional(),
  phone_sha256: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  custom_fields: z.record(z.unknown()),
  tags: z.array(z.string()),
  consent: ConsentStateSchema,
  do_not_contact: z.boolean(),
  primary_source: z.string().optional(),
  first_seen_at: z.string().datetime(),
  last_activity_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
  tombstone: z.boolean(),
});

export const LeadSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  funnel_id: z.string().min(1),
  funnel_version_id: z.string().min(1),
  contact_id: z.string().nullable().optional(),
  status: LeadStatusSchema,
  score: z.number().min(0).max(100).nullable().optional(),
  score_band: LeadScoreBandSchema.nullable().optional(),
  score_model_version: z.string().nullable().optional(),
  capture_source: z.string().min(1),
  capture_url: z.string().url().optional(),
  utm: UtmParamsSchema,
  ip_hash: z.string().optional(),
  geo_country: z.string().length(2).optional(),
  geo_region: z.string().optional(),
  consent_id: z.string().optional(),
  attribution_blob: z.record(z.unknown()),
  first_contact_at: z.string().datetime().optional(),
  last_contact_at: z.string().datetime().optional(),
  qualified_at: z.string().datetime().optional(),
  disqualified_at: z.string().datetime().optional(),
  disqualified_reason: z.string().optional(),
  converted_at: z.string().datetime().optional(),
  conversion_value_micros: z.number().int().optional(),
  conversion_currency: z.string().length(3).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export const LeadScoreSchema = z.object({
  lead_id: z.string().min(1),
  workspace_id: z.string().min(1),
  score: z.number().min(0).max(100),
  band: LeadScoreBandSchema,
  model_version: z.string(),
  features_hash: z.string(),
  explanations: z
    .array(
      z.object({
        feature: z.string(),
        weight: z.number(),
        direction: z.enum(["positive", "negative"]),
      })
    )
    .optional(),
  computed_at: z.string().datetime(),
});

export const BookingSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  lead_id: z.string().min(1),
  funnel_id: z.string().min(1),
  host_user_id: z.string().nullable().optional(),
  external_calendar: z.enum(["google", "outlook", "funnel_native"]).optional(),
  external_event_id: z.string().optional(),
  scheduled_for: z.string().datetime(),
  duration_minutes: z.number().int().positive(),
  timezone: z.string(),
  meeting_url: z.string().url().optional(),
  status: z.enum(["confirmed", "canceled", "completed", "no_show"]),
  canceled_at: z.string().datetime().nullable().optional(),
  canceled_by: z.string().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
  notes_hash: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export const PipelineStageSchema = z.object({
  id: z.string().min(1),
  pipeline_id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  position: z.number().int().nonnegative(),
  maps_to_status: LeadStatusSchema,
  auto_trigger_revtry: z.boolean(),
});

export const PipelineSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  is_default: z.boolean(),
  stages: z.array(PipelineStageSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});
