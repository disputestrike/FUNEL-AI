/**
 * GoFunnelAI — Launch Center Zod schemas.
 *
 * One Zod schema per interface in `./types.ts`. Use these at every trust
 * boundary (HTTP, queue payloads, agent tool outputs, DB hydration). Inferred
 * types are *structurally* compatible with the hand-written interfaces in
 * `./types.ts`; treat the hand-written types as canonical and these schemas
 * as the validation layer.
 */

import { z } from "zod";

import {
  AdAngle,
  CampaignStatus,
  ChecklistStatus,
  ComplianceSeverity,
  CreativeType,
  ExportFormat,
  FollowupChannel,
  Platform,
  RetargetingTrigger,
  TrackingEventType,
  VideoType,
} from "./types.js";

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const PlatformSchema = z.nativeEnum(Platform);
export const AdAngleSchema = z.nativeEnum(AdAngle);
export const VideoTypeSchema = z.nativeEnum(VideoType);
export const CreativeTypeSchema = z.nativeEnum(CreativeType);
export const ChecklistStatusSchema = z.nativeEnum(ChecklistStatus);
export const ComplianceSeveritySchema = z.nativeEnum(ComplianceSeverity);
export const ExportFormatSchema = z.nativeEnum(ExportFormat);
export const FollowupChannelSchema = z.nativeEnum(FollowupChannel);
export const RetargetingTriggerSchema = z.nativeEnum(RetargetingTrigger);
export const TrackingEventTypeSchema = z.nativeEnum(TrackingEventType);
export const CampaignStatusSchema = z.nativeEnum(CampaignStatus);

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const Id = z.string().min(1);
const Iso4217 = z.string().length(3);
const Bcp47 = z.string().min(2).max(35);
const Micros = z.bigint();
const Url = z.string().url();
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/i);

// ---------------------------------------------------------------------------
// Core entity schemas
// ---------------------------------------------------------------------------

export const CampaignSchema = z.object({
  id: Id,
  workspaceId: Id,
  funnelId: Id,
  name: z.string().min(1).max(200),
  objective: z.string().min(1),
  status: CampaignStatusSchema,
  budgetMicros: Micros,
  dailyCapMicros: Micros.nullable(),
  currency: Iso4217,
  scheduleStart: z.date().nullable(),
  scheduleEnd: z.date().nullable(),
  launchedAt: z.date().nullable(),
  pausedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  platforms: z.array(PlatformSchema),
  audienceProfileIds: z.array(Id),
  primaryAngle: AdAngleSchema.nullable(),
  readinessScore: z.number().min(0).max(100).nullable(),
  createdBy: Id,
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  metadata: z.record(z.unknown()),
});

export const CampaignPlatformSchema = z.object({
  id: Id,
  campaignId: Id,
  platform: PlatformSchema,
  externalCampaignId: z.string().nullable(),
  enabled: z.boolean(),
  budgetMicros: Micros,
  dailyCapMicros: Micros.nullable(),
  conversionsApiEnabled: z.boolean(),
  pixelId: z.string().nullable(),
  conversionsApiToken: z.string().nullable(),
  status: CampaignStatusSchema,
  metricsBlob: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AdVariantSchema = z.object({
  id: Id,
  campaignId: Id,
  platform: PlatformSchema,
  angle: AdAngleSchema,
  headline: z.string().min(1).max(255),
  primaryText: z.string().min(1),
  description: z.string().nullable(),
  cta: z.string().min(1).max(40),
  destinationUrl: Url,
  creativeAssetIds: z.array(Id),
  videoAssetIds: z.array(Id),
  utmLinkId: Id.nullable(),
  language: Bcp47,
  status: z.enum(["draft", "ready", "approved", "rejected", "archived"]),
  rejectionReason: z.string().nullable(),
  predictedCtr: z.number().min(0).max(1).nullable(),
  predictedCpa: z.number().min(0).nullable(),
  qualityScore: z.number().min(0).max(100).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreativeAssetSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id.nullable(),
  type: CreativeTypeSchema,
  mimeType: z.string().min(1),
  s3Uri: z.string().startsWith("s3://"),
  cdnUrl: Url.nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  bytes: z.number().int().nonnegative(),
  sha256: Sha256,
  altText: z.string().nullable(),
  textOverlay: z.string().nullable(),
  generatedByAgent: z.boolean(),
  generationId: z.string().nullable(),
  createdAt: z.date(),
});

export const VideoAssetSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id.nullable(),
  videoType: VideoTypeSchema,
  s3Uri: z.string().startsWith("s3://"),
  cdnUrl: Url.nullable(),
  posterS3Uri: z.string().startsWith("s3://").nullable(),
  durationSec: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.string().regex(/^\d+:\d+$/),
  bytes: z.number().int().nonnegative(),
  sha256: Sha256,
  hasCaptions: z.boolean(),
  captionsS3Uri: z.string().startsWith("s3://").nullable(),
  hasVoiceover: z.boolean(),
  voiceoverS3Uri: z.string().startsWith("s3://").nullable(),
  hooks: z.array(z.string()),
  script: z.string().nullable(),
  generatedByAgent: z.boolean(),
  generationId: z.string().nullable(),
  createdAt: z.date(),
});

