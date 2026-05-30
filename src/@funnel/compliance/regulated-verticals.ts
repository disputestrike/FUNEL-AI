/**
 * Canonical list of regulated industries.
 *
 * If a workspace's declared vertical (or detected vertical) is in this list,
 * every customer-facing published artifact for that workspace routes through
 * the human review queue before first publish — and a publish-time
 * acknowledgment (docs/05e) is required.
 *
 * Source: docs/07a §2, 07b §2.1, 05e §2.
 */

export type EscalationTier = "tier_1" | "tier_2_lead" | "legal_counsel";

export type Jurisdiction =
  | "US"
  | "US-CA"
  | "US-NY"
  | "US-TX"
  | "US-FL"
  | "EU"
  | "UK"
  | "CA" // Canada
  | "AU"
  | "BR"
  | "IN"
  | "MX"
  | "GLOBAL";

export interface RegulatedVertical {
  /** Canonical slug — matches the agents' vertical field. */
  slug: string;
  /** Human-readable display name (en-US). */
  display: string;
  /** Parent industry category. */
  category:
    | "healthcare"
    | "financial"
    | "legal"
    | "insurance"
    | "employment"
    | "credit"
    | "real_estate"
    | "education"
    | "other_regulated";
  /** Short machine reason code used in audit logs + events. */
  reasonCode: string;
  /** Jurisdictions where this vertical is regulated (and the rules apply). */
  jurisdictions: Jurisdiction[];
  /** Escalation tier for human review of this vertical. */
  escalationTier: EscalationTier;
  /** Cross-references to relevant regulators / source authorities. */
  authorities: string[];
  /** If true, before/after imagery is per-se prohibited for ad creatives in this vertical. */
  banBeforeAfterImagery?: boolean;
  /** If true, outcome guarantees are per-se prohibited. */
  banOutcomeGuarantees?: boolean;
  /** If true, the workspace must upload professional license proof. */
  requiresLicenseProof?: boolean;
}

