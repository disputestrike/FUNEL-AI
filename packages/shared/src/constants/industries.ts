/**
 * The 30 launch-day industries.
 *
 * Each industry routes to a default `VoicePersona` per doc 20, sits in a
 * cluster for UI grouping, and carries the regulated flag that triggers the
 * Compliance Agent's fact-check gate.
 *
 * Order is the canonical UI order (most common first within each cluster).
 */

import type { IndustryMeta } from "../types/industry.js";
import { IndustryCluster } from "../types/industry.js";
import { VoicePersona } from "../types/persona.js";
import { RegulatedVertical } from "../types/compliance.js";

export const INDUSTRIES: readonly IndustryMeta[] = [
  // Home Services
  {
    slug: "solar",
    name: "Solar",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Funnel,
    regulated_flag: false,
    blurb: "Residential solar installation, panel quotes, financing programs.",
  },
  {
    slug: "hvac",
    name: "HVAC",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Heating, ventilation, and AC service, install, and replacement.",
  },
  {
    slug: "roofing",
    name: "Roofing",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Roof inspection, repair, replacement, and insurance claims.",
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Residential plumbing service, repipe, water heaters.",
  },
  {
    slug: "pest_control",
    name: "Pest Control",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Recurring pest control, termite, mosquito, wildlife removal.",
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    cluster: IndustryCluster.HomeServices,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Lawn care, hardscaping, design, and maintenance contracts.",
  },

  // Health
  {
    slug: "dental",
    name: "Dental",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Maestro,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Dental,
    blurb: "General, cosmetic, and implant dentistry. Implant and Invisalign offers.",
  },
  {
    slug: "med_spa",
    name: "Med Spa",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Maestro,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.MedSpa,
    blurb: "Injectables, body contouring, skincare, laser.",
  },
  {
    slug: "cosmetic_surgery",
    name: "Cosmetic Surgery",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Maestro,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.CosmeticSurgery,
    blurb: "Board-certified plastic surgery and reconstructive procedures.",
  },
  {
    slug: "weight_loss",
    name: "Weight Loss / GLP-1",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Coach,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Glp1,
    blurb: "Medical weight loss, GLP-1 programs, bariatric consults.",
  },
  {
    slug: "chiropractic",
    name: "Chiropractic",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Coach,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Healthcare,
    blurb: "Chiropractic care, decompression, accident treatment.",
  },
  {
    slug: "hair_restoration",
    name: "Hair Restoration",
    cluster: IndustryCluster.Health,
    default_persona: VoicePersona.Maestro,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.HairRestoration,
    blurb: "FUE/FUT hair transplants, PRP, restoration medications.",
  },

  // Coaching
  {
    slug: "fitness",
    name: "Fitness",
    cluster: IndustryCluster.Coaching,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Personal training, group fitness, gyms, online programs.",
  },
  {
    slug: "life_coaching",
    name: "Life Coaching",
    cluster: IndustryCluster.Coaching,
    default_persona: VoicePersona.Coach,
    regulated_flag: false,
    blurb: "Personal development, performance, mindset coaching.",
  },
  {
    slug: "business_coaching",
    name: "Business Coaching",
    cluster: IndustryCluster.Coaching,
    default_persona: VoicePersona.Rebel,
    regulated_flag: false,
    blurb: "Coaching for founders, agencies, sales teams.",
  },
  {
    slug: "course_creators",
    name: "Course Creators",
    cluster: IndustryCluster.Education,
    default_persona: VoicePersona.Rebel,
    regulated_flag: false,
    blurb: "Information products, online courses, cohorts, membership.",
  },

  // Professional
  {
    slug: "legal_general",
    name: "Legal (General)",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.PersonalInjuryLaw,
    blurb: "General legal practice; specialty packs below for PI, family, DUI, bankruptcy.",
  },
  {
    slug: "personal_injury_law",
    name: "Personal Injury Law",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.PersonalInjuryLaw,
    blurb: "Auto, slip-and-fall, workplace injury practice.",
  },
  {
    slug: "family_law",
    name: "Family Law",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.FamilyLaw,
    blurb: "Divorce, custody, support, prenuptials.",
  },
  {
    slug: "accounting",
    name: "Accounting",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: false,
    blurb: "Small-business accounting, bookkeeping, tax prep.",
  },
  {
    slug: "recruiting",
    name: "Recruiting / Staffing",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: false,
    blurb: "Recruiting firms, staffing agencies, executive search.",
  },
  {
    slug: "b2b_saas",
    name: "B2B SaaS",
    cluster: IndustryCluster.Professional,
    default_persona: VoicePersona.Maven,
    regulated_flag: false,
    blurb: "SaaS demo capture and PLG signups.",
  },

  // Financial
  {
    slug: "insurance",
    name: "Insurance",
    cluster: IndustryCluster.Financial,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Insurance,
    blurb: "Auto, home, life, and health insurance lead capture.",
  },
  {
    slug: "mortgage",
    name: "Mortgage",
    cluster: IndustryCluster.Financial,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Mortgage,
    blurb: "Mortgage brokers, refi, first-time-buyer programs.",
  },
  {
    slug: "financial_advisors",
    name: "Financial Advisors",
    cluster: IndustryCluster.Financial,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.FinancialAdvisors,
    blurb: "RIA and broker-dealer lead capture for advisory services.",
  },
  {
    slug: "tax_relief",
    name: "Tax Relief",
    cluster: IndustryCluster.Financial,
    default_persona: VoicePersona.Maven,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.TaxRelief,
    blurb: "Back-tax resolution, IRS representation, debt relief.",
  },

  // Real estate
  {
    slug: "real_estate",
    name: "Real Estate",
    cluster: IndustryCluster.RealEstate,
    default_persona: VoicePersona.Funnel,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.RealEstate,
    blurb: "Residential agents, brokerages, luxury listings.",
  },
  {
    slug: "luxury_real_estate",
    name: "Luxury Real Estate",
    cluster: IndustryCluster.RealEstate,
    default_persona: VoicePersona.Maestro,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.RealEstate,
    blurb: "High-end residential and concierge real estate.",
  },

  // Ecommerce + Wellness
  {
    slug: "ecommerce_dtc",
    name: "Ecommerce / DTC",
    cluster: IndustryCluster.Ecommerce,
    default_persona: VoicePersona.Rebel,
    regulated_flag: false,
    blurb: "Direct-to-consumer brands across apparel, beauty, home, gear.",
  },
  {
    slug: "supplements",
    name: "Supplements",
    cluster: IndustryCluster.Wellness,
    default_persona: VoicePersona.Rebel,
    regulated_flag: true,
    regulated_vertical: RegulatedVertical.Supplements,
    blurb: "Nutraceuticals, vitamins, wellness supplements.",
  },
] as const;

if (INDUSTRIES.length !== 30) {
  // Static assertion: if you change the list, update this count or remove.
  throw new Error(
    `INDUSTRIES expected to be 30 entries for v1, got ${INDUSTRIES.length}`
  );
}

/** Lookup map by slug. */
export const INDUSTRIES_BY_SLUG: Readonly<Record<string, IndustryMeta>> = Object.freeze(
  Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i]))
);

/** Returns the industry metadata for a slug, or `undefined`. */
export function getIndustry(slug: string): IndustryMeta | undefined {
  return INDUSTRIES_BY_SLUG[slug];
}

/** Slugs of the regulated industries. */
export const REGULATED_INDUSTRY_SLUGS: readonly string[] = INDUSTRIES.filter(
  (i) => i.regulated_flag
).map((i) => i.slug);
