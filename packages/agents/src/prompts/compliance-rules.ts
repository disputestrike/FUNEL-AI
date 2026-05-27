/**
 * Compliance rules library (excerpted).
 *
 * In production the Compliance agent retrieves rules from pgvector
 * (`compliance_rules({geography, industry, archetype})`). This file is the
 * inline fallback used when KB retrieval is unavailable, and the rule index
 * referenced by every Compliance finding's `ruleId`. The full ruleset lives
 * in docs/21-compliance-rules-library.md.
 */

export interface ComplianceRule {
  id: string;
  geography: string[]; // ISO-3166 codes or 'EU', 'GLOBAL'
  industries: string[]; // 'all' | specific industries
  archetypes?: string[];
  severity: "block" | "fix" | "note";
  title: string;
  summary: string;
  examples?: string[];
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // FTC — endorsements & testimonials
  {
    id: "US-FTC-ENDORSE-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "Material connection disclosure required",
    summary:
      "Endorsements must disclose any material connection between the endorser and the advertiser. Compensated, gifted, or employee endorsements require clear and conspicuous disclosure (FTC 16 CFR Part 255).",
    examples: ["Paid testimonial without #ad", "Employee review presented as customer"],
  },
  {
    id: "US-FTC-CLAIMS-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "Substantiation for objective claims",
    summary:
      "Any specific factual claim (numbers, percentages, scientific claims) must be substantiated with reliable evidence at the time the claim is made. Unsubstantiated quantitative claims constitute a deceptive practice.",
  },
  {
    id: "US-FTC-NEG-OPT-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "Negative-option marketing disclosure (ROSCA)",
    summary:
      "Any recurring-billing offer must clearly disclose material terms, get express informed consent before charging, and provide a simple mechanism to cancel.",
  },

  // TCPA — telephony/SMS
  {
    id: "US-TCPA-SMS-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "Prior express written consent for marketing SMS",
    summary:
      "Telephone Consumer Protection Act requires prior express written consent before sending marketing SMS via automated systems. STOP keyword must work; opt-in language must be unambiguous.",
  },
  {
    id: "US-TCPA-CALL-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "AI voice disclosure",
    summary:
      "FCC ruling (Feb 2024) classifies AI-generated voice calls as 'artificial' under TCPA. Callers must disclose that the caller is artificial intelligence at the start of the call.",
  },
  {
    id: "US-TCPA-2PARTY-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "Two-party consent for call recording",
    summary:
      "California, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Pennsylvania, and Washington require all parties to consent to call recording. AI voice scripts must include a recording-disclosure line.",
  },

  // CAN-SPAM
  {
    id: "US-CANSPAM-01",
    geography: ["US"],
    industries: ["all"],
    severity: "block",
    title: "CAN-SPAM compliant footer required",
    summary:
      "Every commercial email must include a clear opt-out mechanism, the sender's valid physical postal address, and accurate header/subject information.",
  },

  // GDPR / UCPD
  {
    id: "EU-GDPR-CONSENT-01",
    geography: ["EU", "DE", "FR", "IT", "ES", "NL"],
    industries: ["all"],
    severity: "block",
    title: "Lawful basis for personal data processing",
    summary:
      "Forms collecting personal data must declare the lawful basis (Article 6). Marketing emails require freely-given, specific, informed, unambiguous opt-in (Article 7). Pre-checked boxes invalid.",
  },
  {
    id: "EU-UCPD-01",
    geography: ["EU"],
    industries: ["all"],
    severity: "block",
    title: "No misleading commercial practices",
    summary:
      "Unfair Commercial Practices Directive 2005/29/EC prohibits misleading actions and omissions, including false urgency, fake scarcity, and undisclosed paid endorsements.",
  },

  // CASL — Canada
  {
    id: "CA-CASL-01",
    geography: ["CA"],
    industries: ["all"],
    severity: "block",
    title: "Express or implied consent required",
    summary:
      "Canadian Anti-Spam Law requires express consent (or documented implied consent) before sending commercial electronic messages. Identification, contact information, and unsubscribe mechanism mandatory.",
  },

  // HIPAA (health-adjacent)
  {
    id: "US-HIPAA-01",
    geography: ["US"],
    industries: ["health", "med_spa", "dental", "chiropractic", "cosmetic_surgery"],
    severity: "block",
    title: "No PHI in marketing without authorization",
    summary:
      "Protected Health Information cannot be used for marketing communications without HIPAA-compliant written authorization. Health-related testimonials require explicit, signed authorization on file.",
  },

  // FINRA / Investment advisor
  {
    id: "US-SEC-IA-01",
    geography: ["US"],
    industries: ["financial_advisor", "insurance"],
    severity: "block",
    title: "Investment advisor marketing rule",
    summary:
      "SEC Marketing Rule (206(4)-1) requires testimonials to disclose compensation, conflicts, and that prior performance is not indicative of future results. Hypothetical performance presentations require additional disclosures.",
  },

  // State insurance
  {
    id: "US-NAIC-INS-01",
    geography: ["US"],
    industries: ["insurance"],
    severity: "block",
    title: "State insurance advertising rules",
    summary:
      "Each state's insurance commissioner imposes advertising rules. License number must be displayed; cannot use 'guaranteed' or 'risk-free' for insurance products; cannot imply government endorsement.",
  },

  // Legal services
  {
    id: "US-ABA-LEGAL-01",
    geography: ["US"],
    industries: ["legal"],
    severity: "block",
    title: "Attorney advertising rules (state bar)",
    summary:
      "ABA Model Rule 7.1 / each state bar prohibits false or misleading communications about legal services. No 'best,' 'specialist' (without certification), or guarantee of outcome.",
  },

  // Geographic restraint flags
  {
    id: "DE-RESTRAINED-01",
    geography: ["DE"],
    industries: ["all"],
    severity: "fix",
    title: "German market: restrained tone",
    summary:
      "German market expects restrained advertising tone. Avoid superlatives ('best', 'top', 'fastest') without verifiable benchmarks. No exclamation marks in body copy.",
  },
  {
    id: "QC-FR-LANGUAGE-01",
    geography: ["CA"],
    industries: ["all"],
    severity: "fix",
    title: "Quebec French-language requirement",
    summary:
      "Quebec Charter of the French Language (Bill 96) requires commercial communications in Quebec to be in French, or French markedly predominant over English.",
  },

  // Tripwire / pricing
  {
    id: "GLOBAL-TRIPWIRE-REG-01",
    geography: ["US", "EU", "CA", "UK", "AU"],
    industries: ["financial_advisor", "legal", "med_spa", "cosmetic_surgery"],
    archetypes: ["tripwire"],
    severity: "block",
    title: "Tripwire archetype not permitted for regulated verticals",
    summary:
      "Regulated verticals cannot use $7/$27 tripwire pricing patterns without explicit compliance review.",
  },
];

export function rulesForGeography(geo: string, industry: string, archetype?: string): ComplianceRule[] {
  return COMPLIANCE_RULES.filter((r) => {
    const geoMatch = r.geography.includes(geo) || r.geography.includes("EU") || r.geography.includes("GLOBAL");
    const indMatch = r.industries.includes("all") || r.industries.includes(industry);
    const archMatch = !r.archetypes || (archetype && r.archetypes.includes(archetype));
    return geoMatch && indMatch && archMatch;
  });
}

export function rulesAsContext(rules: ComplianceRule[]): string {
  return rules
    .map((r) => `[${r.id}] (${r.severity}) ${r.title}\n  ${r.summary}`)
    .join("\n\n");
}
