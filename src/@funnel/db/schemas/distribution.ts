import { z } from "zod";
import {
  currencyCode,
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonArray,
  jsonObject,
  moneyMicros,
} from "./common.js";

export const AdPlatformSchema = z.enum([
  "meta",
  "google",
  "tiktok",
  "linkedin",
  "reddit",
]);

export const AdCampaignSchema = z.object({
  id: id("adCampaign"),
  workspaceId: id("workspace"),
  funnelId: id("funnel"),
  platform: AdPlatformSchema,
  externalCampaignId: z.string().max(200).nullable().optional(),
  name: z.string().min(1).max(200),
  objective: z.string().min(1).max(64),
  status: z
    .enum(["draft", "launched", "paused", "rejected", "ended"])
    .default("draft"),
  budgetMicros: moneyMicros,
  dailyCapMicros: moneyMicros.nullable().optional(),
  currency: currencyCode,
  audienceBlob: jsonObject.default({}),
  creativeAssetIds: z.array(id("asset")).default([]),
  scheduleStart: isoDateTimeNullable,
  scheduleEnd: isoDateTimeNullable,
  launchedAt: isoDateTimeNullable,
  pausedAt: isoDateTimeNullable,
  rejectedAt: isoDateTimeNullable,
  rejectionCode: z.string().max(64).nullable().optional(),
  rejectionText: z.string().max(1000).nullable().optional(),
  spendToDateMicros: moneyMicros.default(0n as unknown as bigint),
  metricsBlob: jsonObject.default({}),
  createdBy: id("user"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const EmailSequenceSchema = z.object({
  id: id("emailSequence"),
  workspaceId: id("workspace"),
  funnelId: id("funnel").nullable().optional(),
  name: z.string().min(1).max(200),
  trigger: z.string().min(1).max(120),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
  steps: jsonArray.default([]),
  fromIdentityId: z.string().max(200).nullable().optional(),
  replyTo: z.string().email().max(320).nullable().optional(),
  metricsBlob: jsonObject.default({}),
  createdBy: id("user"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const SmsSequenceSchema = z.object({
  id: id("smsSequence"),
  workspaceId: id("workspace"),
  funnelId: id("funnel").nullable().optional(),
  name: z.string().min(1).max(200),
  trigger: z.string().min(1).max(120),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
  steps: jsonArray.default([]),
  brandId: z.string().max(200).nullable().optional(),
  campaignUseCase: z.string().max(120).nullable().optional(),
  quietHours: jsonObject.default({
    start: "21:00",
    end: "08:00",
    tz_strategy: "recipient",
  }),
  metricsBlob: jsonObject.default({}),
  createdBy: id("user"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const LeadMagnetSchema = z.object({
  id: id("leadMagnet"),
  workspaceId: id("workspace"),
  funnelId: id("funnel").nullable().optional(),
  type: z.enum(["pdf", "quiz", "calculator", "webinar", "checklist", "template"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  artifactS3Uri: z
    .string()
    .startsWith("s3://")
    .max(2048)
    .nullable()
    .optional(),
  artifactHash: z.string().max(128).nullable().optional(),
  generatedByAgent: z.boolean().default(false),
  generationId: id("generation").nullable().optional(),
  gatedFields: jsonArray.default(["email"]),
  downloadCount: z.number().int().nonnegative().default(0),
  status: z.string().min(1).max(32).default("draft"),
  createdBy: id("user").nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export type AdCampaign = z.infer<typeof AdCampaignSchema>;
export type EmailSequence = z.infer<typeof EmailSequenceSchema>;
export type SmsSequence = z.infer<typeof SmsSequenceSchema>;
export type LeadMagnet = z.infer<typeof LeadMagnetSchema>;
