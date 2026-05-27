import { z } from "zod";
import {
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonObject,
  tags,
} from "./common.js";

export const AssetTypeSchema = z.enum([
  "page",
  "copy",
  "image",
  "video",
  "script",
  "email",
  "sms",
  "ad_creative",
  "form",
]);

export const AssetSchema = z.object({
  id: id("asset"),
  workspaceId: id("workspace"),
  funnelId: id("funnel").nullable().optional(),
  type: AssetTypeSchema,
  name: z.string().min(1).max(200),
  currentVersionId: id("assetVersion").nullable().optional(),
  tags,
  createdBy: id("user").nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const AssetVersionSchema = z.object({
  id: id("assetVersion"),
  workspaceId: id("workspace"),
  assetId: id("asset"),
  versionNumber: z.number().int().positive(),
  generationId: id("generation").nullable().optional(),
  s3Uri: z.string().startsWith("s3://").max(2048).nullable().optional(),
  contentHash: z.string().min(1).max(128),
  mimeType: z.string().max(120).nullable().optional(),
  widthPx: z.number().int().positive().nullable().optional(),
  heightPx: z.number().int().positive().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  copyBlob: jsonObject.nullable().optional(),
  metadata: jsonObject.default({}),
  createdBy: id("user").nullable().optional(),
  createdAt: isoDateTime,
});

export type Asset = z.infer<typeof AssetSchema>;
export type AssetVersion = z.infer<typeof AssetVersionSchema>;
