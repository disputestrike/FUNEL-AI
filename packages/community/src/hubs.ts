/**
 * Hub catalog (Doc 16 §5.2): 30 industry hubs + 5 stage hubs.
 *
 * Industries match the marketing /industries list. Stage hubs are
 * gated by self-attestation (Phase 1) and eventually by verified MRR
 * (Phase 2 — caller flips `is_locked`).
 */

import type { Hub } from "./types.js";

export const INDUSTRY_SLUGS = [
  "solar",
  "real-estate",
  "fitness",
  "coaching",
  "agency",
  "ecommerce",
  "info-products",
  "saas",
  "dentistry",
  "chiropractic",
  "med-spa",
  "law-firm",
  "accounting",
  "financial-advisor",
  "mortgage",
  "insurance",
  "hvac",
  "plumbing",
  "roofing",
  "pest-control",
  "pool-service",
  "landscaping",
  "cleaning",
  "auto-detailing",
  "automotive-sales",
  "rv-boat",
  "home-services-general",
  "b2b-services-general",
  "b2c-services-general",
  "nonprofit",
] as const;

export const STAGE_SLUGS = [
  "stage-pre-10k",
  "stage-10k-100k",
  "stage-100k-1m",
  "stage-1m-10m",
  "stage-10m-plus",
] as const;

export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];
export type StageSlug = (typeof STAGE_SLUGS)[number];

const HUMAN_INDUSTRY: Record<IndustrySlug, string> = {
  solar: "Solar",
  "real-estate": "Real Estate",
  fitness: "Fitness & Coaching",
  coaching: "Coaching",
  agency: "Agencies",
  ecommerce: "E-commerce",
  "info-products": "Info Products",
  saas: "SaaS",
  dentistry: "Dentistry",
  chiropractic: "Chiropractic",
  "med-spa": "Med Spa",
  "law-firm": "Law Firms",
  accounting: "Accounting",
  "financial-advisor": "Financial Advisors",
  mortgage: "Mortgage",
  insurance: "Insurance",
  hvac: "HVAC",
  plumbing: "Plumbing",
  roofing: "Roofing",
  "pest-control": "Pest Control",
  "pool-service": "Pool Service",
  landscaping: "Landscaping",
  cleaning: "Cleaning",
  "auto-detailing": "Auto Detailing",
  "automotive-sales": "Automotive Sales",
  "rv-boat": "RV / Boat",
  "home-services-general": "Home Services",
  "b2b-services-general": "B2B Services",
  "b2c-services-general": "B2C Services",
  nonprofit: "Nonprofit",
};

const STAGE_RANGE_CENTS: Record<StageSlug, { min: number | null; max: number | null }> = {
  "stage-pre-10k": { min: 0, max: 10_000_00 },
  "stage-10k-100k": { min: 10_000_00, max: 100_000_00 },
  "stage-100k-1m": { min: 100_000_00, max: 1_000_000_00 },
  "stage-1m-10m": { min: 1_000_000_00, max: 10_000_000_00 },
  "stage-10m-plus": { min: 10_000_000_00, max: null },
};

const STAGE_HUMAN: Record<StageSlug, string> = {
  "stage-pre-10k": "< $10K MRR",
  "stage-10k-100k": "$10K–$100K MRR",
  "stage-100k-1m": "$100K–$1M MRR",
  "stage-1m-10m": "$1M–$10M MRR",
  "stage-10m-plus": "$10M+ MRR",
};

/** Default themed thread schedule (Doc 16 §5.5). */
export const DEFAULT_THREAD_SCHEDULE = [
  { weekday: 1, hour_local: 9, thread_type: "question_mon" },
  { weekday: 2, hour_local: 9, thread_type: "ama_tue" },
  { weekday: 3, hour_local: 9, thread_type: "win_wed" },
  { weekday: 4, hour_local: 9, thread_type: "tactic_thu" },
  { weekday: 5, hour_local: 9, thread_type: "fail_fri" },
  { weekday: 6, hour_local: 9, thread_type: "show_off_sat" },
  { weekday: 0, hour_local: 9, thread_type: "sunday_setup" },
];

/** Build the full hub catalog (industry + stage). Pure — no I/O. */
export function buildHubCatalog(now: string = new Date().toISOString()): Hub[] {
  const industries: Hub[] = INDUSTRY_SLUGS.map((slug) => ({
    id: `hub_${slug}`,
    slug,
    name: HUMAN_INDUSTRY[slug],
    kind: "industry" as const,
    description: `${HUMAN_INDUSTRY[slug]} operators building with GoFunnelAI.`,
    members: 0,
    stage_min_mrr_cents: null,
    stage_max_mrr_cents: null,
    is_locked: false,
    bot_thread_schedule: DEFAULT_THREAD_SCHEDULE,
    created_at: now,
  }));
  const stages: Hub[] = STAGE_SLUGS.map((slug) => ({
    id: `hub_${slug}`,
    slug,
    name: STAGE_HUMAN[slug],
    kind: "stage" as const,
    description: `Founders at ${STAGE_HUMAN[slug]}.`,
    members: 0,
    stage_min_mrr_cents: STAGE_RANGE_CENTS[slug].min,
    stage_max_mrr_cents: STAGE_RANGE_CENTS[slug].max,
    is_locked: true, // verified-revenue gate kicks in Phase 2; Phase 1 allow self-attest
    bot_thread_schedule: DEFAULT_THREAD_SCHEDULE,
    created_at: now,
  }));
  return [...industries, ...stages];
}

/** Pick the stage hub for a given MRR (cents). */
export function stageHubForMrr(mrr_cents: number): StageSlug {
  if (mrr_cents >= 10_000_000_00) return "stage-10m-plus";
  if (mrr_cents >= 1_000_000_00) return "stage-1m-10m";
  if (mrr_cents >= 100_000_00) return "stage-100k-1m";
  if (mrr_cents >= 10_000_00) return "stage-10k-100k";
  return "stage-pre-10k";
}
