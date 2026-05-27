/**
 * Affiliate domain types (Doc 16 §LOOP 2.12).
 *
 * The wire shapes here are mirrored in the `affiliate_*` tables in
 * `@funnel/db` once the schema is committed; until then this is the
 * source of truth for both producer and consumer code.
 *
 * Currency is ALWAYS USD cents, integer. Dates are ISO-8601 UTC strings.
 */

import { z } from "zod";

/* ---------------------------------------------------------------- */
/* Enums                                                            */
/* ---------------------------------------------------------------- */

export const AffiliateStatusEnum = z.enum([
  "pending",
  "active",
  "paused",
  "suspended",
  "terminated",
]);
export type AffiliateStatus = z.infer<typeof AffiliateStatusEnum>;

export const CommissionStatusEnum = z.enum([
  "pending",
  "earned",
  "paid",
  "clawed_back",
  "voided",
]);
export type CommissionStatus = z.infer<typeof CommissionStatusEnum>;

export const CommissionTypeEnum = z.enum(["subscription", "voice_overage"]);
export type CommissionType = z.infer<typeof CommissionTypeEnum>;

export const PayoutStatusEnum = z.enum([
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
]);
export type PayoutStatus = z.infer<typeof PayoutStatusEnum>;

export const PayoutMethodEnum = z.enum(["paypal", "wise", "stripe_connect"]);
export type PayoutMethod = z.infer<typeof PayoutMethodEnum>;

export const FraudSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
export type FraudSeverity = z.infer<typeof FraudSeverityEnum>;

export const FraudRuleIdEnum = z.enum([
  "same_ip",
  "same_device_fingerprint",
  "velocity_signup",
  "disposable_email",
  "email_pattern_cluster",
  "card_bin_cluster",
  "geo_mismatch",
  "self_referral",
  "refund_clawback",
  "chargeback_clawback",
]);
export type FraudRuleId = z.infer<typeof FraudRuleIdEnum>;

export const DreamCarTierEnum = z.enum(["none", "t100", "t200", "t500"]);
export type DreamCarTier = z.infer<typeof DreamCarTierEnum>;

/* ---------------------------------------------------------------- */
/* Affiliate                                                        */
/* ---------------------------------------------------------------- */

export const AffiliateSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  workspace_id: z.string().min(1).nullable(),
  status: AffiliateStatusEnum,
  referral_code: z.string().min(4).max(24),
  display_name: z.string().nullable(),
  payout_email: z.string().email().nullable(),
  payout_method: PayoutMethodEnum.default("paypal"),
  country_iso2: z.string().length(2).nullable(),
  leaderboard_visible: z.boolean().default(true),
  attribution_model: z.enum(["first_click", "last_click"]).default("first_click"),
  tos_accepted_at: z.string().datetime().nullable(),
  strikes: z.number().int().min(0).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Affiliate = z.infer<typeof AffiliateSchema>;

/* ---------------------------------------------------------------- */
/* AffiliateLink (short link + sub-campaigns)                       */
/* ---------------------------------------------------------------- */

export const AffiliateLinkSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  code: z.string().min(4).max(32),        // "abcd1234"   → gofunnelai.com/r/abcd1234
  sub_id: z.string().max(64).nullable(),  // "yt-video-1" — up to 100 per affiliate
  destination_url: z.string().url(),       // where 302 goes (default: gofunnelai.com/?ref=…)
  utm_source: z.string().default("affiliate"),
  utm_medium: z.string().default("referral"),
  utm_campaign: z.string().nullable(),
  utm_content: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type AffiliateLink = z.infer<typeof AffiliateLinkSchema>;

/* ---------------------------------------------------------------- */
/* Referral (the attribution row that ties affiliate → user)        */
/* ---------------------------------------------------------------- */

export const ReferralSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  link_id: z.string().min(1).nullable(),
  referred_user_id: z.string().min(1).nullable(),  // null until signup
  prospect_id: z.string().min(1).nullable(),
  click_id: z.string().min(1),
  /** When this click landed; cookie expires 90 days after. */
  click_at: z.string().datetime(),
  cookie_expires_at: z.string().datetime(),
  attribution_model: z.enum(["first_click", "last_click"]),
  signup_at: z.string().datetime().nullable(),
  first_paid_at: z.string().datetime().nullable(),
  ip_hash: z.string().nullable(),
  device_fp_hash: z.string().nullable(),
  referrer: z.string().nullable(),
  landing_page: z.string().nullable(),
  user_agent_class: z.string().nullable(),
  /** True if the affiliate clicked their own link — no cookie set. */
  rejected_self_referral: z.boolean().default(false),
  fraud_flagged: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type Referral = z.infer<typeof ReferralSchema>;

/* ---------------------------------------------------------------- */
/* Commission                                                       */
/* ---------------------------------------------------------------- */

export const CommissionSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  referral_id: z.string().min(1),
  referred_user_id: z.string().min(1),
  type: CommissionTypeEnum,
  source_invoice_id: z.string().nullable(),
  period_yyyy_mm: z.string().regex(/^\d{4}-\d{2}$/),
  /** Customer payment that triggered the commission, in cents. */
  base_amount_cents: z.number().int().nonnegative(),
  rate_bps: z.number().int().min(0).max(10_000), // basis points; 4000 = 40%
  amount_cents: z.number().int(),                // can be negative on clawback
  status: CommissionStatusEnum,
  /** Set when status flips to `paid`. */
  paid_in_payout_id: z.string().nullable(),
  ledger_entry_id: z.string().min(1).nullable(),
  created_at: z.string().datetime(),
});
export type Commission = z.infer<typeof CommissionSchema>;

