/**
 * Contact CRUD — the canonical "person" object in the CRM.
 *
 * Behavior contract (`docs/12-prd-pack-v1.md` §PRD3 stories 1, 6, 7, 13, 14):
 *   - workspace-scoped uniqueness on email + phone (we enforce in-app since
 *     the SQL unique indexes are partial),
 *   - dedupe by hashed-email or hashed-phone on insert,
 *   - soft-delete (`deleted_at`) with restore; GDPR tombstones wipe PII.
 */

import { z } from "zod";
import {
  newContactId,
  type ContactId,
} from "./ids.js";
import {
  type ContactRow,
  type ConsentChannels,
  type CrmStore,
  type WorkspaceId,
  type ListFilter,
  type ListResult,
  getStore,
} from "./store.js";
import { hashEmail, hashPhone, normalizePhone } from "./phone.js";
import { ConflictError, NotFoundError, ValidationError } from "./errors.js";
import { recordActivity } from "./activity-timeline.js";

const EmailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CreateContactInput = z.object({
  workspace_id: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  consent: z
    .object({
      marketing: z.boolean().optional(),
      sms: z.boolean().optional(),
      calls: z.boolean().optional(),
    })
    .optional(),
  primary_source: z.string().optional(),
  default_country: z.string().length(2).optional(),
  actor_user_id: z.string().nullable().optional(),
});
export type CreateContactInput = z.infer<typeof CreateContactInput>;

export const UpdateContactInput = z.object({
  workspace_id: z.string(),
  id: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  consent: z
    .object({
      marketing: z.boolean().optional(),
      sms: z.boolean().optional(),
      calls: z.boolean().optional(),
    })
    .optional(),
  do_not_contact: z.boolean().optional(),
  default_country: z.string().length(2).optional(),
  actor_user_id: z.string().nullable().optional(),
  /** Caller-supplied `updated_at` for optimistic concurrency. */
  expected_updated_at: z.date().optional(),
});
export type UpdateContactInput = z.infer<typeof UpdateContactInput>;

export async function createContact(input: CreateContactInput, store: CrmStore = getStore()): Promise<ContactRow> {
  const parsed = CreateContactInput.parse(input);

  const emailNorm = parsed.email ? parsed.email.trim().toLowerCase() : null;
  if (emailNorm && !EmailRe.test(emailNorm)) {
    throw new ValidationError(`invalid email "${emailNorm}"`);
  }

  const phoneN = normalizePhone(parsed.phone, parsed.default_country);
  if (parsed.phone && !phoneN.valid) {
    // PRD §3 edge case 3: still save the contact, but no E.164 + no voice/SMS.
  }

  // dedupe check
  if (emailNorm) {
    const dup = await store.findContactByEmail(parsed.workspace_id, emailNorm);
    if (dup) throw new ConflictError(`contact with email ${emailNorm} already exists (${dup.id})`);
  }
  if (phoneN.e164) {
    const dup = await store.findContactByPhone(parsed.workspace_id, phoneN.e164);
    if (dup) throw new ConflictError(`contact with phone ${phoneN.e164} already exists (${dup.id})`);
  }

  const id = newContactId();
  const now = new Date();
  const row: ContactRow = {
    id,
    workspace_id: parsed.workspace_id,
    email_normalized: emailNorm,
    email_sha256: emailNorm ? await hashEmail(emailNorm) : null,
    phone_e164: phoneN.e164,
    phone_sha256: phoneN.e164 ? await hashPhone(phoneN.e164) : null,
    full_name: parsed.full_name ?? composeFullName(parsed.first_name, parsed.last_name),
    first_name: parsed.first_name ?? null,
    last_name: parsed.last_name ?? null,
    company: parsed.company ?? null,
    custom_fields: parsed.custom_fields ?? {},
    tags: parsed.tags ?? [],
    consent: parsed.consent ?? {},
    do_not_contact: false,
    primary_source: parsed.primary_source ?? null,
    first_seen_at: now,
    last_activity_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    tombstone: false,
  };
  const inserted = await store.insertContact(row);
  await recordActivity({
    workspace_id: parsed.workspace_id,
    contact_id: id,
    lead_id: null,
    kind: "contact_created",
    actor_user_id: parsed.actor_user_id ?? null,
    metadata: { email_normalized: emailNorm, phone_e164: phoneN.e164 },
  });
  return inserted;
}

export async function getContact(workspace_id: WorkspaceId, id: ContactId, store: CrmStore = getStore()): Promise<ContactRow> {
  const c = await store.getContact(workspace_id, id);
  if (!c) throw new NotFoundError("contact", id);
  return c;
}

