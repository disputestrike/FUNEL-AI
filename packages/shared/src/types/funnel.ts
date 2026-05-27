/**
 * Funnel domain types.
 *
 * Mirrors the JSON Schema in doc 18. The canonical Zod definition (with the
 * 60-block discriminated union for `Section.content`) lives in
 * `funnel-schema.ts`; this module exposes a TypeScript-only surface that
 * downstream packages can import without depending on Zod at runtime.
 */

import type { UserId, WorkspaceId } from "./workspace.js";

export type FunnelId = string;
export type FunnelVersionId = string;
export type PageId = string;
export type SectionId = string;
export type AssetId = string;
export type FormId = string;
export type CtaId = string;
export type GenerationId = string;

export enum FunnelStatus {
  Draft = "draft",
  InReview = "in_review",
  Published = "published",
  Archived = "archived",
  BlockedByCompliance = "blocked_by_compliance",
}

export enum PageType {
  Landing = "landing",
  ThankYou = "thank-you",
  Checkout = "checkout",
  Upsell = "upsell",
  Downsell = "downsell",
  Membership = "membership",
  Booking = "booking",
  Confirmation = "confirmation",
}

/**
 * The 60 canonical block types. Keep this enum in lock-step with the
 * `BlockType` union in `funnel-schema.ts`.
 */
