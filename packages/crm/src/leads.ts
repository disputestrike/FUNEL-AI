/**
 * Lead lifecycle: capture → score → qualify/disqualify → pipeline movement.
 *
 * `captureLead` is the speed-to-lead entry point: it upserts the contact,
 * inserts the lead row, emits `lead_captured`, and triggers
 * `runSpeedToLead` asynchronously (do not block the capture response on
 * outbound side effects — per PRD §3 acceptance "capture P95 < 250ms").
 */

import { z } from "zod";
import { newLeadId, type LeadId, type ContactId } from "./ids.js";
import {
  type CrmStore,
  type LeadRow,
  type LeadStatus,
  type WorkspaceId,
  type FunnelId,
  type FunnelVersionId,
  type StageId,
  getStore,
} from "./store.js";
import { createContact, updateContact, type ContactRow } from "./contacts.js";
import { hashEmail, hashPhone, normalizePhone } from "./phone.js";
import { recordActivity } from "./activity-timeline.js";
import { emitCrm } from "./bus.js";
import { scoreLead as scoreLeadCompute } from "./scoring.js";
import { getOrCreateDefaultPipeline, moveLead } from "./pipelines.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { runSpeedToLead } from "./speed-to-lead.js";

const EmailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FormDataSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  marketing_consent: z.boolean().optional(),
  sms_consent: z.boolean().optional(),
  calls_consent: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
});
export type FormData = z.infer<typeof FormDataSchema>;

export const SourceAttributionSchema = z.object({
  capture_source: z.string(), // landing_page_form | embedded | chat | …
  capture_url: z.string().nullable().optional(),
  utm: z.record(z.string()).optional(),
  referrer: z.string().nullable().optional(),
  ip_hash: z.string().nullable().optional(),
  geo_country: z.string().length(2).nullable().optional(),
  geo_region: z.string().nullable().optional(),
  consent_id: z.string().nullable().optional(),
  default_country: z.string().length(2).optional(),
  industry: z.string().optional(),
  enrichment: z.record(z.unknown()).optional(),
});
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

export interface CaptureLeadOptions {
  workspace_id: WorkspaceId;
  funnel_id: FunnelId;
  funnel_version_id: FunnelVersionId;
  form_data: FormData;
  source_attribution: SourceAttribution;
  /** Skip async side effects (RevTry dial, notify). Useful for backfills/imports. */
  skipSpeedToLead?: boolean;
  actor_user_id?: string | null;
}

export interface CaptureLeadResult {
  lead: LeadRow;
  contact: ContactRow;
  /** Set to true if we deduped against an existing lead within the dedupe window. */
  deduped: boolean;
}

const DEDUPE_WINDOW_MS = 60_000;

