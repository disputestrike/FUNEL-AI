import { z } from "zod";
import { id, isoDateTime, jsonObject } from "./common.js";

export const DeletionTombstoneSchema = z.object({
  requestId: id("deletionRequest"),
  subjectType: z.enum(["user", "lead", "crm_contact", "workspace"]),
  subjectIdHash: z.string().length(64),
  workspaceId: id("workspace").nullable().optional(),
  legalBasis: z.enum(["gdpr_dsar", "ccpa", "user_self_serve", "ops_purge"]),
  scopeSummary: jsonObject,
  completedAt: isoDateTime,
  verifierUserId: id("user").nullable().optional(),
});

export const SuppressionEntrySchema = z.object({
  id: id("suppression"),
  workspaceId: id("workspace"),
  channel: z.enum(["sms", "email", "call"]),
  identifierSha256: z.string().length(64),
  reason: z.enum(["user_opt_out", "tcpa_complaint", "bounce", "admin"]),
  sourceEventId: id("eventLog").nullable().optional(),
  addedAt: isoDateTime,
});

export const KbPackSchema = z.object({
  id: id("kbPack"),
  vertical: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(32),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  contentBlob: jsonObject.default({}),
  regulatoryRefs: z.array(jsonObject).default([]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type DeletionTombstone = z.infer<typeof DeletionTombstoneSchema>;
export type SuppressionEntry = z.infer<typeof SuppressionEntrySchema>;
export type KbPack = z.infer<typeof KbPackSchema>;