export const BLOCK_TYPES = [
  "hero.classic",
  "hero.video",
  "hero.split",
  "hero.minimal",
  "hero.benefit-driven",
  "hero.urgency",
  "form.inline-single-field",
  "form.classic-3-field",
  "form.long-7-field",
  "form.multi-step",
  "form.calculator",
  "form.quiz",
  "form.consultation-booking",
  "form.payment",
  "proof.testimonial-grid",
  "proof.testimonial-single-large",
  "proof.logo-bar",
  "proof.stat-row",
  "proof.before-after",
  "proof.case-study-summary",
  "proof.video-testimonial",
  "proof.review-snippet",
  "offer.feature-grid",
  "offer.benefit-list",
  "offer.comparison-table",
  "offer.value-stack",
  "offer.pricing-tiers",
  "offer.single-card",
  "offer.bundle-savings",
  "offer.limited-time",
  "cta.button-single",
  "cta.button-pair",
  "cta.banner",
  "cta.floating",
  "content.text-block",
  "content.faq",
  "content.video-embed",
  "content.image",
  "content.gallery",
  "content.code-snippet",
  "content.quote",
  "content.bullet-list",
  "trust.badge-row",
  "trust.guarantee",
  "trust.certification",
  "trust.team",
  "trust.history",
  "trust.compliance",
  "interactive.countdown-timer",
  "interactive.calculator",
  "interactive.product-finder",
  "interactive.live-chat-embed",
  "interactive.calendar-booking-embed",
  "interactive.video-with-cta-overlay",
  "footer.minimal",
  "footer.full",
  "specialty.lead-magnet-delivery",
  "specialty.webinar-registration",
  "specialty.contest-entry",
  "specialty.referral-program-signup",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Style overrides on any section. */
export interface StyleOverrides {
  background?: string;
  text_color?: string;
  padding_y?: "none" | "sm" | "md" | "lg" | "xl";
  max_width?: "narrow" | "default" | "wide" | "full";
  alignment?: "left" | "center" | "right";
  border_top?: boolean;
  border_bottom?: boolean;
}

export interface ConditionalDisplay {
  device?: "all" | "mobile_only" | "desktop_only";
  geo_allow?: string[]; // ISO 3166-1 alpha-2 codes
  geo_deny?: string[];
  utm_match?: Record<string, string>;
  schedule_start?: string;
  schedule_end?: string;
}

export interface SectionVariant {
  id: string;
  label?: string;
  weight: number; // 0..1
  content: Record<string, unknown>;
}

export interface Block {
  id: SectionId;
  type: BlockType;
  variant?: string;
  content: Record<string, unknown>;
  style_overrides?: StyleOverrides;
  conditional_display?: ConditionalDisplay;
  variants?: SectionVariant[];
}

/** Alias for legibility — a Section IS a Block in this schema. */
export type Section = Block;

export interface PageMetadata {
  title?: string;
  description?: string;
  og_image?: AssetId;
  schema_markup?: Record<string, unknown>;
  canonical_url?: string;
  robots?: "index,follow" | "noindex,follow" | "index,nofollow" | "noindex,nofollow";
}

export interface PageTrackingPixel {
  provider:
    | "meta"
    | "google_ads"
    | "google_analytics"
    | "tiktok"
    | "linkedin"
    | "x"
    | "pinterest"
    | "custom";
  id: string;
  events?: string[];
}

export interface PageTracking {
  pixels?: PageTrackingPixel[];
  utm_passthrough?: boolean;
  consent_required?: boolean;
}

export interface Page {
  id: PageId;
  name?: string;
  type: PageType;
  slug?: string;
  sections: Section[];
  page_metadata?: PageMetadata;
  tracking?: PageTracking;
  redirect_after_submit_page_id?: PageId;
}

export interface FunnelMetadata {
  id: FunnelId;
  workspace_id: WorkspaceId;
  name: string;
  slug: string;
  /** SemVer of THIS funnel, not the schema. */
  version: string;
  status: FunnelStatus;
  /** BCP47 e.g. "en", "en-US", "es-MX". */
  language: string;
  geography?: {
    country?: string;
    region?: string;
    timezone?: string;
  };
  /** Industry slug from `INDUSTRIES`. */
  industry?: string;
  voice_persona?: {
    tone?: "expert" | "friendly" | "urgent" | "premium" | "playful" | "no-bs";
    reading_level?: number;
    formality?: "formal" | "neutral" | "casual";
    voice_keywords?: string[];
    do_not_use?: string[];
    /** Funnel persona slug — `Funnel/Maven/Coach/Rebel/Maestro`. */
    persona_slug?: string;
  };
  created_at: string;
  updated_at: string;
  created_by?: UserId;
  tags?: string[];
}

export interface ComplianceFinding {
  severity: "info" | "warning" | "blocker";
  rule_id: string;
  message: string;
  section_id?: SectionId;
}

export interface FactCheckFinding {
  claim_text?: string;
  claim_status?: "verified" | "needs_source" | "unverifiable" | "false";
  evidence_url?: string;
  section_id?: SectionId;
}

export interface FunnelComplianceState {
  ai_disclosure_visible: boolean;
  publish_acknowledged_at?: string;
  publish_acknowledged_by?: UserId;
  regulated_vertical_flag: boolean;
  compliance_agent_pass_at?: string;
  compliance_agent_findings?: ComplianceFinding[];
  fact_check_pass_at?: string;
  fact_check_findings?: FactCheckFinding[];
  /** SHA-256 over the canonicalized content snapshot. */
  content_hash?: string;
  audit_log_pointer?: string;
  data_processor_addendum_signed_at?: string;
}

export interface GenerationProvenance {
  generated_at: string;
  model_versions: Array<{
    role:
      | "planner"
      | "writer"
      | "designer"
      | "compliance"
      | "fact_check"
      | "image"
      | "video";
    model: string;
  }>;
  kb_pack_version: string;
  kb_snapshot_id?: string;
  prompt_hash_per_section?: Record<string, string>;
  cost_usd?: {
    total?: number;
    by_role?: Record<string, number>;
    currency?: string;
  };
  seed?: number;
  regeneration_lineage?: Array<{
    parent_funnel_id?: FunnelId;
    regenerated_at?: string;
    reason?: string;
  }>;
}

export interface AssetLicenseMetadata {
  source?: string;
  license_id?: string;
  purchased_by?: UserId;
  purchase_date?: string;
  ai_model?: string;
  ai_prompt_hash?: string;
}

export interface Asset {
  id: AssetId;
  type: "image" | "video" | "audio" | "document";
  url: string;
  license_type:
    | "royalty_free"
    | "creative_commons"
    | "purchased"
    | "user_uploaded"
    | "ai_generated"
    | "public_domain";
  license_metadata?: AssetLicenseMetadata;
  license_attribution?: string;
  alt_text?: string;
  dimensions?: {
    width_px?: number;
    height_px?: number;
    duration_seconds?: number;
  };
  file_size_bytes?: number;
  mime_type?: string;
  checksum_sha256?: string;
}

export interface FormFieldValidation {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom_message?: string;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "textarea"
    | "select"
    | "multiselect"
    | "radio"
    | "checkbox"
    | "date"
    | "time"
    | "address"
    | "hidden"
    | "consent"
    | "file";
  label: string;
  name: string;
  placeholder?: string;
  help_text?: string;
  required?: boolean;
  default_value?: string;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  pii_classification?: "none" | "low" | "medium" | "high";
}

export interface Form {
  id: FormId;
  name?: string;
  fields: FormField[];
  submit_action: {
    type:
      | "redirect_to_page"
      | "redirect_to_url"
      | "show_message"
      | "trigger_download"
      | "open_calendar"
      | "start_checkout";
    redirect_page_id?: PageId;
    redirect_url?: string;
    message_markdown?: string;
    download_asset_id?: AssetId;
    calendar_provider?: "calendly" | "cal_com" | "google" | "native";
    checkout_offer_id?: string;
  };
  lead_routing_rules?: unknown[];
  consent_capture?: {
    marketing_consent_required?: boolean;
    marketing_consent_copy?: string;
    tcpa_required?: boolean;
    tcpa_copy?: string;
    gdpr_required?: boolean;
    data_processor_disclosure?: string;
  };
  success_state?: {
    headline?: string;
    body_markdown?: string;
    next_step_cta_id?: CtaId;
  };
  anti_spam?: {
    honeypot?: boolean;
    rate_limit_per_ip_per_minute?: number;
    captcha?: "none" | "invisible_recaptcha_v3" | "turnstile";
  };
}

export interface CTA {
  id: CtaId;
  label: string;
  sublabel?: string;
  action: {
    type:
      | "link"
      | "form"
      | "checkout"
      | "booking"
      | "phone-call"
      | "scroll-to-section"
      | "open-modal"
      | "download";
    link_url?: string;
    form_id?: FormId;
    offer_id?: string;
    phone_e164?: string;
    scroll_section_id?: SectionId;
    modal_section_id?: SectionId;
    download_asset_id?: AssetId;
  };
  tracking_id?: string;
  style?: {
    variant?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg" | "xl";
    full_width_on_mobile?: boolean;
    icon_left?: string;
    icon_right?: string;
  };
}

/** The top-level Funnel JSON object. */
export interface Funnel {
  schema_version: string; // e.g. "1.0.0"
  metadata: FunnelMetadata;
  pages: Page[];
  assets?: Asset[];
  forms?: Form[];
  ctas?: CTA[];
  brand_tokens: import("./branding.js").FunnelBrandTokens;
  integrations?: Record<string, unknown>;
  compliance: FunnelComplianceState;
  provenance: GenerationProvenance;
}

/**
 * A frozen, immutable snapshot of a Funnel at a moment in time. Used by the
 * publish pipeline and the compliance attestation flow. Once `is_published`
 * flips to `true`, the `bundle_s3_uri` is the source of truth that the
 * renderer fetches.
 */
export interface FunnelVersion {
  id: FunnelVersionId;
  workspace_id: WorkspaceId;
  funnel_id: FunnelId;
  version_number: number;
  generation_id?: GenerationId;
  source: "agent" | "import" | "clone" | "manual";
  parent_version_id?: FunnelVersionId | null;
  artifact_hash: string; // sha256 of full bundle
  bundle_s3_uri: string;
  copy_blob: unknown;
  design_blob: unknown;
  config_blob: unknown;
  compliance_blob: FunnelComplianceState;
  quality_score?: number | null;
  is_published: boolean;
  published_at?: string | null;
  published_by?: UserId | null;
  unpublished_at?: string | null;
  created_at: string;
}
