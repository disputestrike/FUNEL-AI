/**
 * Activity timeline — every customer-facing touchpoint logs one row here.
 *
 * Consumed by the CRM contact view + lead-detail panel. The shape is
 * intentionally polymorphic (any kind of touchpoint, structured metadata)
 * so adding a new touchpoint type doesn't need a migration.
 *
 * Most external callers go through helpers in `contacts.ts`, `leads.ts`,
 * `bookings.ts`. The voice + email + sms packages call `recordActivity` via
 * webhook handlers when they receive provider delivery/engagement events.
 */

import {
  newActivityId,
  type ActivityId,
  type ContactId,
  type LeadId,
} from "./ids.js";
import {
  type ActivityKind,
  type ActivityRow,
  type CrmStore,
  type WorkspaceId,
  getStore,
} from "./store.js";

export interface RecordActivityInput {
  workspace_id: WorkspaceId;
  contact_id: ContactId | null;
  lead_id: LeadId | null;
  kind: ActivityKind;
  actor_user_id: string | null;
  occurred_at?: Date;
  metadata?: Record<string, unknown>;
}

export async function recordActivity(input: RecordActivityInput, store: CrmStore = getStore()): Promise<ActivityRow> {
  const row: ActivityRow = {
    id: newActivityId(),
    workspace_id: input.workspace_id,
    contact_id: input.contact_id,
    lead_id: input.lead_id,
    kind: input.kind,
    actor_user_id: input.actor_user_id,
    occurred_at: input.occurred_at ?? new Date(),
    metadata: input.metadata ?? {},
  };
  return store.insertActivity(row);
}

export async function getTimelineForContact(
  workspace_id: WorkspaceId,
  contact_id: ContactId,
  limit = 100,
  store: CrmStore = getStore(),
): Promise<ActivityRow[]> {
  return store.listActivity(workspace_id, contact_id, null, limit);
}

export async function getTimelineForLead(
  workspace_id: WorkspaceId,
  lead_id: LeadId,
  limit = 100,
  store: CrmStore = getStore(),
): Promise<ActivityRow[]> {
  return store.listActivity(workspace_id, null, lead_id, limit);
}

export type { ActivityRow, ActivityKind, ActivityId };
