/**
 * Persistence abstraction for CRM. Production binds Prisma (via
 * `@funnel/db`); tests + local dev bind `InMemoryStore`.
 *
 * The shape is intentionally narrow — one method per CRUD intent — so the
 * Prisma implementation can stay a one-line wrapper around the generated
 * client and the in-memory implementation can match exactly.
 */

import type { ContactId, LeadId, BookingId, ActivityId, TagId, ListId, CustomFieldId, PipelineId, StageId } from "./ids.js";

export type WorkspaceId = string;
export type FunnelId = string;
export type FunnelVersionId = string;
export type UserId = string;

// ---------- Contact ----------

export type ConsentChannels = {
  marketing?: boolean;
  sms?: boolean;
  calls?: boolean;
};

export interface ContactRow {
  id: ContactId;
  workspace_id: WorkspaceId;
  email_normalized: string | null;
  email_sha256: string | null;
  phone_e164: string | null;
  phone_sha256: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  custom_fields: Record<string, unknown>;
  tags: string[];
  consent: ConsentChannels;
  do_not_contact: boolean;
  primary_source: string | null;
  first_seen_at: Date;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  tombstone: boolean;
}

// ---------- Lead ----------

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "won"
  | "lost"
  | "disqualified"
  | "booked";

export interface LeadRow {
  id: LeadId;
  workspace_id: WorkspaceId;
  funnel_id: FunnelId;
  funnel_version_id: FunnelVersionId;
  crm_contact_id: ContactId | null;
  status: LeadStatus;
  score: number | null;
  score_band: "hot" | "warm" | "cold" | null;
  score_model_version: string | null;
  score_reason_codes: string[];
  capture_source: string;
  capture_url: string | null;
  utm: Record<string, string>;
  ip_hash: string | null;
  geo_country: string | null;
  geo_region: string | null;
  consent_id: string | null;
  attribution_blob: Record<string, unknown>;
  first_contact_at: Date | null;
  last_contact_at: Date | null;
  qualified_at: Date | null;
  disqualified_at: Date | null;
  disqualified_reason: string | null;
  converted_at: Date | null;
  conversion_value_micros: bigint | null;
  conversion_currency: string | null;
  pipeline_id: PipelineId | null;
  stage_id: StageId | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---------- Booking ----------

export type BookingStatus = "confirmed" | "canceled" | "completed" | "no_show";

export interface BookingRow {
  id: BookingId;
  workspace_id: WorkspaceId;
  lead_id: LeadId;
  funnel_id: FunnelId;
  host_user_id: UserId | null;
  external_calendar: "google" | "outlook" | "calcom" | "funnel_native";
  external_event_id: string | null;
  scheduled_for: Date;
  duration_minutes: number;
  timezone: string;
  meeting_url: string | null;
  status: BookingStatus;
  canceled_at: Date | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  notes_hash: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---------- Pipeline ----------

export interface StageRow {
  id: StageId;
  pipeline_id: PipelineId;
  workspace_id: WorkspaceId;
  name: string;
  position: number;
  terminal_kind: "won" | "lost" | null;
}

export interface PipelineRow {
  id: PipelineId;
  workspace_id: WorkspaceId;
  name: string;
  industry: string | null;
  is_default: boolean;
  created_at: Date;
}

// ---------- Activity ----------

export type ActivityKind =
  | "form_submit"
  | "ad_click"
  | "page_view"
  | "call_started"
  | "call_completed"
  | "voicemail_left"
  | "sms_sent"
  | "sms_received"
  | "sms_opt_out"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "booking_created"
  | "booking_canceled"
  | "booking_rescheduled"
  | "payment"
  | "stage_changed"
  | "tag_added"
  | "tag_removed"
  | "note"
  | "score_changed"
  | "qualified"
  | "disqualified"
  | "merged"
  | "imported"
  | "exported"
  | "contact_created"
  | "contact_updated"
  | "contact_deleted"
  | "contact_restored";

export interface ActivityRow {
  id: ActivityId;
  workspace_id: WorkspaceId;
  contact_id: ContactId | null;
  lead_id: LeadId | null;
  kind: ActivityKind;
  actor_user_id: UserId | null;
  occurred_at: Date;
  metadata: Record<string, unknown>;
}

// ---------- Tag / List / CustomField ----------

export interface TagRow {
  id: TagId;
  workspace_id: WorkspaceId;
  name: string;
  color: string | null;
  created_at: Date;
}

export interface ListRow {
  id: ListId;
  workspace_id: WorkspaceId;
  name: string;
  entity_type: "contact" | "lead";
  filter: Record<string, unknown>;
  created_by: UserId | null;
  created_at: Date;
}

export interface CustomFieldRow {
  id: CustomFieldId;
  workspace_id: WorkspaceId;
  entity_type: "contact" | "lead" | "opportunity";
  field_name: string;
  field_type: "text" | "number" | "date" | "dropdown" | "multi_select" | "boolean";
  options: string[];
  required: boolean;
  created_at: Date;
}

// ---------- Store contract ----------

export interface ListFilter {
  workspace_id: WorkspaceId;
  q?: string;
  tags?: string[];
  status?: LeadStatus | LeadStatus[];
  consentMarketing?: boolean;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
  sort?: "recent" | "name" | "score";
}

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface CrmStore {
  // Contacts
  insertContact(row: ContactRow): Promise<ContactRow>;
  getContact(workspace_id: WorkspaceId, id: ContactId): Promise<ContactRow | null>;
  findContactByEmail(workspace_id: WorkspaceId, email_normalized: string): Promise<ContactRow | null>;
  findContactByPhone(workspace_id: WorkspaceId, phone_e164: string): Promise<ContactRow | null>;
  updateContact(workspace_id: WorkspaceId, id: ContactId, patch: Partial<ContactRow>): Promise<ContactRow>;
  softDeleteContact(workspace_id: WorkspaceId, id: ContactId, at: Date): Promise<void>;
  restoreContact(workspace_id: WorkspaceId, id: ContactId): Promise<ContactRow>;
  listContacts(filter: ListFilter): Promise<ListResult<ContactRow>>;
  mergeContacts(workspace_id: WorkspaceId, keepId: ContactId, mergeIds: ContactId[]): Promise<ContactRow>;

  // Leads
  insertLead(row: LeadRow): Promise<LeadRow>;
  getLead(workspace_id: WorkspaceId, id: LeadId): Promise<LeadRow | null>;
  updateLead(workspace_id: WorkspaceId, id: LeadId, patch: Partial<LeadRow>): Promise<LeadRow>;
  listLeads(filter: ListFilter): Promise<ListResult<LeadRow>>;

  // Pipelines + stages
  insertPipeline(row: PipelineRow, stages: StageRow[]): Promise<PipelineRow>;
  getPipeline(workspace_id: WorkspaceId, id: PipelineId): Promise<{ pipeline: PipelineRow; stages: StageRow[] } | null>;
  getDefaultPipeline(workspace_id: WorkspaceId): Promise<{ pipeline: PipelineRow; stages: StageRow[] } | null>;
  listPipelines(workspace_id: WorkspaceId): Promise<PipelineRow[]>;
  getStage(workspace_id: WorkspaceId, id: StageId): Promise<StageRow | null>;

  // Bookings
  insertBooking(row: BookingRow): Promise<BookingRow>;
  getBooking(workspace_id: WorkspaceId, id: BookingId): Promise<BookingRow | null>;
  updateBooking(workspace_id: WorkspaceId, id: BookingId, patch: Partial<BookingRow>): Promise<BookingRow>;
  listBookings(workspace_id: WorkspaceId, filter: { lead_id?: LeadId; since?: Date; until?: Date }): Promise<BookingRow[]>;

  // Activity
  insertActivity(row: ActivityRow): Promise<ActivityRow>;
  listActivity(workspace_id: WorkspaceId, contact_id: ContactId | null, lead_id: LeadId | null, limit?: number): Promise<ActivityRow[]>;

  // Tags
  upsertTag(row: TagRow): Promise<TagRow>;
  listTags(workspace_id: WorkspaceId): Promise<TagRow[]>;

  // Lists
  insertList(row: ListRow): Promise<ListRow>;
  listLists(workspace_id: WorkspaceId, entity_type?: "contact" | "lead"): Promise<ListRow[]>;
  deleteList(workspace_id: WorkspaceId, id: ListId): Promise<void>;

  // Custom fields
  insertCustomField(row: CustomFieldRow): Promise<CustomFieldRow>;
  listCustomFields(workspace_id: WorkspaceId, entity_type?: "contact" | "lead" | "opportunity"): Promise<CustomFieldRow[]>;
  deleteCustomField(workspace_id: WorkspaceId, id: CustomFieldId): Promise<void>;
}

// ---------------- In-memory implementation ----------------

export class InMemoryStore implements CrmStore {
  private contacts = new Map<string, ContactRow>();
  private leads = new Map<string, LeadRow>();
  private bookings = new Map<string, BookingRow>();
  private pipelines = new Map<string, PipelineRow>();
  private stages = new Map<string, StageRow>();
  private activities = new Map<string, ActivityRow>();
  private tags = new Map<string, TagRow>();
  private lists = new Map<string, ListRow>();
  private customFields = new Map<string, CustomFieldRow>();

