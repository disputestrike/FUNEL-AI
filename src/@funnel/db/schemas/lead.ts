import { z } from "zod";
import {
  currencyCode,
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonObject,
  moneyMicros,
  tags,
} from "./common.js";

export const LeadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "disqualified",
  "booked",
  "converted",
  "closed",
]);

export const CrmContactSchema = z.object({
  id: id("crmContact"),
  workspaceId: id("workspace"),
  emailNormalized: z.string().email().nullable().optional(),
  emailSha256: z.string().length(64).nullable().optional(),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "expected E.164 phone")
    .nullable()
    .optional(),
  phoneSha256: z.string().length(64).nullable().optional(),
  fullName: z.string().max(200).nullable().optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  customFields: jsonObject.default({}),
  tags,
  consent: jsonObject.default({}),
  doNotContact: z.boolean().default(false),
  primarySource: z.string().max(64).nullable().optional(),
  firstSeenAt: isoDateTime,
  lastActivityAt: isoDateTimeNullable,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
  tombstone: z.boolean().default(false),
});

export const LeadSchema = z.object({
  id: id("lead"),
  workspaceId: id("workspace"),
  funnelId: id("funnel"),
  funnelVersionId: id("funnelVersion"),
  crmContactId: id("crmContact").nullable().optional(),
  status: LeadStatusSchema.default("new"),
  score: z.number().min(0).max(100).nullable().optional(),
  scoreBand: z.enum(["hot", "warm", "cold"]).nullable().optional(),
  scoreModelVersion: z.string().max(64).nullable().optional(),
  captureSource: z.string().min(1).max(64),
  captureUrl: z.string().url().max(2048).nullable().optional(),
  utm: jsonObject.default({}),
  ipHash: z.string().max(128).nullable().optional(),
  geoCountry: z.string().length(2).nullable().optional(),
  geoRegion: z.string().max(64).nullable().optional(),
  consentId: id("consent").nullable().optional(),
  attributionBlob: jsonObject.default({}),
  firstContactAt: isoDateTimeNullable,
  lastContactAt: isoDateTimeNullable,
  qualifiedAt: isoDateTimeNullable,
  disqualifiedAt: isoDateTimeNullable,
  disqualifiedReason: z.string().max(200).nullable().optional(),
  convertedAt: isoDateTimeNullable,
  conversionValueMicros: moneyMicros.nullable().optional(),
  conversionCurrency: currencyCode.nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const CreateLeadSchema = LeadSchema.pick({
  id: true,
  workspaceId: true,
  funnelId: true,
  funnelVersionId: true,
  crmContactId: true,
  status: true,
  captureSource: true,
  captureUrl: true,
  utm: true,
  ipHash: true,
  geoCountry: true,
  geoRegion: true,
  consentId: true,
  attributionBlob: true,
});

export const BookingStatusSchema = z.enum([
  "confirmed",
  "canceled",
  "completed",
  "no_show",
]);

export const BookingSchema = z.object({
  id: id("booking"),
  workspaceId: id("workspace"),
  leadId: id("lead"),
  funnelId: id("funnel"),
  hostUserId: id("user").nullable().optional(),
  externalCalendar: z
    .enum(["google", "outlook", "funnel_native"])
    .nullable()
    .optional(),
  externalEventId: z.string().max(200).nullable().optional(),
  scheduledFor: isoDateTime,
  durationMinutes: z.number().int().min(5).max(480).default(30),
  timezone: z.string().max(64).default("UTC"),
  meetingUrl: z.string().url().max(2048).nullable().optional(),
  status: BookingStatusSchema.default("confirmed"),
  canceledAt: isoDateTimeNullable,
  canceledBy: z.string().max(64).nullable().optional(),
  cancelReason: z.string().max(200).nullable().optional(),
  notesHash: z.string().max(128).nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export type CrmContact = z.infer<typeof CrmContactSchema>;
export type Lead = z.infer<typeof LeadSchema>;
export type Booking = z.infer<typeof BookingSchema>;
