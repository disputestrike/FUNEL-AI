/**
 * Zod schemas for every public REST resource.
 *
 * These are the single source of truth — the OpenAPI spec, the TS SDK
 * types, and the Python SDK pydantic models are all generated from these.
 * Keep them additive: never remove or rename a field in v1.
 */

import { z } from "zod";

const Id = z.string().min(1);
const Timestamp = z.string().datetime();

/* ---------------------------- Funnels ----------------------------------- */

export const FunnelStatus = z.enum(["draft", "published", "archived"]);

export const Funnel = z.object({
  id: Id,
  workspace_id: Id,
  name: z.string(),
  slug: z.string(),
  status: FunnelStatus,
  vertical: z.string().nullable(),
  goal: z.string().nullable(),
  url: z.string().url().nullable(),
  published_url: z.string().url().nullable(),
  created_at: Timestamp,
  updated_at: Timestamp,
  published_at: Timestamp.nullable(),
});
export type Funnel = z.infer<typeof Funnel>;

export const CreateFunnel = z.object({
  name: z.string().min(1).max(120),
  vertical: z.string().optional(),
  goal: z.string().optional(),
  brief: z.string().optional().describe("Free-form prompt for AI generation."),
  template_id: Id.optional(),
});

export const UpdateFunnel = CreateFunnel.partial().extend({
  status: FunnelStatus.optional(),
});

/* ---------------------------- Leads ------------------------------------- */

export const LeadStatus = z.enum(["new", "qualified", "contacted", "won", "lost"]);

export const Lead = z.object({
  id: Id,
  workspace_id: Id,
  funnel_id: Id.nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  score: z.number().int().min(0).max(100),
  status: LeadStatus,
  source: z.string().nullable(),
  utm: z.record(z.string()).nullable(),
  consent: z.object({
    marketing: z.boolean(),
    sms: z.boolean(),
    granted_at: Timestamp.nullable(),
    ip: z.string().nullable(),
  }),
  custom_fields: z.record(z.unknown()).nullable(),
  created_at: Timestamp,
  updated_at: Timestamp,
});

export const CreateLead = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  funnel_id: Id.optional(),
  source: z.string().optional(),
  utm: z.record(z.string()).optional(),
  consent: z
    .object({ marketing: z.boolean(), sms: z.boolean() })
    .optional(),
  custom_fields: z.record(z.unknown()).optional(),
});
export const UpdateLead = z.object({
  score: z.number().int().min(0).max(100).optional(),
  status: LeadStatus.optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

/* ---------------------------- Contacts ---------------------------------- */

export const Contact = z.object({
  id: Id,
  workspace_id: Id,
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  company: z.string().nullable(),
  tags: z.array(z.string()),
  lifecycle_stage: z.enum(["subscriber", "lead", "mql", "sql", "customer", "evangelist"]),
  created_at: Timestamp,
  updated_at: Timestamp,
});
export const CreateContact = Contact.omit({
  id: true,
  workspace_id: true,
  created_at: true,
  updated_at: true,
}).partial({
  tags: true,
  lifecycle_stage: true,
});
export const UpdateContact = CreateContact.partial();

/* ---------------------------- Campaigns --------------------------------- */

export const CampaignPlatform = z.enum([
  "meta",
  "google",
  "tiktok",
  "linkedin",
  "youtube",
  "pinterest",
]);
export const CampaignStatus = z.enum(["draft", "active", "paused", "ended"]);

export const Campaign = z.object({
  id: Id,
  workspace_id: Id,
  funnel_id: Id.nullable(),
  platform: CampaignPlatform,
  external_id: z.string().nullable(),
  name: z.string(),
  status: CampaignStatus,
  daily_budget_cents: z.number().int().nonnegative().nullable(),
  spend_cents: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  created_at: Timestamp,
  updated_at: Timestamp,
});
export const CreateCampaign = z.object({
  platform: CampaignPlatform,
  funnel_id: Id,
  name: z.string().min(1),
  daily_budget_cents: z.number().int().nonnegative().optional(),
  creative_brief: z.string().optional(),
});

/* ---------------------------- Integrations ------------------------------ */

export const Integration = z.object({
  id: Id,
  workspace_id: Id,
  provider: z.string(),
  account_label: z.string().nullable(),
  status: z.enum(["connected", "disconnected", "error"]),
  scopes: z.array(z.string()),
  connected_at: Timestamp,
  last_synced_at: Timestamp.nullable(),
});

/* ---------------------------- Analytics --------------------------------- */

export const AnalyticsRange = z.object({
  start: Timestamp,
  end: Timestamp,
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
});
export const CohortRow = z.object({
  cohort: z.string(),
  size: z.number().int(),
  retained: z.array(z.number()),
});
export const RetentionPoint = z.object({
  period: z.number().int(),
  rate: z.number(),
  count: z.number().int(),
});
export const ConversionFunnelStep = z.object({
  step: z.string(),
  count: z.number().int(),
  rate: z.number(),
});
export const RevenuePoint = z.object({
  at: Timestamp,
  revenue_cents: z.number().int(),
  mrr_cents: z.number().int().optional(),
  arr_cents: z.number().int().optional(),
});

/* ---------------------------- Webhooks ---------------------------------- */

export const WebhookEvent = z.enum([
  "lead.created",
  "lead.qualified",
  "lead.updated",
  "funnel.published",
  "funnel.generated",
  "campaign.published",
  "campaign.paused",
  "booking.created",
  "voice_call.completed",
  "voice_call.recording.ready",
]);
export const Webhook = z.object({
  id: Id,
  workspace_id: Id,
  url: z.string().url(),
  events: z.array(WebhookEvent).min(1),
  description: z.string().nullable(),
  active: z.boolean(),
  secret_last4: z.string(),
  created_at: Timestamp,
});
export const CreateWebhook = z.object({
  url: z.string().url(),
  events: z.array(WebhookEvent).min(1),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

/* ---------------------------- Voice Calls ------------------------------- */

export const VoiceCall = z.object({
  id: Id,
  workspace_id: Id,
  lead_id: Id.nullable(),
  direction: z.enum(["inbound", "outbound"]),
  status: z.enum(["queued", "ringing", "in-progress", "completed", "failed", "no-answer"]),
  from_e164: z.string(),
  to_e164: z.string(),
  duration_sec: z.number().int().nonnegative().nullable(),
  recording_url: z.string().url().nullable(),
  transcript_ready: z.boolean(),
  started_at: Timestamp.nullable(),
  ended_at: Timestamp.nullable(),
});
export const Transcript = z.object({
  call_id: Id,
  segments: z.array(
    z.object({
      speaker: z.enum(["agent", "lead"]),
      start_sec: z.number(),
      end_sec: z.number(),
      text: z.string(),
    }),
  ),
});

/* ---------------------------- Bookings ---------------------------------- */

export const Booking = z.object({
  id: Id,
  workspace_id: Id,
  lead_id: Id.nullable(),
  contact_id: Id.nullable(),
  calendar_provider: z.enum(["google", "microsoft", "calcom", "internal"]),
  external_event_id: z.string().nullable(),
  starts_at: Timestamp,
  ends_at: Timestamp,
  attendee_email: z.string().email(),
  status: z.enum(["confirmed", "cancelled", "rescheduled", "no_show", "completed"]),
  meeting_url: z.string().url().nullable(),
  created_at: Timestamp,
});
export const CreateBooking = z.object({
  lead_id: Id.optional(),
  contact_id: Id.optional(),
  starts_at: Timestamp,
  ends_at: Timestamp,
  attendee_email: z.string().email(),
  notes: z.string().optional(),
});