  // ----- contacts -----
  async insertContact(row: ContactRow): Promise<ContactRow> {
    this.contacts.set(row.id, { ...row });
    return { ...row };
  }
  async getContact(workspace_id: WorkspaceId, id: ContactId): Promise<ContactRow | null> {
    const c = this.contacts.get(id);
    return c && c.workspace_id === workspace_id ? { ...c } : null;
  }
  async findContactByEmail(workspace_id: WorkspaceId, email: string): Promise<ContactRow | null> {
    for (const c of this.contacts.values()) {
      if (c.workspace_id === workspace_id && c.email_normalized === email && !c.deleted_at) return { ...c };
    }
    return null;
  }
  async findContactByPhone(workspace_id: WorkspaceId, phone: string): Promise<ContactRow | null> {
    for (const c of this.contacts.values()) {
      if (c.workspace_id === workspace_id && c.phone_e164 === phone && !c.deleted_at) return { ...c };
    }
    return null;
  }
  async updateContact(workspace_id: WorkspaceId, id: ContactId, patch: Partial<ContactRow>): Promise<ContactRow> {
    const existing = this.contacts.get(id);
    if (!existing || existing.workspace_id !== workspace_id) throw new Error(`contact ${id} not found`);
    const merged = { ...existing, ...patch, updated_at: new Date() };
    this.contacts.set(id, merged);
    return { ...merged };
  }
  async softDeleteContact(workspace_id: WorkspaceId, id: ContactId, at: Date): Promise<void> {
    const c = this.contacts.get(id);
    if (!c || c.workspace_id !== workspace_id) return;
    c.deleted_at = at;
    c.updated_at = new Date();
  }
  async restoreContact(workspace_id: WorkspaceId, id: ContactId): Promise<ContactRow> {
    const c = this.contacts.get(id);
    if (!c || c.workspace_id !== workspace_id) throw new Error(`contact ${id} not found`);
    c.deleted_at = null;
    c.updated_at = new Date();
    return { ...c };
  }
  async listContacts(filter: ListFilter): Promise<ListResult<ContactRow>> {
    let items = [...this.contacts.values()].filter((c) => c.workspace_id === filter.workspace_id);
    if (!filter.includeDeleted) items = items.filter((c) => !c.deleted_at);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      items = items.filter(
        (c) =>
          (c.email_normalized ?? "").includes(q) ||
          (c.full_name ?? "").toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          (c.phone_e164 ?? "").includes(q),
      );
    }
    if (filter.tags?.length) {
      items = items.filter((c) => filter.tags!.every((t) => c.tags.includes(t)));
    }
    if (filter.consentMarketing !== undefined) {
      items = items.filter((c) => Boolean(c.consent?.marketing) === filter.consentMarketing);
    }
    if (filter.sort === "name") items.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    else items.sort((a, b) => +b.last_activity_at! - +a.last_activity_at! || +b.created_at - +a.created_at);