export const AudienceProfileSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id.nullable(),
  name: z.string().min(1),
  geo: z.object({
    countries: z.array(z.string().length(2)),
    regions: z.array(z.string()),
    cities: z.array(z.string()),
    radiusKm: z.number().positive().nullable(),
  }),
  ageMin: z.number().int().min(13).max(120).nullable(),
  ageMax: z.number().int().min(13).max(120).nullable(),
  genders: z.array(z.enum(["male", "female", "all"])),
  languages: z.array(Bcp47),
  interests: z.array(z.string()),
  behaviors: z.array(z.string()),
  jobTitles: z.array(z.string()),
  industries: z.array(z.string()),
  incomeRange: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: Iso4217,
    })
    .nullable(),
  excludeInterests: z.array(z.string()),
  customAudiences: z.array(z.string()),
  lookalikeSourceId: z.string().nullable(),
  lookalikeSimilarity: z.number().min(1).max(10).nullable(),
  estimatedReach: z.number().int().nonnegative().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UtmLinkSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id,
  destinationUrl: Url,
  utmSource: z.string().min(1),
  utmMedium: z.string().min(1),
  utmCampaign: z.string().min(1),
  utmTerm: z.string().nullable(),
  utmContent: z.string().nullable(),
  shortCode: z.string().nullable(),
  shortUrl: Url.nullable(),
  clickCount: z.number().int().nonnegative(),
  createdAt: z.date(),
});

export const TrackingEventSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id,
  platform: PlatformSchema,
  eventType: TrackingEventTypeSchema,
  externalEventId: z.string().nullable(),
  occurredAt: z.date(),
  receivedAt: z.date(),
  valueMicros: Micros.nullable(),
  currency: Iso4217.nullable(),
  utmLinkId: Id.nullable(),
  userIdHash: z.string().nullable(),
  emailHash: z.string().nullable(),
  phoneHash: z.string().nullable(),
  ipHash: z.string().nullable(),
  userAgent: z.string().nullable(),
  customData: z.record(z.unknown()),
  conversionsApiSent: z.boolean(),
  conversionsApiResponse: z.record(z.unknown()).nullable(),
});

export const LaunchChecklistItemSchema = z.object({
  id: Id,
  key: z.string().min(1),
  label: z.string().min(1),
  status: ChecklistStatusSchema,
  required: z.boolean(),
  details: z.string().nullable(),
  evidenceUrl: Url.nullable(),
  completedAt: z.date().nullable(),
  completedBy: Id.nullable(),
});