/* ---------------------------------------------------------------- */
/* Payout                                                           */
/* ---------------------------------------------------------------- */

export const PayoutSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  /** Period covered: ISO week start (YYYY-MM-DD Monday UTC). */
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  amount_cents: z.number().int(),
  currency: z.string().length(3).default("USD"),
  method: PayoutMethodEnum,
  destination: z.string(),       // paypal email / wise email / stripe acct
  status: PayoutStatusEnum,
  txn_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  attempt_count: z.number().int().min(0).default(0),
  created_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable(),
});
export type Payout = z.infer<typeof PayoutSchema>;

/* ---------------------------------------------------------------- */
/* FraudFlag                                                        */
/* ---------------------------------------------------------------- */

export const FraudFlagSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  referral_id: z.string().min(1).nullable(),
  rule_id: FraudRuleIdEnum,
  severity: FraudSeverityEnum,
  /** structured evidence — IP hash, fp hash, sibling refs, etc. */
  evidence: z.record(z.unknown()),
  auto_action: z.enum(["none", "reject_conversion", "pause_payouts", "terminate"]),
  status: z.enum(["open", "appealed", "confirmed", "dismissed"]),
  opened_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable(),
});
export type FraudFlag = z.infer<typeof FraudFlagSchema>;

/* ---------------------------------------------------------------- */
/* Dream Car snapshot                                               */
/* ---------------------------------------------------------------- */

export const DreamCarSnapshotSchema = z.object({
  id: z.string().min(1),
  affiliate_id: z.string().min(1),
  month_yyyy_mm: z.string().regex(/^\d{4}-\d{2}$/),
  active_paying_referrals: z.number().int().nonnegative(),
  tier: DreamCarTierEnum,
  /** Monthly bonus amount accruing this month (paid quarterly). */
  bonus_amount_cents: z.number().int().nonnegative(),
  /** Set when the quarterly aggregate is paid. */
  paid_in_payout_id: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type DreamCarSnapshot = z.infer<typeof DreamCarSnapshotSchema>;

/* ---------------------------------------------------------------- */
/* Leaderboard row (denormalized; refreshed every 15 min)            */
/* ---------------------------------------------------------------- */

export const LeaderboardRowSchema = z.object({
  rank: z.number().int().positive(),
  affiliate_id: z.string().min(1),
  display_name: z.string(),
  country_iso2: z.string().length(2).nullable(),
  trailing_30_commission_cents: z.number().int().nonnegative(),
  lifetime_commission_cents: z.number().int().nonnegative(),
  active_referrals: z.number().int().nonnegative(),
  rank_delta_vs_last_week: z.number().int(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

/* ---------------------------------------------------------------- */
/* Dashboard data (the `app.gofunnelai.com/affiliate` payload)         */
/* ---------------------------------------------------------------- */

export const DashboardStatsSchema = z.object({
  clicks_30d: z.number().int().nonnegative(),
  signups_30d: z.number().int().nonnegative(),
  trial_starts_30d: z.number().int().nonnegative(),
  paid_conversions_30d: z.number().int().nonnegative(),
  active_referrals: z.number().int().nonnegative(),
  churned_referrals: z.number().int().nonnegative(),
  mrr_generated_cents: z.number().int().nonnegative(),
  commission_this_month_cents: z.number().int().nonnegative(),
  commission_lifetime_cents: z.number().int().nonnegative(),
  commission_paid_lifetime_cents: z.number().int().nonnegative(),
  commission_pending_cents: z.number().int().nonnegative(),
  next_payout_date: z.string().datetime().nullable(),
  next_payout_amount_cents: z.number().int().nonnegative(),
  dream_car: z.object({
    active_paying_referrals: z.number().int().nonnegative(),
    tier: DreamCarTierEnum,
    next_tier_threshold: z.number().int().nonnegative(),
    progress_pct: z.number().min(0).max(100),
  }),
  leaderboard_rank: z.number().int().positive().nullable(),
  leaderboard_rank_delta: z.number().int(),
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

/* ---------------------------------------------------------------- */
/* Click ingest payload (recordClick input)                          */
/* ---------------------------------------------------------------- */

export const ClickInputSchema = z.object({
  link_code: z.string().min(4),
  sub_id: z.string().max(64).optional(),
  prospect_id: z.string().nullable().optional(),
  ip_hash: z.string().nullable().optional(),
  device_fp_hash: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  landing_page: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});
export type ClickInput = z.infer<typeof ClickInputSchema>;

/* ---------------------------------------------------------------- */
/* Conversion ingest payload (recordConversion input)                */
/* ---------------------------------------------------------------- */

export const ConversionInputSchema = z.object({
  referred_user_id: z.string().min(1),
  invoice_id: z.string().min(1),
  type: CommissionTypeEnum,
  base_amount_cents: z.number().int().nonnegative(),
  period_yyyy_mm: z.string().regex(/^\d{4}-\d{2}$/),
});
export type ConversionInput = z.infer<typeof ConversionInputSchema>;