export async function captureLead(opts: CaptureLeadOptions, store: CrmStore = getStore()): Promise<CaptureLeadResult> {
  const form = FormDataSchema.parse(opts.form_data);
  const src = SourceAttributionSchema.parse(opts.source_attribution);

  // 1) Resolve / upsert contact ----------------------------------------------
  const emailNorm = form.email?.trim().toLowerCase() ?? null;
  if (emailNorm && !EmailRe.test(emailNorm)) {
    // Don't reject — store raw, leave normalized empty (PRD §3 edge case 2).
  }
  const phoneN = normalizePhone(form.phone, src.default_country);

  let contact: ContactRow | null = null;
  if (emailNorm && EmailRe.test(emailNorm)) {
    contact = await store.findContactByEmail(opts.workspace_id, emailNorm);
  }
  if (!contact && phoneN.e164) {
    contact = await store.findContactByPhone(opts.workspace_id, phoneN.e164);
  }
  if (!contact) {
    try {
      contact = await createContact({
        workspace_id: opts.workspace_id,
        email: emailNorm && EmailRe.test(emailNorm) ? emailNorm : undefined,
        phone: phoneN.e164 ?? undefined,
        full_name: form.full_name,
        first_name: form.first_name,
        last_name: form.last_name,
        company: form.company,
        custom_fields: form.custom ?? {},
        consent: {
          marketing: form.marketing_consent,
          sms: form.sms_consent,
          calls: form.calls_consent,
        },
        primary_source: src.capture_source,
        default_country: src.default_country,
        actor_user_id: opts.actor_user_id ?? null,
      }, store);
    } catch (err) {
      // race: someone else inserted between our find + create — re-find.
      if (emailNorm) contact = await store.findContactByEmail(opts.workspace_id, emailNorm);
      if (!contact && phoneN.e164) contact = await store.findContactByPhone(opts.workspace_id, phoneN.e164);
      if (!contact) throw err;
    }
  } else {
    // merge form data into existing contact (don't clobber non-null fields)
    const patch: Partial<ContactRow> = {};
    if (!contact.full_name && form.full_name) patch.full_name = form.full_name;
    if (!contact.first_name && form.first_name) patch.first_name = form.first_name;
    if (!contact.last_name && form.last_name) patch.last_name = form.last_name;
    if (!contact.company && form.company) patch.company = form.company;
    if (form.marketing_consent !== undefined || form.sms_consent !== undefined || form.calls_consent !== undefined) {
      patch.consent = {
        ...contact.consent,
        ...(form.marketing_consent !== undefined ? { marketing: form.marketing_consent } : {}),
        ...(form.sms_consent !== undefined ? { sms: form.sms_consent } : {}),
        ...(form.calls_consent !== undefined ? { calls: form.calls_consent } : {}),
      };
    }
    if (Object.keys(patch).length) {
      contact = await store.updateContact(opts.workspace_id, contact.id, patch);
    }
  }

  // 2) Lead-level dedupe (same contact + same funnel in 60s) ------------------
  const recent = await store.listLeads({
    workspace_id: opts.workspace_id,
    limit: 50,
    sort: "recent",
  });
  const dupe = recent.items.find(
    (l) =>
      l.crm_contact_id === contact!.id &&
      l.funnel_id === opts.funnel_id &&
      Date.now() - +l.created_at < DEDUPE_WINDOW_MS,
  );
  if (dupe) {
    await recordActivity({
      workspace_id: opts.workspace_id,
      contact_id: contact.id,
      lead_id: dupe.id,
      kind: "form_submit",
      actor_user_id: opts.actor_user_id ?? null,
      metadata: { capture_source: src.capture_source, deduped: true },
    }, store);
    return { lead: dupe, contact, deduped: true };
  }

  // 3) Insert lead ------------------------------------------------------------
  const id = newLeadId();
  const now = new Date();
  const lead: LeadRow = {
    id,
    workspace_id: opts.workspace_id,
    funnel_id: opts.funnel_id,
    funnel_version_id: opts.funnel_version_id,
    crm_contact_id: contact.id,
    status: "new",
    score: null,
    score_band: null,
    score_model_version: null,
    score_reason_codes: [],
    capture_source: src.capture_source,
    capture_url: src.capture_url ?? null,
    utm: src.utm ?? {},
    ip_hash: src.ip_hash ?? null,
    geo_country: src.geo_country ?? null,
    geo_region: src.geo_region ?? null,
    consent_id: src.consent_id ?? null,
    attribution_blob: { referrer: src.referrer ?? null, industry: src.industry ?? null },
    first_contact_at: null,
    last_contact_at: null,
    qualified_at: null,
    disqualified_at: null,
    disqualified_reason: null,
    converted_at: null,
    conversion_value_micros: null,
    conversion_currency: null,
    pipeline_id: null,
    stage_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await store.insertLead(lead);

  // 4) Place into default pipeline's first stage ------------------------------
  try {
    const def = await getOrCreateDefaultPipeline(opts.workspace_id, src.industry, store);
    const first = def.stages[0];
    if (first) {
      await store.updateLead(opts.workspace_id, lead.id, { pipeline_id: def.pipeline.id, stage_id: first.id });
      lead.pipeline_id = def.pipeline.id;
      lead.stage_id = first.id;
    }
  } catch {
    // pipeline failure is non-fatal — lead still captured.
  }

  // 5) Activity timeline + canonical lead_captured event ----------------------
  await recordActivity({
    workspace_id: opts.workspace_id,
    contact_id: contact.id,
    lead_id: id,
    kind: "form_submit",
    actor_user_id: opts.actor_user_id ?? null,
    metadata: { capture_source: src.capture_source, capture_url: src.capture_url ?? null, utm: src.utm ?? {} },
  }, store);

  await emitCrm("lead_captured", {
    workspace_id: opts.workspace_id,
    occurred_at: now.toISOString(),
    actor_user_id: opts.actor_user_id ?? null,
    lead_id: id,
    funnel_id: opts.funnel_id,
    funnel_version_id: opts.funnel_version_id,
    capture_source: src.capture_source,
    consent_id: src.consent_id ?? null,
    contact_fields_hashed: {
      email_sha256: contact.email_sha256,
      phone_e164_sha256: contact.phone_sha256,
    },
    utm: src.utm,
    ip_hash: src.ip_hash ?? null,
    geo_country: src.geo_country ?? null,
  });

  // 6) Fire-and-forget speed-to-lead (within 100ms; PRD §3 acceptance) --------
  if (!opts.skipSpeedToLead) {
    // We deliberately don't await — the speed-to-lead pipeline runs async.
    void runSpeedToLead({
      workspace_id: opts.workspace_id,
      lead_id: id,
      contact_id: contact.id,
      industry: src.industry,
      enrichment: src.enrichment,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("speed-to-lead error", { lead_id: id, err: String(err) });
    });
  }

  return { lead, contact, deduped: false };
}

export async function getLead(workspace_id: WorkspaceId, id: LeadId, store: CrmStore = getStore()): Promise<LeadRow> {
  const l = await store.getLead(workspace_id, id);
  if (!l) throw new NotFoundError("lead", id);
  return l;
}

export const ListLeadsInput = z.object({
  workspace_id: z.string(),
  status: z.array(z.enum(["new", "contacted", "qualified", "proposal_sent", "won", "lost", "disqualified", "booked"])).optional(),
  sort: z.enum(["recent", "score"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  includeDeleted: z.boolean().optional(),
});
export type ListLeadsInput = z.infer<typeof ListLeadsInput>;

export async function listLeads(input: ListLeadsInput, store: CrmStore = getStore()) {
  const parsed = ListLeadsInput.parse(input);
  return store.listLeads(parsed as any);
}

export async function scoreLead(
  workspace_id: WorkspaceId,
  id: LeadId,
  opts: { industry?: string; enrichment?: Record<string, unknown> } = {},
  store: CrmStore = getStore(),
): Promise<LeadRow> {
  const lead = await getLead(workspace_id, id, store);
  const contact = lead.crm_contact_id ? await store.getContact(workspace_id, lead.crm_contact_id) : null;
  const industry =
    opts.industry ?? ((lead.attribution_blob as Record<string, unknown>)?.industry as string | undefined) ?? "generic";
  const { score, band, reasons, features_hash, model_version } = await scoreLeadCompute({
    lead,
    contact,
    industry,
    enrichment: opts.enrichment,
  });
  const updated = await store.updateLead(workspace_id, id, {
    score,
    score_band: band,
    score_model_version: model_version,
    score_reason_codes: reasons,
  });
  await emitCrm("lead_scored", {
    workspace_id,
    occurred_at: new Date().toISOString(),
    lead_id: id,
    score,
    band,
    model_version,
    features_hash,
    explanations: reasons,
  });
  await recordActivity({
    workspace_id,
    contact_id: lead.crm_contact_id,
    lead_id: id,
    kind: "score_changed",
    actor_user_id: null,
    metadata: { score, band, reasons },
  }, store);
  return updated;
}

export async function qualifyLead(
  workspace_id: WorkspaceId,
  id: LeadId,
  opts: { qualifier: string; method?: "agent" | "human" | "rule"; criteria_id?: string | null; actor_user_id?: string | null },
  store: CrmStore = getStore(),
): Promise<LeadRow> {
  const lead = await getLead(workspace_id, id, store);
  const updated = await store.updateLead(workspace_id, id, {
    status: "qualified",
    qualified_at: new Date(),
  });
  await emitCrm("lead_qualified", {
    workspace_id,
    occurred_at: new Date().toISOString(),
    actor_user_id: opts.actor_user_id ?? null,
    lead_id: id,
    qualifier: opts.qualifier,
    qualifier_method: opts.method ?? "human",
    criteria_id: opts.criteria_id ?? null,
  });
  await recordActivity({
    workspace_id,
    contact_id: lead.crm_contact_id,
    lead_id: id,
    kind: "qualified",
    actor_user_id: opts.actor_user_id ?? null,
    metadata: { qualifier: opts.qualifier, method: opts.method ?? "human" },
  }, store);
  return updated;
}

export async function disqualifyLead(
  workspace_id: WorkspaceId,
  id: LeadId,
  opts: { reason_code: string; disqualifier: string; actor_user_id?: string | null },
  store: CrmStore = getStore(),
): Promise<LeadRow> {
  const lead = await getLead(workspace_id, id, store);
  const updated = await store.updateLead(workspace_id, id, {
    status: "disqualified",
    disqualified_at: new Date(),
    disqualified_reason: opts.reason_code,
  });
  await emitCrm("lead_disqualified", {
    workspace_id,
    occurred_at: new Date().toISOString(),
    actor_user_id: opts.actor_user_id ?? null,
    lead_id: id,
    reason_code: opts.reason_code,
    disqualifier: opts.disqualifier,
  });
  await recordActivity({
    workspace_id,
    contact_id: lead.crm_contact_id,
    lead_id: id,
    kind: "disqualified",
    actor_user_id: opts.actor_user_id ?? null,
    metadata: { reason_code: opts.reason_code, disqualifier: opts.disqualifier },
  }, store);
  return updated;
}

export async function assignToPipeline(
  workspace_id: WorkspaceId,
  id: LeadId,
  pipeline_id: string,
  stage_id: StageId,
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<LeadRow> {
  const lead = await getLead(workspace_id, id, store);
  return moveLead(workspace_id, lead.id, lead.stage_id as StageId, stage_id, actor_user_id, store).then(() =>
    getLead(workspace_id, id, store),
  );
}

export type { LeadRow, LeadId, LeadStatus, ContactId };