export const REGULATED_VERTICALS: readonly RegulatedVertical[] = [
  // ── Healthcare / wellness ──────────────────────────────────────────────
  {
    slug: "healthcare_general",
    display: "Healthcare (general medical)",
    category: "healthcare",
    reasonCode: "regulated.healthcare.general",
    jurisdictions: ["US", "EU", "UK", "CA", "AU", "BR", "IN"],
    escalationTier: "legal_counsel",
    authorities: ["FDA", "FTC", "HHS-OCR-HIPAA", "EMA", "MHRA"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_dental",
    display: "Dental",
    category: "healthcare",
    reasonCode: "regulated.healthcare.dental",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "tier_2_lead",
    authorities: ["state-dental-boards", "FTC"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_mental_health",
    display: "Mental health",
    category: "healthcare",
    reasonCode: "regulated.healthcare.mental_health",
    jurisdictions: ["US", "EU", "UK", "CA", "AU", "BR", "IN"],
    escalationTier: "legal_counsel",
    authorities: ["state-licensing-boards", "FTC", "HHS-OCR-HIPAA"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_addiction",
    display: "Addiction treatment",
    category: "healthcare",
    reasonCode: "regulated.healthcare.addiction",
    jurisdictions: ["US", "EU", "UK", "CA"],
    escalationTier: "legal_counsel",
    authorities: ["LegitScript", "state-licensing", "DEA", "FTC"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_hair_restoration",
    display: "Hair restoration",
    category: "healthcare",
    reasonCode: "regulated.healthcare.hair_restoration",
    jurisdictions: ["US", "EU", "UK", "BR"],
    escalationTier: "tier_2_lead",
    authorities: ["FDA", "FTC"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
  },
  {
    slug: "healthcare_cosmetic_surgery",
    display: "Cosmetic surgery / aesthetic medicine",
    category: "healthcare",
    reasonCode: "regulated.healthcare.cosmetic_surgery",
    jurisdictions: ["US", "EU", "UK", "BR", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-medical-boards", "FTC", "FDA"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_weight_loss",
    display: "Weight loss programs",
    category: "healthcare",
    reasonCode: "regulated.healthcare.weight_loss",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["FTC", "FDA"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
  },
  {
    slug: "healthcare_glp1",
    display: "GLP-1 (Ozempic, Wegovy, Mounjaro, Zepbound, compounded)",
    category: "healthcare",
    reasonCode: "regulated.healthcare.glp1",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["FDA", "FTC", "DEA", "state-pharmacy-boards"],
    banBeforeAfterImagery: true,
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "healthcare_supplements",
    display: "Supplements / OTC",
    category: "healthcare",
    reasonCode: "regulated.healthcare.supplements",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "tier_2_lead",
    authorities: ["FTC", "FDA", "EFSA"],
    banOutcomeGuarantees: true,
  },

  // ── Financial ─────────────────────────────────────────────────────────
  {
    slug: "finance_advisors",
    display: "Financial advisors",
    category: "financial",
    reasonCode: "regulated.finance.advisors",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["SEC", "FINRA", "FCA", "state-securities"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "finance_mortgage",
    display: "Mortgage / home loans",
    category: "financial",
    reasonCode: "regulated.finance.mortgage",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["CFPB", "state-DFI", "NMLS"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "finance_debt_relief",
    display: "Debt relief / settlement",
    category: "financial",
    reasonCode: "regulated.finance.debt_relief",
    jurisdictions: ["US", "EU", "UK"],
    escalationTier: "legal_counsel",
    authorities: ["FTC", "CFPB", "state-AGs"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "finance_bankruptcy",
    display: "Bankruptcy petition prep",
    category: "financial",
    reasonCode: "regulated.finance.bankruptcy",
    jurisdictions: ["US"],
    escalationTier: "legal_counsel",
    authorities: ["EOUST", "state-bar"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "finance_tax_relief",
    display: "Tax relief / IRS representation",
    category: "financial",
    reasonCode: "regulated.finance.tax_relief",
    jurisdictions: ["US"],
    escalationTier: "legal_counsel",
    authorities: ["IRS-Circ-230", "FTC", "state-AGs"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "finance_credit_repair",
    display: "Credit repair",
    category: "credit",
    reasonCode: "regulated.credit.credit_repair",
    jurisdictions: ["US"],
    escalationTier: "legal_counsel",
    authorities: ["FTC", "CFPB", "state-AGs"],
    banOutcomeGuarantees: true,
  },
  {
    slug: "finance_securities",
    display: "Securities / investing / ICO / token sales",
    category: "financial",
    reasonCode: "regulated.finance.securities",
    jurisdictions: ["US", "EU", "UK", "CA", "AU", "GLOBAL"],
    escalationTier: "legal_counsel",
    authorities: ["SEC", "FINRA", "ESMA", "FCA"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },

  // ── Insurance ─────────────────────────────────────────────────────────
  {
    slug: "insurance_life",
    display: "Life insurance",
    category: "insurance",
    reasonCode: "regulated.insurance.life",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-insurance-commissioners", "NAIC"],
    requiresLicenseProof: true,
  },
  {
    slug: "insurance_health",
    display: "Health insurance",
    category: "insurance",
    reasonCode: "regulated.insurance.health",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-insurance-commissioners", "CMS", "NAIC"],
    requiresLicenseProof: true,
  },
  {
    slug: "insurance_pc",
    display: "Property & casualty insurance",
    category: "insurance",
    reasonCode: "regulated.insurance.pc",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "tier_2_lead",
    authorities: ["state-insurance-commissioners", "NAIC"],
    requiresLicenseProof: true,
  },

  // ── Legal ─────────────────────────────────────────────────────────────
  {
    slug: "legal_personal_injury",
    display: "Personal injury law",
    category: "legal",
    reasonCode: "regulated.legal.personal_injury",
    jurisdictions: ["US", "CA", "UK", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-bar", "ABA-Model-Rules-7.x"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "legal_family",
    display: "Family law",
    category: "legal",
    reasonCode: "regulated.legal.family",
    jurisdictions: ["US", "CA", "UK", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-bar", "ABA-Model-Rules-7.x"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "legal_dui",
    display: "DUI defense",
    category: "legal",
    reasonCode: "regulated.legal.dui",
    jurisdictions: ["US", "CA"],
    escalationTier: "legal_counsel",
    authorities: ["state-bar"],
    banOutcomeGuarantees: true,
    requiresLicenseProof: true,
  },
  {
    slug: "legal_employment",
    display: "Employment / labor law",
    category: "legal",
    reasonCode: "regulated.legal.employment",
    jurisdictions: ["US", "EU", "UK", "CA", "AU"],
    escalationTier: "legal_counsel",
    authorities: ["state-bar", "EEOC", "DOL"],
    requiresLicenseProof: true,
  },

  // ── Employment / Credit (EU AI Act §III-1, US ECOA + FCRA) ─────────────
  {
    slug: "employment_screening",
    display: "Employment / hiring / AI-assisted recruiting (high-risk AI per EU AI Act)",
    category: "employment",
    reasonCode: "regulated.ai_act.employment",
    jurisdictions: ["EU", "UK", "US", "US-NY"], // NYC Local Law 144 + EU AI Act
    escalationTier: "legal_counsel",
    authorities: ["EU-AI-Act-Annex-III-§4", "EEOC", "NYC-DCWP-LL144"],
  },
  {
    slug: "credit_underwriting",
    display: "Credit underwriting / lending decisions (high-risk AI per EU AI Act)",
    category: "credit",
    reasonCode: "regulated.ai_act.credit",
    jurisdictions: ["EU", "UK", "US"],
    escalationTier: "legal_counsel",
    authorities: ["EU-AI-Act-Annex-III-§5b", "ECOA", "FCRA", "CFPB"],
  },
] as const;

const VERTICAL_BY_SLUG = new Map(REGULATED_VERTICALS.map((v) => [v.slug, v]));

export function isRegulatedVertical(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return VERTICAL_BY_SLUG.has(slug);
}

export function getRegulatedVertical(slug: string): RegulatedVertical | undefined {
  return VERTICAL_BY_SLUG.get(slug);
}

/** Returns all regulated verticals applicable to a given jurisdiction. */
export function regulatedVerticalsFor(jurisdiction: Jurisdiction): RegulatedVertical[] {
  return REGULATED_VERTICALS.filter(
    (v) => v.jurisdictions.includes(jurisdiction) || v.jurisdictions.includes("GLOBAL"),
  );
}

/** Fast lookup: requires license proof? */
export function requiresLicenseProof(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return VERTICAL_BY_SLUG.get(slug)?.requiresLicenseProof === true;
}

/** Fast lookup: bans before/after imagery? */
export function bansBeforeAfterImagery(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return VERTICAL_BY_SLUG.get(slug)?.banBeforeAfterImagery === true;
}

/** Fast lookup: bans outcome guarantees? */
export function bansOutcomeGuarantees(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return VERTICAL_BY_SLUG.get(slug)?.banOutcomeGuarantees === true;
}
