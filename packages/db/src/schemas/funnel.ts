import { z } from "zod";
import {
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonObject,
} from "./common.js";

export const FunnelStatusSchema = z.enum([
  "draft",
  "review",
  "live",
  "paused",
  "archived",
]);

export const FunnelSchema = z.object({
  id: id("funnel"),
  workspaceId: id("workspace"),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120),
  status: FunnelStatusSchema.default("draft"),
  vertical: z.string().max(64).nullable().optional(),
  currentVersionId: id("funnelVersion").nullable().optional(),
  liveUrl: z.string().url().max(2048).nullable().optional(),
  customDomainId: id("customDomain").nullable().optional(),
  aiDisclosure: jsonObject.default({ enabled: true }),
  createdBy: id("user"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: isoDateTimeNullable,
  deletedAt: isoDateTimeNullable,
});

export const FunnelVersionSchema = z.object({
  id: id("funnelVersion"),
  workspaceId: id("workspace"),
  funnelId: id("funnel"),
  versionNumber: z.number().int().positive(),
  generationId: id("generation").nullable().optional(),
  source: z.enum(["agent", "import", "clone", "manual"]),
  parentVersionId: id("funnelVersion").nullable().optional(),
  artifactHash: z.string().min(1).max(128),
  bundleS3Uri: z.string().startsWith("s3://").max(2048),
  copyBlob: jsonObject,
  designBlob: jsonObject,
  configBlob: jsonObject,
  complianceBlob: jsonObject.default({}),
  qualityScore: z.number().min(0).max(100).nullable().optional(),
  isPublished: z.boolean().default(false),
  publishedAt: isoDateTimeNullable,
  publishedBy: id("user").nullable().optional(),
  unpublishedAt: isoDateTimeNullable,
  createdAt: isoDateTime,
});

export const CreateFunnelSchema = FunnelSchema.pick({
  id: true,
  workspaceId: true,
  name: true,
  slug: true,
  status: true,
  vertical: true,
  aiDisclosure: true,
  createdBy: true,
});

export const CreateFunnelVersionSchema = FunnelVersionSchema.pick({
  id: true,
  workspaceId: true,
  funnelId: true,
  versionNumber: true,
  generationId: true,
  source: true,
  parentVersionId: true,
  artifactHash: true,
  bundleS3Uri: true,
  copyBlob: true,
  designBlob: true,
  configBlob: true,
  complianceBlob: true,
  qualityScore: true,
});

export type Funnel = z.infer<typeof FunnelSchema>;
export type FunnelVersion = z.infer<typeof FunnelVersionSchema>;