    const limit = filter.limit ?? 50;
    const start = filter.cursor ? parseInt(filter.cursor, 10) : 0;
    return {
      items: items.slice(start, start + limit).map((c) => ({ ...c })),
      nextCursor: start + limit < items.length ? String(start + limit) : null,
      total: items.length,
    };
  }
  async mergeContacts(workspace_id: WorkspaceId, keepId: ContactId, mergeIds: ContactId[]): Promise<ContactRow> {
    const keep = this.contacts.get(keepId);
    if (!keep || keep.workspace_id !== workspace_id) throw new Error(`contact ${keepId} not found`);
    for (const mid of mergeIds) {
      const m = this.contacts.get(mid);
      if (!m || m.workspace_id !== workspace_id) continue;
      // merge fields: prefer non-empty value from `m` for missing keep fields
      keep.email_normalized ??= m.email_normalized;
      keep.email_sha256 ??= m.email_sha256;
      keep.phone_e164 ??= m.phone_e164;
      keep.phone_sha256 ??= m.phone_sha256;
      keep.full_name ??= m.full_name;
      keep.first_name ??= m.first_name;
      keep.last_name ??= m.last_name;
      keep.company ??= m.company;
      keep.tags = [...new Set([...keep.tags, ...m.tags])];
      keep.custom_fields = { ...m.custom_fields, ...keep.custom_fields };
      keep.consent = { ...m.consent, ...keep.consent };
      // re-parent leads
      for (const l of this.leads.values()) {
        if (l.crm_contact_id === mid) l.crm_contact_id = keepId;
      }
      m.deleted_at = new Date();
      m.tombstone = false;
    }
    keep.updated_at = new Date();
    return { ...keep };
  }