export async function updateContact(input: UpdateContactInput, store: CrmStore = getStore()): Promise<ContactRow> {
  const parsed = UpdateContactInput.parse(input);
  const existing = await store.getContact(parsed.workspace_id, parsed.id as ContactId);
  if (!existing) throw new NotFoundError("contact", parsed.id);

  // optimistic concurrency (PRD §3 edge case 5)
  if (parsed.expected_updated_at && +existing.updated_at !== +parsed.expected_updated_at) {
    throw new ConflictError(
      `contact ${parsed.id} was modified at ${existing.updated_at.toISOString()} — refresh and retry`,
    );
  }

  const patch: Partial<ContactRow> = {};
  if (parsed.email !== undefined) {
    if (parsed.email === null) {
      patch.email_normalized = null;
      patch.email_sha256 = null;
    } else {
      const e = parsed.email.trim().toLowerCase();
      if (!EmailRe.test(e)) throw new ValidationError(`invalid email "${e}"`);
      if (e !== existing.email_normalized) {
        const dup = await store.findContactByEmail(parsed.workspace_id, e);
        if (dup && dup.id !== parsed.id) throw new ConflictError(`email ${e} taken`);
      }
      patch.email_normalized = e;
      patch.email_sha256 = await hashEmail(e);
    }
  }
  if (parsed.phone !== undefined) {
    if (parsed.phone === null) {
      patch.phone_e164 = null;
      patch.phone_sha256 = null;
    } else {
      const n = normalizePhone(parsed.phone, parsed.default_country);
      if (n.valid && n.e164 && n.e164 !== existing.phone_e164) {
        const dup = await store.findContactByPhone(parsed.workspace_id, n.e164);
        if (dup && dup.id !== parsed.id) throw new ConflictError(`phone ${n.e164} taken`);
        patch.phone_e164 = n.e164;
        patch.phone_sha256 = await hashPhone(n.e164);
      } else if (!n.valid) {
        patch.phone_e164 = null;
        patch.phone_sha256 = null;
      }
    }
  }
  if (parsed.full_name !== undefined) patch.full_name = parsed.full_name;
  if (parsed.first_name !== undefined) patch.first_name = parsed.first_name;
  if (parsed.last_name !== undefined) patch.last_name = parsed.last_name;
  if (parsed.company !== undefined) patch.company = parsed.company;
  if (parsed.custom_fields !== undefined) patch.custom_fields = { ...existing.custom_fields, ...parsed.custom_fields };
  if (parsed.tags !== undefined) patch.tags = [...new Set(parsed.tags)];
  if (parsed.consent !== undefined) patch.consent = { ...existing.consent, ...parsed.consent };
  if (parsed.do_not_contact !== undefined) patch.do_not_contact = parsed.do_not_contact;

  const updated = await store.updateContact(parsed.workspace_id, parsed.id as ContactId, patch);
  await recordActivity({
    workspace_id: parsed.workspace_id,
    contact_id: parsed.id as ContactId,
    lead_id: null,
    kind: "contact_updated",
    actor_user_id: parsed.actor_user_id ?? null,
    metadata: { changed: Object.keys(patch) },
  });
  return updated;
}

export async function deleteContact(
  workspace_id: WorkspaceId,
  id: ContactId,
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<void> {
  const existing = await store.getContact(workspace_id, id);
  if (!existing) throw new NotFoundError("contact", id);
  await store.softDeleteContact(workspace_id, id, new Date());
  await recordActivity({
    workspace_id,
    contact_id: id,
    lead_id: null,
    kind: "contact_deleted",
    actor_user_id,
    metadata: {},
  });
}

export async function restoreContact(
  workspace_id: WorkspaceId,
  id: ContactId,
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<ContactRow> {
  const c = await store.restoreContact(workspace_id, id);
  await recordActivity({
    workspace_id,
    contact_id: id,
    lead_id: null,
    kind: "contact_restored",
    actor_user_id,
    metadata: {},
  });
  return c;
}

export const ListContactsInput = z.object({
  workspace_id: z.string(),
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  consentMarketing: z.boolean().optional(),
  includeDeleted: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  sort: z.enum(["recent", "name", "score"]).optional(),
});
export type ListContactsInput = z.infer<typeof ListContactsInput>;

export async function listContacts(input: ListContactsInput, store: CrmStore = getStore()): Promise<ListResult<ContactRow>> {
  const parsed = ListContactsInput.parse(input);
  return store.listContacts(parsed as ListFilter);
}

/**
 * Merge `mergeIds` into `keepId`. Fields are taken from `keepId` first;
 * non-empty fields from merged rows fill gaps. Leads referencing the merged
 * rows are re-parented to `keepId`. Merged rows are soft-deleted.
 */
export async function mergeDuplicates(
  workspace_id: WorkspaceId,
  keepId: ContactId,
  mergeIds: ContactId[],
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<ContactRow> {
  if (mergeIds.includes(keepId)) throw new ValidationError("mergeIds must not contain keepId");
  const keep = await store.getContact(workspace_id, keepId);
  if (!keep) throw new NotFoundError("contact", keepId);
  const merged = await store.mergeContacts(workspace_id, keepId, mergeIds);
  await recordActivity({
    workspace_id,
    contact_id: keepId,
    lead_id: null,
    kind: "merged",
    actor_user_id,
    metadata: { merged_ids: mergeIds },
  });
  return merged;
}

function composeFullName(first?: string, last?: string): string | null {
  const f = [first, last].filter((p) => p && p.trim().length > 0).join(" ").trim();
  return f.length ? f : null;
}

export type { ContactRow, ConsentChannels };
