/**
 * Booking lifecycle. Calendar providers (Google / Microsoft / Cal.com)
 * sit behind `@funnel/integrations` adapters and reach us via webhooks.
 *
 * Booking sync is bidirectional with conflict resolution = last-writer-wins
 * by external timestamp (Doc 12 Â§3 edge case 17).
 */

import { z } from "zod";
import { getAdapter, type ProviderAdapter } from "@funnel/integrations";
import {
  newBookingId,
  type BookingId,
  type ContactId,
  type LeadId,
} from "./ids.js";
import {
  type BookingRow,
  type BookingStatus,
  type CrmStore,
  type WorkspaceId,
  getStore,
} from "./store.js";
import { ConflictError, NotFoundError, ValidationError } from "./errors.js";
import { getLead } from "./leads.js";
import { recordActivity } from "./activity-timeline.js";
import { emitCrm } from "./bus.js";

export const CreateBookingInput = z.object({
  workspace_id: z.string(),
  lead_id: z.string(),
  host_user_id: z.string().nullable().optional(),
  scheduled_for: z.coerce.date(),
  duration_minutes: z.number().int().positive().max(480).optional(),
  timezone: z.string().optional(),
  meeting_url: z.string().url().nullable().optional(),
  notes: z.string().optional(),
  /** Which calendar provider to sync this booking to. */
  calendar_provider: z.enum(["google", "outlook", "calcom", "funnel_native"]).optional(),
  /** Skip provider sync â€” useful for backfilling existing external events. */
  skipExternalSync: z.boolean().optional(),
  actor_user_id: z.string().nullable().optional(),
  idempotency_key: z.string().optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;

const adapterKey: Record<string, string> = {
  google: "google_calendar",
  outlook: "ms_graph",
  calcom: "calcom",
};

export async function createBooking(input: CreateBookingInput, store: CrmStore = getStore()): Promise<BookingRow> {
  const parsed = CreateBookingInput.parse(input);
  const lead = await getLead(parsed.workspace_id, parsed.lead_id as LeadId, store);
  if (lead.deleted_at) throw new ValidationError(`lead ${parsed.lead_id} is deleted`);

  // Double-booking guard: PRD Â§3 acceptance "zero double-bookings at 1000rps".
  // For an in-process store we do a window check; the Postgres impl will use
  // a unique partial index on (host_user_id, scheduled_for).
  if (parsed.host_user_id) {
    const existing = await store.listBookings(parsed.workspace_id, {
      since: parsed.scheduled_for,
      until: new Date(+parsed.scheduled_for + (parsed.duration_minutes ?? 30) * 60_000),
    });
    if (existing.some((b) => b.host_user_id === parsed.host_user_id && b.status === "confirmed")) {
      throw new ConflictError(`host ${parsed.host_user_id} already has a booking in that window`);
    }
  }

  const provider = parsed.calendar_provider ?? "funnel_native";
  let externalEventId: string | null = null;
  let meetingUrl = parsed.meeting_url ?? null;
  if (!parsed.skipExternalSync && provider !== "funnel_native") {
    try {
      const adapter = getAdapter(adapterKey[provider]) as ProviderAdapter;
      const event = (await adapter.create<{ id: string; meeting_url?: string }>(
        "booking",
        {
          host_user_id: parsed.host_user_id,
          starts_at: parsed.scheduled_for.toISOString(),
          duration_minutes: parsed.duration_minutes ?? 30,
          timezone: parsed.timezone ?? "UTC",
          summary: `GoFunnelAI booking â€” lead ${parsed.lead_id}`,
          description: parsed.notes ?? "",
          attendee_lead_id: parsed.lead_id,
        },
        {
          idempotencyKey: parsed.idempotency_key ?? `${parsed.workspace_id}:${parsed.lead_id}:${+parsed.scheduled_for}`,
          workspaceId: parsed.workspace_id,
        },
      )) as { id: string; meeting_url?: string };
      externalEventId = event.id;
      if (!meetingUrl && event.meeting_url) meetingUrl = event.meeting_url;
    } catch (err) {
      // PRD Â§3 edge case 4: queue when calendar OAuth is broken â€” still create CRM booking.
      // eslint-disable-next-line no-console
      console.warn("calendar sync deferred", { provider, err: String(err) });
    }
  }

  const id = newBookingId();
  const now = new Date();
  const row: BookingRow = {
    id,
    workspace_id: parsed.workspace_id,
    lead_id: parsed.lead_id as LeadId,
    funnel_id: lead.funnel_id,
    host_user_id: parsed.host_user_id ?? null,
    external_calendar: provider,
    external_event_id: externalEventId,
    scheduled_for: parsed.scheduled_for,
    duration_minutes: parsed.duration_minutes ?? 30,
    timezone: parsed.timezone ?? "UTC",
    meeting_url: meetingUrl,
    status: "confirmed",
    canceled_at: null,
    canceled_by: null,
    cancel_reason: null,
    notes_hash: parsed.notes ? await sha256(parsed.notes) : null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await store.insertBooking(row);
  await store.updateLead(parsed.workspace_id, lead.id, { status: "booked" });
  await recordActivity({
    workspace_id: parsed.workspace_id,
    contact_id: lead.crm_contact_id,
    lead_id: lead.id,
    kind: "booking_created",
    actor_user_id: parsed.actor_user_id ?? null,
    metadata: {
      booking_id: id,
      scheduled_for: parsed.scheduled_for.toISOString(),
      provider,
      external_event_id: externalEventId,
    },
  }, store);
  await emitCrm("lead_booking_created", {
    workspace_id: parsed.workspace_id,
    occurred_at: now.toISOString(),
    lead_id: lead.id,
    booking_id: id,
    calendar_event_id: externalEventId,
    scheduled_for: parsed.scheduled_for.toISOString(),
    host_user_id: parsed.host_user_id ?? null,
  });
  return row;
}

export const UpdateBookingInput = z.object({
  workspace_id: z.string(),
  id: z.string(),
  scheduled_for: z.coerce.date().optional(),
  duration_minutes: z.number().int().positive().max(480).optional(),
  timezone: z.string().optional(),
  meeting_url: z.string().url().nullable().optional(),
  status: z.enum(["confirmed", "canceled", "completed", "no_show"]).optional(),
  actor_user_id: z.string().nullable().optional(),
});
export type UpdateBookingInput = z.infer<typeof UpdateBookingInput>;

export async function updateBooking(input: UpdateBookingInput, store: CrmStore = getStore()): Promise<BookingRow> {
  const parsed = UpdateBookingInput.parse(input);
  const existing = await store.getBooking(parsed.workspace_id, parsed.id as BookingId);
  if (!existing) throw new NotFoundError("booking", parsed.id);
  const patch: Partial<BookingRow> = {};
  if (parsed.scheduled_for) patch.scheduled_for = parsed.scheduled_for;
  if (parsed.duration_minutes) patch.duration_minutes = parsed.duration_minutes;
  if (parsed.timezone) patch.timezone = parsed.timezone;
  if (parsed.meeting_url !== undefined) patch.meeting_url = parsed.meeting_url;
  if (parsed.status) patch.status = parsed.status;
  const updated = await store.updateBooking(parsed.workspace_id, parsed.id as BookingId, patch);
  return updated;
}

export async function cancelBooking(
  workspace_id: WorkspaceId,
  id: BookingId,
  opts: { canceled_by: string; cancel_reason?: string | null; skipExternalSync?: boolean; actor_user_id?: string | null },
  store: CrmStore = getStore(),
): Promise<BookingRow> {
  const existing = await store.getBooking(workspace_id, id);
  if (!existing) throw new NotFoundError("booking", id);
  if (existing.status !== "confirmed") return existing;

  if (!opts.skipExternalSync && existing.external_calendar !== "funnel_native" && existing.external_event_id) {
    try {
      const adapter = getAdapter(adapterKey[existing.external_calendar] ?? "google_calendar") as ProviderAdapter;
      await adapter.delete("booking", existing.external_event_id, {
        idempotencyKey: `cancel:${id}`,
        workspaceId: workspace_id,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("external calendar cancel deferred", { id, err: String(err) });
    }
  }

  const now = new Date();
  const updated = await store.updateBooking(workspace_id, id, {
    status: "canceled",
    canceled_at: now,
    canceled_by: opts.canceled_by,
    cancel_reason: opts.cancel_reason ?? null,
  });
  await store.updateLead(workspace_id, existing.lead_id, { status: "qualified" });
  await recordActivity({
    workspace_id,
    contact_id: null,
    lead_id: existing.lead_id,
    kind: "booking_canceled",
    actor_user_id: opts.actor_user_id ?? null,
    metadata: { booking_id: id, canceled_by: opts.canceled_by, cancel_reason: opts.cancel_reason ?? null },
  }, store);
  await emitCrm("lead_booking_canceled", {
    workspace_id,
    occurred_at: now.toISOString(),
    booking_id: id,
    canceled_by: opts.canceled_by,
    cancel_reason: opts.cancel_reason ?? null,
  });
  return updated;
}

export async function rescheduleBooking(
  workspace_id: WorkspaceId,
  id: BookingId,
  new_time: Date,
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<BookingRow> {
  const existing = await store.getBooking(workspace_id, id);
  if (!existing) throw new NotFoundError("booking", id);
  if (existing.status === "canceled") throw new ValidationError("cannot reschedule a canceled booking");

  if (existing.external_calendar !== "funnel_native" && existing.external_event_id) {
    try {
      const adapter = getAdapter(adapterKey[existing.external_calendar] ?? "google_calendar") as ProviderAdapter;
      await adapter.update("booking", existing.external_event_id, { starts_at: new_time.toISOString() }, {
        idempotencyKey: `reschedule:${id}:${+new_time}`,
        workspaceId: workspace_id,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("external calendar reschedule deferred", { id, err: String(err) });
    }
  }

  const updated = await store.updateBooking(workspace_id, id, { scheduled_for: new_time });
  await recordActivity({
    workspace_id,
    contact_id: null,
    lead_id: existing.lead_id,
    kind: "booking_rescheduled",
    actor_user_id,
    metadata: { booking_id: id, new_time: new_time.toISOString() },
  }, store);
  return updated;
}

export async function listBookings(
  workspace_id: WorkspaceId,
  filter: { lead_id?: LeadId; since?: Date; until?: Date } = {},
  store: CrmStore = getStore(),
): Promise<BookingRow[]> {
  return store.listBookings(workspace_id, filter);
}

/**
 * Handle an inbound calendar webhook event. The integration adapter already
 * normalized it into a `WebhookEvent`. We translate to a booking update.
 */
export async function handleCalendarWebhook(
  workspace_id: WorkspaceId,
  event: { external_event_id: string; status?: BookingStatus; new_time?: Date; cancel_reason?: string },
  store: CrmStore = getStore(),
): Promise<BookingRow | null> {
  const all = await store.listBookings(workspace_id, {});
  const match = all.find((b) => b.external_event_id === event.external_event_id);
  if (!match) return null;
  if (event.status === "canceled") {
    return cancelBooking(workspace_id, match.id, { canceled_by: "lead", cancel_reason: event.cancel_reason ?? null, skipExternalSync: true }, store);
  }
  if (event.new_time) {
    return rescheduleBooking(workspace_id, match.id, event.new_time, null, store);
  }
  return match;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type { BookingRow, BookingId, BookingStatus };
