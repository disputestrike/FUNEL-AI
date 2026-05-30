/**
 * GoFunnelAI — Level 2 Launch Center domain types.
 *
 * Brand: GoFunnelAI (gofunnelai.com)
 *
 * Authoritative TypeScript surface for the Launch Center subsystem. Shapes
 * mirror the Prisma DB models (when present) and are referenced by the Zod
 * schemas in `./schemas.ts`. Keep this file pure: no runtime side effects,
 * no Zod imports, no DB client imports.
 */

import type { UserId, WorkspaceId } from "../types/workspace.js";
import type { FunnelId } from "../types/funnel.js";

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export type CampaignId = string;
export type CampaignPlatformId = string;
export type AdVariantId = string;
export type CreativeAssetId = string;
export type VideoAssetId = string;
export type AudienceProfileId = string;
export type UtmLinkId = string;
export type TrackingEventId = string;
export type LaunchChecklistId = string;
export type LaunchChecklistItemId = string;
export type ComplianceReviewId = string;
export type ExportPackageId = string;
export type FollowupSequenceId = string;
export type RetargetingRuleId = string;
export type LaunchScoreId = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Ad platforms supported by the Launch Center. The string values are stable
 * over the wire and used as DB string columns.
 */
export enum Platform {
  Meta = "meta",
  Google = "google",
  TikTok = "tiktok",
  YouTube = "youtube",
  LinkedIn = "linkedin",
  X = "x",
  Snapchat = "snapchat",
  Pinterest = "pinterest",
  Reddit = "reddit",
}

/**
 * The 8 canonical ad angles GoFunnelAI generates variants against.
 * See `./angles.ts` for descriptions.
 */
export enum AdAngle {
  Pain = "pain",
  Roi = "roi",
  Speed = "speed",
  Proof = "proof",
  Comparison = "comparison",
  Fear = "fear",
  Convenience = "convenience",
  Trust = "trust",
}

export enum VideoType {
  ShortForm = "short_form",        // <= 60s vertical 9:16
  LongForm = "long_form",          // > 60s horizontal 16:9
  Square = "square",               // 1:1 1-2min
  Story = "story",                 // 9:16 <=15s ephemeral
  Reel = "reel",                   // 9:16 15-90s
  UgcStyle = "ugc_style",          // creator-style hand-held
  ScreenRecord = "screen_record",  // product demo
  Animated = "animated",           // motion graphics
}

export enum CreativeType {
  Image = "image",
  Video = "video",
  Carousel = "carousel",
  Headline = "headline",
  PrimaryText = "primary_text",
  Description = "description",
  Cta = "cta",
  Thumbnail = "thumbnail",
}

export enum ChecklistStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Passed = "passed",
  Failed = "failed",
  Skipped = "skipped",
  NotApplicable = "not_applicable",
}

export enum ComplianceSeverity {
  Info = "info",
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
  Blocker = "blocker",
}

export enum ExportFormat {
  MetaAdsCsv = "meta_ads_csv",
  GoogleAdsCsv = "google_ads_csv",
  TikTokAdsCsv = "tiktok_ads_csv",
  LinkedInCampaignManagerCsv = "linkedin_campaign_manager_csv",
  Json = "json",
  Pdf = "pdf",
  Zip = "zip",
  NotionMarkdown = "notion_markdown",
}

export enum FollowupChannel {
  Email = "email",
  Sms = "sms",
  WhatsApp = "whatsapp",
  Voice = "voice",
  Push = "push",
  InApp = "in_app",
  DirectMail = "direct_mail",
}

export enum RetargetingTrigger {
  PageView = "page_view",
  VideoView25 = "video_view_25",
  VideoView50 = "video_view_50",
  VideoView75 = "video_view_75",
  VideoView95 = "video_view_95",
  AddToCart = "add_to_cart",
  CheckoutStart = "checkout_start",
  PurchaseAbandoned = "purchase_abandoned",
  LeadCaptured = "lead_captured",
  LeadNotCaptured = "lead_not_captured",
  EmailOpen = "email_open",
  EmailClick = "email_click",
  CustomEvent = "custom_event",
}

