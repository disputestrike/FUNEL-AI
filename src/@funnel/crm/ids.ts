/**
 * Prefixed ULID helpers. The CRM uses the same id prefix scheme as
 * `docs/03-event-taxonomy-and-schemas.md` §B (crm_… contacts, lds_… leads,
 * bkg_… bookings, pip_… pipelines, stg_… stages, act_… activities).
 */

import { ulid } from "ulid";

export type ContactId = `crm_${string}`;
export type LeadId = `lds_${string}`;
export type BookingId = `bkg_${string}`;
export type PipelineId = `pip_${string}`;
export type StageId = `stg_${string}`;
export type ActivityId = `act_${string}`;
export type TagId = `tag_${string}`;
export type ListId = `lst_${string}`;
export type CustomFieldId = `cfd_${string}`;
export type ExportId = `exp_${string}`;
export type ImportId = `imp_${string}`;

export const newContactId = (): ContactId => `crm_${ulid()}`;
export const newLeadId = (): LeadId => `lds_${ulid()}`;
export const newBookingId = (): BookingId => `bkg_${ulid()}`;
export const newPipelineId = (): PipelineId => `pip_${ulid()}`;
export const newStageId = (): StageId => `stg_${ulid()}`;
export const newActivityId = (): ActivityId => `act_${ulid()}`;
export const newTagId = (): TagId => `tag_${ulid()}`;
export const newListId = (): ListId => `lst_${ulid()}`;
export const newCustomFieldId = (): CustomFieldId => `cfd_${ulid()}`;
export const newExportId = (): ExportId => `exp_${ulid()}`;
export const newImportId = (): ImportId => `imp_${ulid()}`;
