/**
 * Subscription plan catalog.
 *
 * Prices are in USD micros (1 USD = 1_000_000). Limits are enforced by
 * `@funnel/cost-governor`. The annual price column is the per-year price
 * post-annual-discount, not the per-month price multiplied.
 */

import type { Plan } from "../types/billing.js";

export const PLANS: readonly Plan[] = [
  {
    slug: "free",
    name: "Free",
    description: "Try the funnel grader and generate one funnel.",
    price_monthly_usd_micros: 0,
    price_annual_usd_micros: 0,
    interval_options: ["month"],
    trial_days: 0,
    limits: {
      funnels: 1,
      monthly_generation_budget_usd_micros: 2_000_000, // $2
      leads_per_month: 50,
      revtry_minutes_per_month: 0,
      seats: 1,
      custom_domains: 0,
      integrations: 1,
    },
    features: {
      revtry: false,
      custom_domains: false,
      white_label: false,
      priority_support: false,
      api_access: false,
    },
    is_public: true,
  },
  {
    slug: "starter",
    name: "Starter",
    description: "Solo operators publishing their first set of funnels.",
    price_monthly_usd_micros: 99_000_000, // $99
    price_annual_usd_micros: 990_000_000, // $990 (save $198 vs monthly)
    interval_options: ["month", "year"],
    trial_days: 14,
    limits: {
      funnels: 5,
      monthly_generation_budget_usd_micros: 50_000_000, // $50
      leads_per_month: 2_000,
      revtry_minutes_per_month: 60,
      seats: 2,
      custom_domains: 1,
      integrations: 5,
    },
    features: {
      revtry: true,
      custom_domains: true,
      white_label: false,
      priority_support: false,
      api_access: false,
    },
    is_public: true,
    external_product_id: "prod_starter",
  },
  {
    slug: "growth",
    name: "Growth",
    description: "Teams running multiple funnels with active outbound.",
    price_monthly_usd_micros: 299_000_000, // $299
    price_annual_usd_micros: 2_988_000_000, // $2,988
    interval_options: ["month", "year"],
    trial_days: 14,
    limits: {
      funnels: 25,
      monthly_generation_budget_usd_micros: 250_000_000, // $250
      leads_per_month: 15_000,
      revtry_minutes_per_month: 500,
      seats: 5,
      custom_domains: 3,
      integrations: 25,
    },
    features: {
      revtry: true,
      custom_domains: true,
      white_label: false,
      priority_support: true,
      api_access: true,
    },
    is_public: true,
    external_product_id: "prod_growth",
  },
  {
    slug: "scale",
    name: "Scale",
    description: "Mid-market teams with high lead volume and SLA needs.",
    price_monthly_usd_micros: 999_000_000, // $999
    price_annual_usd_micros: 9_990_000_000, // $9,990
    interval_options: ["month", "year"],
    trial_days: 14,
    limits: {
      funnels: 100,
      monthly_generation_budget_usd_micros: 1_000_000_000, // $1,000
      leads_per_month: 100_000,
      revtry_minutes_per_month: 5_000,
      seats: 15,
      custom_domains: 10,
      integrations: 100,
    },
    features: {
      revtry: true,
      custom_domains: true,
      white_label: false,
      priority_support: true,
      api_access: true,
    },
    is_public: true,
    external_product_id: "prod_scale",
  },
  {
    slug: "agency",
    name: "Agency",
    description: "Agencies managing many clients with white-label and reseller controls.",
    price_monthly_usd_micros: 2_499_000_000, // $2,499
    price_annual_usd_micros: 24_990_000_000, // $24,990
    interval_options: ["month", "year"],
    trial_days: 14,
    limits: {
      funnels: 500,
      monthly_generation_budget_usd_micros: 3_000_000_000, // $3,000
      leads_per_month: 500_000,
      revtry_minutes_per_month: 25_000,
      seats: 50,
      custom_domains: 50,
      integrations: 500,
    },
    features: {
      revtry: true,
      custom_domains: true,
      white_label: true,
      priority_support: true,
      api_access: true,
    },
    is_public: true,
    external_product_id: "prod_agency",
  },
] as const;

export const PLANS_BY_SLUG: Readonly<Record<string, Plan>> = Object.freeze(
  Object.fromEntries(PLANS.map((p) => [p.slug, p]))
);

export function getPlan(slug: string): Plan | undefined {
  return PLANS_BY_SLUG[slug];
}
