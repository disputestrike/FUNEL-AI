/**
 * CRM domain types: Contact, Lead, Booking, LeadScore, Pipeline.
 *
 * A Contact is a person we know about — deduplicated by (workspace_id, email)
 * and (workspace_id, phone_e164). A Lead is one *capture event* — many leads
 * can roll up to a single contact. A Booking is a calendar event a lead has
 * scheduled. LeadScore is the model output that powers RevTry routing.
 */

import type { FunnelId, FunnelVersionId } from "./funnel.js";
import type { UserId, WorkspaceId } from "./workspace.js";

export type ContactId = string;
export type LeadId = string;
export type BookingId = string;
export type PipelineId = string;
export type PipelineStageId = string;

export enum LeadStatus {
  New = "new",
  Contacted = "contacted",
  Qualified = "qualified",
  Disqualified = "disqualified",
  Booked = "booked",
  Converted = "converted",
  Closed = "closed",
}

export type LeadScoreBand = "hot" | "warm" | "cold";

export interface ConsentState {
  marketing?: boolean;
  sms?: boolean;
  calls?: boolean;
  /** Pointer to the consent capture event (`cns_…`). */
  consent_id?: string;
  consent_captured_at?: string;
  withdrawn_at?: string;
}

export interface Contact {
  id: ContactId;
  workspace_id: WorkspaceId;
  email_normalized?: string;
  email_sha256?: string;
  phone_e164?: string;
  phone_sha256?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  custom_fields: Record<string, unknown>;
  tags: string[];
  consent: ConsentState;
  do_not_contact: boolean;
  primary_source?: string;
  first_seen_at: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  /** Set true on GDPR delete; PII columns wiped, ID kept as tombstone. */
  tombstone: boolean;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  id?: string;
}

/**
 * A Lead is the row created when a Contact submits a capture event on a
 * funnel. It has its own pipeline status (independent of the Contact).
 */
export interface Lead {
  id: LeadId;
  workspace_id: WorkspaceId;
  funnel_id: FunnelId;
  funnel_version_id: FunnelVersionId;
  contact_id?: ContactId | null;
  status: LeadStatus;
  score?: number | null;
  score_band?: LeadScoreBand | null;
  score_model_version?: string | null;
  capture_source: string;
  capture_url?: string;
  utm: UtmParams;
  ip_hash?: string;
  geo_country?: string;
  geo_region?: string;
  consent_id?: string;
  attribution_blob: Record<string, unknown>;
  first_contact_at?: string;
  last_contact_at?: string;
  qualified_at?: string;
  disqualified_at?: string;
  disqualified_reason?: string;
  converted_at?: string;
  conversion_value_micros?: number;
  conversion_currency?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface LeadScore {
  lead_id: LeadId;
  workspace_id: WorkspaceId;
  score: number; // 0..100
  band: LeadScoreBand;
  model_version: string;
  features_hash: string;
  explanations?: Array<{
    feature: string;
    weight: number;
    direction: "positive" | "negative";
  }>;
  computed_at: string;
}

export interface Booking {
  id: BookingId;
  workspace_id: WorkspaceId;
  lead_id: LeadId;
  funnel_id: FunnelId;
  host_user_id?: UserId | null;
  external_calendar?: "google" | "outlook" | "funnel_native";
  external_event_id?: string;
  scheduled_for: string;
  duration_minutes: number;
  timezone: string;
  meeting_url?: string;
  status: "confirmed" | "canceled" | "completed" | "no_show";
  canceled_at?: string | null;
  canceled_by?: string | null;
  cancel_reason?: string | null;
  notes_hash?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Pipelines model lead routing. A workspace has one default pipeline plus
 * any number of vertical-specific ones. Stages are ordered.
 */
export interface PipelineStage {
  id: PipelineStageId;
  pipeline_id: PipelineId;
  name: string;
  slug: string;
  position: number;
  /** Lead status this stage maps to. */
  maps_to_status: LeadStatus;
  /** If true, a Lead landing here triggers RevTry outreach. */
  auto_trigger_revtry: boolean;
}

export interface Pipeline {
  id: PipelineId;
  workspace_id: WorkspaceId;
  name: string;
  slug: string;
  is_default: boolean;
  stages: PipelineStage[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