  // ----- leads -----
  async insertLead(row: LeadRow): Promise<LeadRow> {
    this.leads.set(row.id, { ...row });
    return { ...row };
  }
  async getLead(workspace_id: WorkspaceId, id: LeadId): Promise<LeadRow | null> {
    const l = this.leads.get(id);
    return l && l.workspace_id === workspace_id ? { ...l } : null;
  }
  async updateLead(workspace_id: WorkspaceId, id: LeadId, patch: Partial<LeadRow>): Promise<LeadRow> {
    const existing = this.leads.get(id);
    if (!existing || existing.workspace_id !== workspace_id) throw new Error(`lead ${id} not found`);
    const merged = { ...existing, ...patch, updated_at: new Date() };
    this.leads.set(id, merged);
    return { ...merged };
  }
  async listLeads(filter: ListFilter): Promise<ListResult<LeadRow>> {
    let items = [...this.leads.values()].filter((l) => l.workspace_id === filter.workspace_id);
    if (!filter.includeDeleted) items = items.filter((l) => !l.deleted_at);
    if (filter.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter((l) => arr.includes(l.status));
    }
    if (filter.sort === "score") items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    else items.sort((a, b) => +b.created_at - +a.created_at);
    const limit = filter.limit ?? 50;
    const start = filter.cursor ? parseInt(filter.cursor, 10) : 0;
    return {
      items: items.slice(start, start + limit).map((l) => ({ ...l })),
      nextCursor: start + limit < items.length ? String(start + limit) : null,
      total: items.length,
    };
  }

  // ----- pipelines -----
  async insertPipeline(row: PipelineRow, stages: StageRow[]): Promise<PipelineRow> {
    this.pipelines.set(row.id, { ...row });
    for (const s of stages) this.stages.set(s.id, { ...s });
    return { ...row };
  }
  async getPipeline(workspace_id: WorkspaceId, id: PipelineId) {
    const p = this.pipelines.get(id);
    if (!p || p.workspace_id !== workspace_id) return null;
    const stages = [...this.stages.values()].filter((s) => s.pipeline_id === id).sort((a, b) => a.position - b.position);
    return { pipeline: { ...p }, stages: stages.map((s) => ({ ...s })) };
  }
  async getDefaultPipeline(workspace_id: WorkspaceId) {
    const def = [...this.pipelines.values()].find((p) => p.workspace_id === workspace_id && p.is_default);
    if (!def) return null;
    return this.getPipeline(workspace_id, def.id);
  }
  async listPipelines(workspace_id: WorkspaceId) {
    return [...this.pipelines.values()].filter((p) => p.workspace_id === workspace_id).map((p) => ({ ...p }));
  }
  async getStage(workspace_id: WorkspaceId, id: StageId) {
    const s = this.stages.get(id);
    return s && s.workspace_id === workspace_id ? { ...s } : null;
  }

