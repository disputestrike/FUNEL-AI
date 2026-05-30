/**
 * Awards domain types (Doc 16 §LOOP 3).
 *
 * Tier ladder is revenue-attributable-to-a-funnel, lifetime cumulative:
 *   Bronze   ........... $10,000
 *   Silver   ........... $100,000
 *   Gold     ........... $1,000,000
 *   Platinum ........... $10,000,000
 *   Diamond  ........... $100,000,000
 */

import { z } from "zod";

export const AwardTierEnum = z.enum(["bronze", "silver", "gold", "platinum", "diamond"]);
export type AwardTier = z.infer<typeof AwardTierEnum>;

export const AwardThresholds: Record<AwardTier, number> = {
  bronze: 10_000_00,           // $10K in cents
  silver: 100_000_00,          // $100K
  gold: 1_000_000_00,          // $1M
  platinum: 10_000_000_00,     // $10M
  diamond: 100_000_000_00,     // $100M
};

export const TIER_ORDER: AwardTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

/* ---------------------------------------------------------------- */
/* Award                                                            */
/* ---------------------------------------------------------------- */

export const AwardSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  funnel_id: z.string().min(1),
  tier: AwardTierEnum,
  /** Cumulative revenue at the moment of crossing, USD cents. */
  revenue_at_milestone_cents: z.number().int().nonnegative(),
  /** Days from funnel publish to milestone hit. */
  time_to_milestone_days: z.number().int().nonnegative(),
  /** Unique customers contributing to the milestone (anti-gaming). */
  unique_customer_count: z.number().int().nonnegative(),
  /** Days since the funnel was first published when the milestone fired. */
  days_since_publish: z.number().int().nonnegative(),
  awarded_at: z.string().datetime(),
});
export type Award = z.infer<typeof AwardSchema>;

/* ---------------------------------------------------------------- */
/* AwardWinner (the customer profile attached to the award)         */
/* ---------------------------------------------------------------- */

export const AwardWinnerSchema = z.object({
  id: z.string().min(1),
  award_id: z.string().min(1),
  workspace_id: z.string().min(1),
  /** Display name on the case study page (customer-editable). */
  display_name: z.string().nullable(),
  industry: z.string().nullable(),
  testimonial: z.string().nullable(),
  photo_url: z.string().url().nullable(),
  consent_to_public_case_study: z.boolean().default(false),
  mailing_address: z
    .object({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      region: z.string(),
      postal_code: z.string(),
      country_iso2: z.string().length(2),
    })
    .nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type AwardWinner = z.infer<typeof AwardWinnerSchema>;

/* ---------------------------------------------------------------- */
/* CaseStudyPage                                                    */
/* ---------------------------------------------------------------- */

export const CaseStudyStatusEnum = z.enum(["draft", "public", "taken_down"]);
export type CaseStudyStatus = z.infer<typeof CaseStudyStatusEnum>;

export const CaseStudyPageSchema = z.object({
  id: z.string().min(1),
  award_id: z.string().min(1),
  /** URL slug: `<first-name>-<industry>-<tier>` */
  slug: z.string().min(3),
  status: CaseStudyStatusEnum,
  hero_title: z.string(),
  hero_subtitle: z.string(),
  stats: z.object({
    revenue_cents: z.number().int().nonnegative(),
    leads_generated: z.number().int().nonnegative(),
    conversion_rate_pct: z.number().min(0).max(100),
    time_to_milestone_days: z.number().int().nonnegative(),
  }),
  what_worked: z.array(z.string()),
  testimonial: z.string().nullable(),
  og_image_url: z.string().url().nullable(),
  /** Cloneable funnel id (anonymized template clone of the winner's funnel). */
  clone_template_id: z.string().nullable(),
  schema_org_jsonld: z.string(),
  created_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
  takedown_at: z.string().datetime().nullable(),
});
export type CaseStudyPage = z.infer<typeof CaseStudyPageSchema>;

/* ---------------------------------------------------------------- */
/* Physical delivery                                                */
/* ---------------------------------------------------------------- */

export const FulfillmentStatusEnum = z.enum([
  "pending_address",
  "queued",
  "printing",
  "shipped",
  "delivered",
  "returned",
  "failed",
]);
export type FulfillmentStatus = z.infer<typeof FulfillmentStatusEnum>;

export const PhysicalDeliverySchema = z.object({
  id: z.string().min(1),
  award_id: z.string().min(1),
  /** "digital" for Bronze, "certificate" for Silver, "plaque" for Gold/Platinum, "trophy" for Diamond. */
  item_type: z.enum(["digital", "certificate", "plaque", "large_plaque", "trophy"]),
  /** Estimated all-in cost in cents (POD cost, not customer-facing). */
  est_cost_cents: z.number().int().nonnegative(),
  vendor: z.string(),                              // "printful" | "engraving-shop" | etc.
  vendor_order_id: z.string().nullable(),
  status: FulfillmentStatusEnum,
  tracking_number: z.string().nullable(),
  carrier: z.string().nullable(),
  shipped_at: z.string().datetime().nullable(),
  delivered_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PhysicalDelivery = z.infer<typeof PhysicalDeliverySchema>;

/* ---------------------------------------------------------------- */
/* Inputs (callers)                                                 */
/* ---------------------------------------------------------------- */

export const FunnelRevenueSnapshotSchema = z.object({
  funnel_id: z.string().min(1),
  workspace_id: z.string().min(1),
  revenue_cumulative_cents: z.number().int().nonnegative(),
  refunds_cumulative_cents: z.number().int().nonnegative(),
  chargebacks_cumulative_cents: z.number().int().nonnegative(),
  unique_customer_count: z.number().int().nonnegative(),
  funnel_first_published_at: z.string().datetime(),
  /** Workspace-level allowlist scrub — internal/employee accounts are excluded. */
  internal_account: z.boolean(),
});
export type FunnelRevenueSnapshot = z.infer<typeof FunnelRevenueSnapshotSchema>;