export enum TrackingEventType {
  Impression = "impression",
  Click = "click",
  LandingPageView = "landing_page_view",
  Lead = "lead",
  AddToCart = "add_to_cart",
  CheckoutStart = "checkout_start",
  Purchase = "purchase",
  Subscribe = "subscribe",
  CompleteRegistration = "complete_registration",
  ViewContent = "view_content",
  Search = "search",
  Custom = "custom",
}

/**
 * Lifecycle states for a Campaign. See `./lifecycle.ts` for the transition
 * graph and `canTransition()` helper.
 */
export enum CampaignStatus {
  Draft = "draft",
  Generating = "generating",
  ReadyForReview = "ready_for_review",
  Approved = "approved",
  Exported = "exported",
  LaunchedExternally = "launched_externally",
  TrackingActive = "tracking_active",
  Optimizing = "optimizing",
  Archived = "archived",
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface Campaign {
  id: CampaignId;
  workspaceId: WorkspaceId;
  funnelId: FunnelId;
  name: string;
  objective: string;
  status: CampaignStatus;
  budgetMicros: bigint;
  dailyCapMicros: bigint | null;
  currency: string; // ISO 4217
  scheduleStart: Date | null;
  scheduleEnd: Date | null;
  launchedAt: Date | null;
  pausedAt: Date | null;
  archivedAt: Date | null;
  platforms: Platform[];
  audienceProfileIds: AudienceProfileId[];
  primaryAngle: AdAngle | null;
  readinessScore: number | null; // 0..100, see LaunchScore
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface CampaignPlatform {
  id: CampaignPlatformId;
  campaignId: CampaignId;
  platform: Platform;
  externalCampaignId: string | null;
  enabled: boolean;
  budgetMicros: bigint;
  dailyCapMicros: bigint | null;
  conversionsApiEnabled: boolean;
  pixelId: string | null;
  conversionsApiToken: string | null;
  status: CampaignStatus;
  metricsBlob: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdVariant {
  id: AdVariantId;
  campaignId: CampaignId;
  platform: Platform;
  angle: AdAngle;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string;
  destinationUrl: string;
  creativeAssetIds: CreativeAssetId[];
  videoAssetIds: VideoAssetId[];
  utmLinkId: UtmLinkId | null;
  language: string; // BCP-47
  status: "draft" | "ready" | "approved" | "rejected" | "archived";
  rejectionReason: string | null;
  predictedCtr: number | null;
  predictedCpa: number | null;
  qualityScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreativeAsset {
  id: CreativeAssetId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId | null;
  type: CreativeType;
  mimeType: string;
  s3Uri: string;
  cdnUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  sha256: string;
  altText: string | null;
  textOverlay: string | null;
  generatedByAgent: boolean;
  generationId: string | null;
  createdAt: Date;
}

export interface VideoAsset {
  id: VideoAssetId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId | null;
  videoType: VideoType;
  s3Uri: string;
  cdnUrl: string | null;
  posterS3Uri: string | null;
  durationSec: number;
  width: number;
  height: number;
  aspectRatio: string; // "9:16", "16:9", "1:1"
  bytes: number;
  sha256: string;
  hasCaptions: boolean;
  captionsS3Uri: string | null;
  hasVoiceover: boolean;
  voiceoverS3Uri: string | null;
  hooks: string[]; // text of first-frame hooks
  script: string | null;
  generatedByAgent: boolean;
  generationId: string | null;
  createdAt: Date;
}

export interface AudienceProfile {
  id: AudienceProfileId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId | null;
  name: string;
  geo: {
    countries: string[];
    regions: string[];
    cities: string[];
    radiusKm: number | null;
  };
  ageMin: number | null;
  ageMax: number | null;
  genders: ("male" | "female" | "all")[];
  languages: string[];
  interests: string[];
  behaviors: string[];
  jobTitles: string[];
  industries: string[];
  incomeRange: { min: number | null; max: number | null; currency: string } | null;
  excludeInterests: string[];
  customAudiences: string[];
  lookalikeSourceId: string | null;
  lookalikeSimilarity: number | null; // 1..10 (Meta), 1..5 (TikTok)
  estimatedReach: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UtmLink {
  id: UtmLinkId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string | null;
  utmContent: string | null;
  shortCode: string | null;
  shortUrl: string | null;
  clickCount: number;
  createdAt: Date;
}

export interface TrackingEvent {
  id: TrackingEventId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId;
  platform: Platform;
  eventType: TrackingEventType;
  externalEventId: string | null;
  occurredAt: Date;
  receivedAt: Date;
  valueMicros: bigint | null;
  currency: string | null;
  utmLinkId: UtmLinkId | null;
  userIdHash: string | null;
  emailHash: string | null;
  phoneHash: string | null;
  ipHash: string | null;
  userAgent: string | null;
  customData: Record<string, unknown>;
  conversionsApiSent: boolean;
  conversionsApiResponse: Record<string, unknown> | null;
}

export interface LaunchChecklistItem {
  id: LaunchChecklistItemId;
  key: string; // stable identifier, e.g. "pixel_installed"
  label: string;
  status: ChecklistStatus;
  required: boolean;
  details: string | null;
  evidenceUrl: string | null;
  completedAt: Date | null;
  completedBy: UserId | null;
}

export interface LaunchChecklist {
  id: LaunchChecklistId;
  campaignId: CampaignId;
  items: LaunchChecklistItem[];
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  overallStatus: ChecklistStatus;
  lastEvaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReviewFinding {
  code: string;
  severity: ComplianceSeverity;
  message: string;
  targetType: "campaign" | "ad_variant" | "creative_asset" | "video_asset" | "audience" | "landing_page";
  targetId: string;
  policyRef: string | null;
  autoFixable: boolean;
  suggestedFix: string | null;
}

export interface ComplianceReview {
  id: ComplianceReviewId;
  campaignId: CampaignId;
  reviewerType: "automated" | "human";
  reviewerId: UserId | null;
  status: "pending" | "passed" | "passed_with_warnings" | "blocked";
  findings: ComplianceReviewFinding[];
  highestSeverity: ComplianceSeverity | null;
  approvedAt: Date | null;
  approvedBy: UserId | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportPackage {
  id: ExportPackageId;
  campaignId: CampaignId;
  format: ExportFormat;
  platform: Platform | null; // null for multi-platform bundle (zip)
  s3Uri: string;
  cdnUrl: string | null;
  sha256: string;
  bytes: number;
  variantCount: number;
  assetCount: number;
  expiresAt: Date | null;
  downloadedCount: number;
  generatedAt: Date;
  generatedBy: UserId;
}

export interface FollowupSequenceStep {
  order: number;
  channel: FollowupChannel;
  delayMinutes: number;
  templateId: string;
  subject: string | null;
  body: string;
  abTestVariantOf: number | null;
}

export interface FollowupSequence {
  id: FollowupSequenceId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId;
  name: string;
  trigger: "lead_captured" | "purchase" | "checkout_abandoned" | "custom";
  steps: FollowupSequenceStep[];
  status: "draft" | "active" | "paused" | "archived";
  enrolledCount: number;
  completedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetargetingRule {
  id: RetargetingRuleId;
  workspaceId: WorkspaceId;
  campaignId: CampaignId;
  name: string;
  trigger: RetargetingTrigger;
  withinDays: number;
  excludeIfConverted: boolean;
  targetAudienceProfileId: AudienceProfileId | null;
  creativeVariantIds: AdVariantId[];
  bidMultiplier: number; // e.g. 1.5 = +50%
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Composite "Launch Readiness" score. See `./scores.ts` for the weighted
 * formula that produces `overall` from the sub-scores.
 */
export interface LaunchScore {
  id: LaunchScoreId;
  campaignId: CampaignId;
  overall: number; // 0..100
  creativeQuality: number;
  audienceFit: number;
  trackingCoverage: number;
  complianceConfidence: number;
  budgetRealism: number;
  funnelReadiness: number;
  followupCoverage: number;
  computedAt: Date;
  inputs: Record<string, unknown>;
}