  // ----- bookings -----
  async insertBooking(row: BookingRow): Promise<BookingRow> {
    this.bookings.set(row.id, { ...row });
    return { ...row };
  }
  async getBooking(workspace_id: WorkspaceId, id: BookingId) {
    const b = this.bookings.get(id);
    return b && b.workspace_id === workspace_id ? { ...b } : null;
  }
  async updateBooking(workspace_id: WorkspaceId, id: BookingId, patch: Partial<BookingRow>) {
    const b = this.bookings.get(id);
    if (!b || b.workspace_id !== workspace_id) throw new Error(`booking ${id} not found`);
    const merged = { ...b, ...patch, updated_at: new Date() };
    this.bookings.set(id, merged);
    return { ...merged };
  }
  async listBookings(workspace_id: WorkspaceId, filter: { lead_id?: LeadId; since?: Date; until?: Date }) {
    return [...this.bookings.values()]
      .filter((b) => b.workspace_id === workspace_id)
      .filter((b) => (filter.lead_id ? b.lead_id === filter.lead_id : true))
      .filter((b) => (filter.since ? b.scheduled_for >= filter.since : true))
      .filter((b) => (filter.until ? b.scheduled_for <= filter.until : true))
      .map((b) => ({ ...b }));
  }

  // ----- activity -----
  async insertActivity(row: ActivityRow): Promise<ActivityRow> {
    this.activities.set(row.id, { ...row });
    return { ...row };
  }
  async listActivity(workspace_id: WorkspaceId, contact_id: ContactId | null, lead_id: LeadId | null, limit = 100) {
    return [...this.activities.values()]
      .filter((a) => a.workspace_id === workspace_id)
      .filter((a) => (contact_id ? a.contact_id === contact_id : true))
      .filter((a) => (lead_id ? a.lead_id === lead_id : true))
      .sort((a, b) => +b.occurred_at - +a.occurred_at)
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  // ----- tags -----
  async upsertTag(row: TagRow): Promise<TagRow> {
    const existing = [...this.tags.values()].find((t) => t.workspace_id === row.workspace_id && t.name === row.name);
    if (existing) return { ...existing };
    this.tags.set(row.id, { ...row });
    return { ...row };
  }
  async listTags(workspace_id: WorkspaceId) {
    return [...this.tags.values()].filter((t) => t.workspace_id === workspace_id).map((t) => ({ ...t }));
  }

  // ----- lists -----
  async insertList(row: ListRow): Promise<ListRow> {
    this.lists.set(row.id, { ...row });
    return { ...row };
  }
  async listLists(workspace_id: WorkspaceId, entity_type?: "contact" | "lead") {
    return [...this.lists.values()]
      .filter((l) => l.workspace_id === workspace_id)
      .filter((l) => (entity_type ? l.entity_type === entity_type : true))
      .map((l) => ({ ...l }));
  }
  async deleteList(workspace_id: WorkspaceId, id: ListId) {
    const l = this.lists.get(id);
    if (l && l.workspace_id === workspace_id) this.lists.delete(id);
  }

  // ----- custom fields -----
  async insertCustomField(row: CustomFieldRow): Promise<CustomFieldRow> {
    this.customFields.set(row.id, { ...row });
    return { ...row };
  }
  async listCustomFields(workspace_id: WorkspaceId, entity_type?: "contact" | "lead" | "opportunity") {
    return [...this.customFields.values()]
      .filter((c) => c.workspace_id === workspace_id)
      .filter((c) => (entity_type ? c.entity_type === entity_type : true))
      .map((c) => ({ ...c }));
  }
  async deleteCustomField(workspace_id: WorkspaceId, id: CustomFieldId) {
    const c = this.customFields.get(id);
    if (c && c.workspace_id === workspace_id) this.customFields.delete(id);
  }
}

// Process-default store (override in app bootstrap).
let _store: CrmStore = new InMemoryStore();
export const getStore = (): CrmStore => _store;
export const setStore = (s: CrmStore): void => {
  _store = s;
};
