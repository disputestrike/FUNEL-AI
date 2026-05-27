/**
 * Public types for the Funnel SDK.
 *
 * These mirror the OpenAPI schemas exactly. The `pnpm openapi` script
 * regenerates them from packages/sdk/openapi.json — do not hand-edit the
 * generated declarations; edit the zod schemas in apps/api/src/public-api.
 */

export type Id = string;
export type Timestamp = string;

export type PlanTier = "free" | "starter" | "growth" | "scale" | "agency";

export interface Paginated<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export type FunnelStatus = "draft" | "published" | "archived";

export interface Funnel {
  id: Id;
  workspace_id: Id;
  name: string;
  slug: string;
  status: FunnelStatus;
  vertical: string | null;
  goal: string | null;
  url: string | null;
  published_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at: Timestamp | null;
}
export interface CreateFunnel {
  name: string;
  vertical?: string;
  goal?: string;
  brief?: string;
  template_id?: Id;
}
export interface UpdateFunnel extends Partial<CreateFunnel> {
  status?: FunnelStatus;
}

export type LeadStatus = "new" | "qualified" | "contacted" | "won" | "lost";
export interface Lead {
  id: Id;
  workspace_id: Id;
  funnel_id: Id | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  score: number;
  status: LeadStatus;
  source: string | null;
  utm: Record<string, string> | null;
  consent: {
    marketing: boolean;
    sms: boolean;
    granted_at: Timestamp | null;
    ip: string | null;
  };
  custom_fields: Record<string, unknown> | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
export interface CreateLead {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  funnel_id?: Id;
  source?: string;
  utm?: Record<string, string>;
  consent?: { marketing: boolean; sms: boolean };
  custom_fields?: Record<string, unknown>;
}
export interface UpdateLead {
  score?: number;
  status?: LeadStatus;
  custom_fields?: Record<string, unknown>;
}

export type LifecycleStage = "subscriber" | "lead" | "mql" | "sql" | "customer" | "evangelist";
export interface Contact {
  id: Id;
  workspace_id: Id;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  tags: string[];
  lifecycle_stage: LifecycleStage;
  created_at: Timestamp;
  updated_at: Timestamp;
}
export type CreateContact = Partial<Omit<Contact, "id" | "workspace_id" | "created_at" | "updated_at">>;
export type UpdateContact = Partial<CreateContact>;

export type CampaignPlatform = "meta" | "google" | "tiktok" | "linkedin" | "youtube" | "pinterest";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export interface Campaign {
  id: Id;
  workspace_id: Id;
  funnel_id: Id | null;
  platform: CampaignPlatform;
  external_id: string | null;
  name: string;
  status: CampaignStatus;
  daily_budget_cents: number | null;
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}
export interface CreateCampaign {
  platform: CampaignPlatform;
  funnel_id: Id;
  name: string;
  daily_budget_cents?: number;
  creative_brief?: string;
}

export interface Integration {
  id: Id;
  workspace_id: Id;
  provider: string;
  account_label: string | null;
  status: "connected" | "disconnected" | "error";
  scopes: string[];
  connected_at: Timestamp;
  last_synced_at: Timestamp | null;
}

export interface AnalyticsRange {
  start: Timestamp;
  end: Timestamp;
  granularity?: "hour" | "day" | "week" | "month";
}
export interface CohortRow {
  cohort: string;
  size: number;
  retained: number[];
}
export interface RetentionPoint {
  period: number;
  rate: number;
  count: number;
}
export interface ConversionFunnelStep {
  step: string;
  count: number;
  rate: number;
}
export interface RevenuePoint {
  at: Timestamp;
  revenue_cents: number;
  mrr_cents?: number;
  arr_cents?: number;
}

export type WebhookEventType =
  | "lead.created"
  | "lead.qualified"
  | "lead.updated"
  | "funnel.published"
  | "funnel.generated"
  | "campaign.published"
  | "campaign.paused"
  | "booking.created"
  | "voice_call.completed"
  | "voice_call.recording.ready";

export interface Webhook {
  id: Id;
  workspace_id: Id;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  active: boolean;
  secret_last4: string;
  created_at: Timestamp;
}
export interface CreateWebhook {
  url: string;
  events: WebhookEventType[];
  description?: string;
  active?: boolean;
}

export interface VoiceCall {
  id: Id;
  workspace_id: Id;
  lead_id: Id | null;
  direction: "inbound" | "outbound";
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  from_e164: string;
  to_e164: string;
  duration_sec: number | null;
  recording_url: string | null;
  transcript_ready: boolean;
  started_at: Timestamp | null;
  ended_at: Timestamp | null;
}
export interface Transcript {
  call_id: Id;
  segments: { speaker: "agent" | "lead"; start_sec: number; end_sec: number; text: string }[];
}

export interface Booking {
  id: Id;
  workspace_id: Id;
  lead_id: Id | null;
  contact_id: Id | null;
  calendar_provider: "google" | "microsoft" | "calcom" | "internal";
  external_event_id: string | null;
  starts_at: Timestamp;
  ends_at: Timestamp;
  attendee_email: string;
  status: "confirmed" | "cancelled" | "rescheduled" | "no_show" | "completed";
  meeting_url: string | null;
  created_at: Timestamp;
}
export interface CreateBooking {
  lead_id?: Id;
  contact_id?: Id;
  starts_at: Timestamp;
  ends_at: Timestamp;
  attendee_email: string;
  notes?: string;
}