export const LaunchChecklistSchema = z.object({
  id: Id,
  campaignId: Id,
  items: z.array(LaunchChecklistItemSchema),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  overallStatus: ChecklistStatusSchema,
  lastEvaluatedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ComplianceReviewFindingSchema = z.object({
  code: z.string().min(1),
  severity: ComplianceSeveritySchema,
  message: z.string().min(1),
  targetType: z.enum([
    "campaign",
    "ad_variant",
    "creative_asset",
    "video_asset",
    "audience",
    "landing_page",
  ]),
  targetId: Id,
  policyRef: z.string().nullable(),
  autoFixable: z.boolean(),
  suggestedFix: z.string().nullable(),
});

export const ComplianceReviewSchema = z.object({
  id: Id,
  campaignId: Id,
  reviewerType: z.enum(["automated", "human"]),
  reviewerId: Id.nullable(),
  status: z.enum(["pending", "passed", "passed_with_warnings", "blocked"]),
  findings: z.array(ComplianceReviewFindingSchema),
  highestSeverity: ComplianceSeveritySchema.nullable(),
  approvedAt: z.date().nullable(),
  approvedBy: Id.nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ExportPackageSchema = z.object({
  id: Id,
  campaignId: Id,
  format: ExportFormatSchema,
  platform: PlatformSchema.nullable(),
  s3Uri: z.string().startsWith("s3://"),
  cdnUrl: Url.nullable(),
  sha256: Sha256,
  bytes: z.number().int().nonnegative(),
  variantCount: z.number().int().nonnegative(),
  assetCount: z.number().int().nonnegative(),
  expiresAt: z.date().nullable(),
  downloadedCount: z.number().int().nonnegative(),
  generatedAt: z.date(),
  generatedBy: Id,
});

export const FollowupSequenceStepSchema = z.object({
  order: z.number().int().nonnegative(),
  channel: FollowupChannelSchema,
  delayMinutes: z.number().int().nonnegative(),
  templateId: z.string().min(1),
  subject: z.string().nullable(),
  body: z.string().min(1),
  abTestVariantOf: z.number().int().nonnegative().nullable(),
});

export const FollowupSequenceSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id,
  name: z.string().min(1),
  trigger: z.enum(["lead_captured", "purchase", "checkout_abandoned", "custom"]),
  steps: z.array(FollowupSequenceStepSchema),
  status: z.enum(["draft", "active", "paused", "archived"]),
  enrolledCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RetargetingRuleSchema = z.object({
  id: Id,
  workspaceId: Id,
  campaignId: Id,
  name: z.string().min(1),
  trigger: RetargetingTriggerSchema,
  withinDays: z.number().int().positive(),
  excludeIfConverted: z.boolean(),
  targetAudienceProfileId: Id.nullable(),
  creativeVariantIds: z.array(Id),
  bidMultiplier: z.number().positive(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const LaunchScoreSchema = z.object({
  id: Id,
  campaignId: Id,
  overall: z.number().min(0).max(100),
  creativeQuality: z.number().min(0).max(100),
  audienceFit: z.number().min(0).max(100),
  trackingCoverage: z.number().min(0).max(100),
  complianceConfidence: z.number().min(0).max(100),
  budgetRealism: z.number().min(0).max(100),
  funnelReadiness: z.number().min(0).max(100),
  followupCoverage: z.number().min(0).max(100),
  computedAt: z.date(),
  inputs: z.record(z.unknown()),
});

// ---------------------------------------------------------------------------
// Inferred types (for callers that want zod-derived types)
// ---------------------------------------------------------------------------

export type CampaignInput = z.infer<typeof CampaignSchema>;
export type CampaignPlatformInput = z.infer<typeof CampaignPlatformSchema>;
export type AdVariantInput = z.infer<typeof AdVariantSchema>;
export type CreativeAssetInput = z.infer<typeof CreativeAssetSchema>;
export type VideoAssetInput = z.infer<typeof VideoAssetSchema>;
export type AudienceProfileInput = z.infer<typeof AudienceProfileSchema>;
export type UtmLinkInput = z.infer<typeof UtmLinkSchema>;
export type TrackingEventInput = z.infer<typeof TrackingEventSchema>;
export type LaunchChecklistInput = z.infer<typeof LaunchChecklistSchema>;
export type ComplianceReviewInput = z.infer<typeof ComplianceReviewSchema>;
export type ExportPackageInput = z.infer<typeof ExportPackageSchema>;
export type FollowupSequenceInput = z.infer<typeof FollowupSequenceSchema>;
export type RetargetingRuleInput = z.infer<typeof RetargetingRuleSchema>;
export type LaunchScoreInput = z.infer<typeof LaunchScoreSchema>;
