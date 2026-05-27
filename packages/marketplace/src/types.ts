/**
 * @funnel/marketplace — domain types.
 *
 * Source: docs/16-viral-loops-spec.md §LOOP 4. All money in USD cents (integer)
 * to avoid float drift; @funnel/billing uses micros for finer-grained ledger
 * entries, but marketplace SKUs are coarse ($9/$19/$29/$49/$79/$99) so cents
 * suffice. We translate to/from micros only at the ledger boundary.
 */

import { z } from "zod";

/* ──────────────────────────────────────────────────────────────────────────
 * Enums and small primitives
 * ──────────────────────────────────────────────────────────────────────── */

export const TEMPLATE_STATUSES = [
  "draft",
  "in_review",
  "published",
  "paused",
  "rejected",
  "removed",
] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const TEMPLATE_CATEGORIES = [
  // Industry
  "solar",
  "real_estate",
  "fitness",
  "coaching",
  "ecommerce",
  "agency",
  "info_products",
  "saas",
  "dentistry",
  "chiropractic",
  "med_spa",
  "law_firm",
  "accounting",
  "financial_advisor",
  "mortgage",
  "insurance",
  "hvac",
  "plumbing",
  "roofing",
  "pest_control",
  "pool_service",
  "landscaping",
  "cleaning",
  "auto_detailing",
  "automotive_sales",
  "rv_boat",
  "home_services",
  "b2b_services",
  "b2c_services",
  "nonprofit",
  // Goal-based
  "lead_generation",
  "webinar_registration",
  "product_launch",
  "evergreen_sales",
  "application_funnel",
  "high_ticket_sales",
  "ecom_dtc",
  "course_launch",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Validated price tiers — creators may only set one of these. Free = 0. */
export const PRICE_TIERS_USD_CENTS = [0, 900, 1900, 2900, 4900, 7900, 9900] as const;
export type PriceTierCents = (typeof PRICE_TIERS_USD_CENTS)[number];

export const PURCHASE_STATUSES = [
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
  "disputed",
  "voided",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const REVIEW_STATUSES = [
  "visible",
  "pending_moderation",
  "hidden_violation",
  "removed_by_author",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PAYOUT_METHODS = ["stripe_connect", "paypal_payouts"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_STATUSES = ["pending", "processing", "sent", "failed", "reversed"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const TAX_FORMS = ["w9", "w8ben", "w8bene", "not_required"] as const;
export type TaxForm = (typeof TAX_FORMS)[number];

/* ──────────────────────────────────────────────────────────────────────────
 * Records
 * ──────────────────────────────────────────────────────────────────────── */

export interface Template {
  id: string; // tpl_…
  funnel_id: string;
  creator_id: string; // usr_…
  creator_workspace_id: string;
  status: TemplateStatus;
  price_usd_cents: PriceTierCents;
  category: TemplateCategory;
  secondary_categories: TemplateCategory[];
  title: string;
  slug: string;
  description: string; // ≤ 4 KB
  tags: string[];
  preview_image_url: string | null;
  preview_funnel_url: string | null;
  current_version_id: string | null;
  /** Cumulative gross sales count over all versions. */
  sales_count: number;
  /** Average rating across all visible reviews (1.00–5.00). */
  avg_rating: number;
  review_count: number;
  /** Bronze-tier proof — the funnel must have hit ≥ $10,000 lifetime revenue. */
  bronze_qualified: boolean;
  /** Set if the buyer's `template_cloned` event is required to be emitted. */
  published_at: string | null;
  paused_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TemplateVersion {
  id: string; // tvr_…
  template_id: string;
  version_number: number;
  /** Frozen, signed JSON bundle URI (S3). */
  bundle_uri: string;
  bundle_sha256: string;
  /** Copy of funnel JSON at this version — anonymized, no PII. */
  funnel_blob: unknown;
  email_sequences_blob: unknown;
  sms_sequences_blob: unknown;
  voice_script_blob: unknown;
  ad_creative_blob: unknown;
  kb_pack_ref: string | null;
  asset_manifest: { asset_id: string; url: string; sha256: string }[];
  passed_automated_checks: boolean;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface Purchase {
  id: string; // pmp_…
  template_id: string;
  template_version_id: string;
  buyer_user_id: string;
  buyer_workspace_id: string;
  creator_id: string;
  status: PurchaseStatus;
  price_usd_cents: number;
  stripe_processing_fee_usd_cents: number;
  creator_share_usd_cents: number; // 70% of net
  platform_share_usd_cents: number; // 30% of net
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refund_eligible_until: string; // 14d from paid_at
  refund_amount_usd_cents: number;
  refund_reason: string | null;
  cloned_funnel_id: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string; // rvw_…
  template_id: string;
  purchase_id: string;
  reviewer_user_id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string;
  status: ReviewStatus;
  /** Creator reply, max 1 per review. */
  creator_reply: string | null;
  creator_replied_at: string | null;
  flagged_count: number;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorPayoutAccount {
  creator_id: string;
  method: PayoutMethod;
  /** Stripe Connect connected account id, or PayPal payout email. */
  account_ref: string;
  country: string;
  tax_form: TaxForm;
  tax_form_received_at: string | null;
  lifetime_usd_cents: number; // for 1099-NEC threshold (≥ $600)
  current_year_usd_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorPayout {
  id: string; // crp_…
  creator_id: string;
  period_start: string; // first of month
  period_end: string;
  gross_usd_cents: number;
  clawback_usd_cents: number;
  net_usd_cents: number;
  method: PayoutMethod;
  status: PayoutStatus;
  external_payout_id: string | null;
  failure_reason: string | null;
  ledger_entry_ids: string[];
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FraudFlag {
  id: string;
  subject_type: "template" | "review" | "purchase" | "creator";
  subject_id: string;
  rule_id: string;
  severity: "info" | "warn" | "block";
  details: Record<string, unknown>;
  auto_action: string;
  resolved_at: string | null;
  created_at: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Zod schemas — used at API boundaries
 * ──────────────────────────────────────────────────────────────────────── */

export const TemplateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
export const PriceTierSchema = z.union([
  z.literal(0),
  z.literal(900),
  z.literal(1900),
  z.literal(2900),
  z.literal(4900),
  z.literal(7900),
  z.literal(9900),
]);

export const PublishTemplateRequestSchema = z.object({
  funnel_id: z.string().min(1),
  creator_id: z.string().min(1),
  price_usd_cents: PriceTierSchema,
  category: TemplateCategorySchema,
  secondary_categories: z.array(TemplateCategorySchema).max(3).default([]),
  title: z.string().min(8).max(120),
  description: z.string().min(40).max(4_000),
  tags: z.array(z.string().min(2).max(32)).max(12).default([]),
  preview_image_url: z.string().url().nullable().optional(),
});
export type PublishTemplateRequest = z.infer<typeof PublishTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = z.object({
  title: z.string().min(8).max(120).optional(),
  description: z.string().min(40).max(4_000).optional(),
  price_usd_cents: PriceTierSchema.optional(),
  category: TemplateCategorySchema.optional(),
  secondary_categories: z.array(TemplateCategorySchema).max(3).optional(),
  tags: z.array(z.string().min(2).max(32)).max(12).optional(),
  preview_image_url: z.string().url().nullable().optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

export const ListTemplatesFilterSchema = z.object({
  category: TemplateCategorySchema.optional(),
  min_price_cents: z.number().int().min(0).optional(),
  max_price_cents: z.number().int().min(0).optional(),
  min_rating: z.number().min(0).max(5).optional(),
  search: z.string().min(1).max(120).optional(),
  creator_id: z.string().min(1).optional(),
  free_only: z.boolean().optional(),
});
export type ListTemplatesFilter = z.infer<typeof ListTemplatesFilterSchema>;

export const ListTemplatesSortSchema = z.enum([
  "popularity",
  "rating",
  "recent",
  "price_asc",
  "price_desc",
]);
export type ListTemplatesSort = z.infer<typeof ListTemplatesSortSchema>;

export const PaginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().positive().max(100).default(24),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ReviewWriteSchema = z.object({
  template_id: z.string().min(1),
  reviewer_user_id: z.string().min(1),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  comment: z.string().min(8).max(2_000),
});
export type ReviewWrite = z.infer<typeof ReviewWriteSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * Errors
 * ──────────────────────────────────────────────────────────────────────── */

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400,
    public readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}
