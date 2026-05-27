/**
 * Compliance rules library.
 *
 * For each regulated vertical (and a default catch-all): prohibited claim
 * patterns, required disclosures, geo overlays, and ok/bad examples. Used by
 * the Compliance agent + the rules pre-filter to flag content before LLM
 * review.
 *
 * Patterns are intentionally redundant with the agent's LLM judgment â€” the
 * regex/keyword layer is cheap, fast, deterministic, and gives us deny-list
 * coverage even if the LLM hallucinates. The LLM provides nuance on top.
 *
 * Source: docs/21-compliance-rules-library.md, 07a, 05e, 02a KB pack.
 */

import type { Jurisdiction } from "./regulated-verticals.js";

export type RuleSeverity = "block" | "human_review" | "warn";

export interface ProhibitedClaimRule {
  /** Stable ID used in audit logs and reviewer dashboards. */
  id: string;
  /** Plain English description. */
  description: string;
  /** Regex patterns (case-insensitive) that fire this rule. */
  patterns: RegExp[];
  /** Severity â€” `block` aborts generation, `human_review` queues, `warn` annotates. */
  severity: RuleSeverity;
  /** Authority citation. */
  authority: string;
}

export interface RequiredDisclosure {
  id: string;
  /** Where it must appear. */
  surface: "every_page" | "ad_creative" | "voice_preamble" | "sms_first_message" | "email_footer" | "checkout_flow";
  /** Sample / canonical text. */
  text: string;
  authority: string;
}

export interface GeoOverlay {
  jurisdiction: Jurisdiction;
  /** Additional prohibited rules layered on top of vertical defaults. */
  additionalProhibited?: ProhibitedClaimRule[];
  /** Additional required disclosures. */
  additionalDisclosures?: RequiredDisclosure[];
  /** Free-form note for reviewer dashboard. */
  notes?: string;
}

export interface ComplianceExample {
  ok: string;
  bad: string;
  rule: string;
}

export interface VerticalRuleset {
  verticalSlug: string;
  prohibited: ProhibitedClaimRule[];
  required: RequiredDisclosure[];
  geoOverlays: GeoOverlay[];
  examples: ComplianceExample[];
}

// â”€â”€ Shared rule fragments (re-used across verticals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GUARANTEE = /\b(guarantee[ds]?|guaranteed|guaranteeing|100\s*%\s*guarantee|money[\s-]?back\s+guarantee)\b/i;
const OUTCOME_GUARANTEE =
  /\b(guarantee[ds]?|guaranteed)\s+(?:approval|results?|outcomes?|weight\s+loss|cure|reduction|refund|earnings?|income|return|roi|qualify|qualified|qualification|verdict|win|settlement|leads?|sales?)/i;
const CURE_PROMISE = /\b(cure[ds]?|reverses?|eliminates?|heals?|treats?)\s+(?:cancer|diabetes|hypertension|alzheimer|depression|anxiety|adhd|ptsd|copd|chronic|disease|disorder|symptoms?)/i;
const FDA_FALSE = /\bFDA[-\s]?approved\b/i;
const NUMERIC_GUARANTEE =
  /\$?[\d,]+(?:\.\d+)?(?:k|K|m|M)?\s*(?:per\s+(?:day|week|month|year)|\/(?:day|week|month|year)|monthly|yearly|daily|weekly)\s*[^.]{0,40}(?:guarantee[ds]?|promised|promise)/i;
const RISK_FREE = /\b(risk[\s-]?free|zero\s+risk|no\s+risk)\b/i;
const URGENCY = /\b(act\s+(?:now|within\s+24\s+hours?)|final\s+notice|account\s+will\s+be\s+suspended|verify\s+now\s+or\s+lose|limited\s+time\s+to\s+claim)\b/i;

// â”€â”€ HEALTHCARE â€” generic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HEALTHCARE_GENERIC: VerticalRuleset = {
  verticalSlug: "healthcare_general",
  prohibited: [
    {
      id: "h1.cure_promise",
      description: "Promises to cure / reverse / eliminate disease.",
      patterns: [CURE_PROMISE],
      severity: "block",
      authority: "FTC Act Â§5 + FDA 21 USC Â§343",
    },
    {
      id: "h2.fda_approved_false",
      description: "Generic 'FDA-approved' without verified clearance for THIS product.",
      patterns: [FDA_FALSE],
      severity: "human_review",
      authority: "FDA 21 CFR Â§1.21",
    },
    {
      id: "h3.outcome_guarantee",
      description: "Outcome guarantee on medical results.",
      patterns: [OUTCOME_GUARANTEE],
      severity: "block",
      authority: "FTC Health Claims Substantiation Guidance",
    },
    {
      id: "h4.implied_diagnosis",
      description: "Copy implies the AI diagnosed or treated the viewer.",
      patterns: [
        /\b(?:we|i|our\s+ai)\s+(?:diagnos|prescrib|treat)/i,
        /\bget\s+your\s+(?:rx|prescription)\s+today\b/i,
      ],
      severity: "human_review",
      authority: "state-medical-board telemedicine rules",
    },
  ],
  required: [
    {
      id: "h.disclaimer.individual_results",
      surface: "every_page",
      text:
        "Individual results vary. This site is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.",
      authority: "FTC Endorsement Guide Â§255.2",
    },
    {
      id: "h.disclaimer.ai_disclosure",
      surface: "every_page",
      text: "Content on this page was generated with the assistance of AI and reviewed by the operator.",
      authority: "FTC AI Disclosure + EU AI Act Art. 50",
    },
  ],
  geoOverlays: [
    {
      jurisdiction: "EU",
      additionalDisclosures: [
        {
          id: "h.eu.gdpr",
          surface: "every_page",
          text:
            "We process health-related data as defined by GDPR Article 9. See our Privacy Notice for the legal basis and your rights.",
          authority: "GDPR Art. 9",
        },
      ],
    },
    {
      jurisdiction: "US",
      notes: "HIPAA covered entities must maintain a separate Notice of Privacy Practices.",
    },
  ],
  examples: [
    { ok: "may help support healthy weight", bad: "guaranteed 20 lbs lost in 30 days", rule: "h3.outcome_guarantee" },
    { ok: "talk to a licensed clinician about options", bad: "cure diabetes naturally", rule: "h1.cure_promise" },
    {
      ok: "FDA-cleared device for X (510(k) K123456)",
      bad: "100% FDA-approved miracle pill",
      rule: "h2.fda_approved_false",
    },
  ],
};

// â”€â”€ GLP-1 (more stringent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GLP1: VerticalRuleset = {
  verticalSlug: "healthcare_glp1",
  prohibited: [
    {
      id: "glp1.efficacy_number",
      description: "Specific weight-loss numeric outcome claim.",
      patterns: [/\b(?:lose|drop|shed)\s+\d+\s*(?:lbs?|pounds?|kgs?|kilos?)\b/i, /\b\d+%\s+weight\s+loss\b/i],
      severity: "block",
      authority: "FDA 21 CFR Â§202.1 + FTC Health Claims",
    },
    {
      id: "glp1.ozempic_for_everyone",
      description: "Universal eligibility / 'for everyone' framing.",
      patterns: [/\bOzempic\s+for\s+everyone\b/i, /\bsemaglutide\s+for\s+all\b/i, /\bGLP[-\s]?1\s+for\s+anyone\b/i],
      severity: "block",
      authority: "FDA labeling requirements",
    },
    {
      id: "glp1.compound_misleading",
      description: "Compounded GLP-1 marketed as equivalent to brand-name without disclosure.",
      patterns: [/\bsame\s+as\s+(?:Ozempic|Wegovy|Mounjaro|Zepbound)\b/i, /\bgeneric\s+(?:Ozempic|Wegovy)\b/i],
      severity: "block",
      authority: "FDA compounding rules + state-pharmacy-board",
    },
    {
      id: "glp1.guarantee",
      description: "Outcome guarantees.",
      patterns: [OUTCOME_GUARANTEE],
      severity: "block",
      authority: "FTC Act Â§5",
    },
  ],
  required: [
    {
      id: "glp1.disclaimer.rx",
      surface: "every_page",
      text:
        "Prescription required. GLP-1 medications are only available after evaluation by a licensed clinician and may not be appropriate for everyone. Side effects can be serious.",
      authority: "FDA REMS / labeling",
    },
    ...HEALTHCARE_GENERIC.required,
  ],
  geoOverlays: HEALTHCARE_GENERIC.geoOverlays,
  examples: [
    {
      ok: "If you qualify after a medical evaluation, GLP-1 therapy may be one option among many.",
      bad: "Lose 30 lbs in 90 days with our GLP-1 program â€” guaranteed.",
      rule: "glp1.efficacy_number",
    },
  ],
};

// â”€â”€ FINANCIAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FINANCE_ADVISORS: VerticalRuleset = {
  verticalSlug: "finance_advisors",
  prohibited: [
    {
      id: "f1.return_guarantee",
      description: "Guaranteed investment returns.",
      patterns: [/\bguaranteed\s+\d+(?:\.\d+)?%/i, OUTCOME_GUARANTEE, NUMERIC_GUARANTEE],
      severity: "block",
      authority: "SEC Rule 206(4)-1 (Marketing Rule)",
    },
    {
      id: "f2.no_risk",
      description: "Risk-free framing on securities or investing.",
      patterns: [RISK_FREE],
      severity: "block",
      authority: "SEC Marketing Rule",
    },
    {
      id: "f3.past_performance",
      description: "Past performance without required disclaimer.",
      patterns: [/\b(?:past\s+performance|returned|generated)\s+\d{2,}\s*%/i],
      severity: "human_review",
      authority: "SEC Marketing Rule Â§206(4)-1(d)(2)",
    },
    {
      id: "f4.testimonial_without_disclosure",
      description: "Client testimonial with $/return numbers without sponsorship + non-typicality disclosure.",
      patterns: [/"[^"]*\$[\d,]+[^"]*"/i, /\bclient\s+earned\b/i],
      severity: "human_review",
      authority: "SEC Marketing Rule",
    },
  ],
  required: [
    {
      id: "f.disclaimer.no_advice",
      surface: "every_page",
      text:
        "This material is for informational purposes only and is not investment, legal, or tax advice. Past performance is not a guarantee of future results. Investing involves risk including loss of principal.",
      authority: "SEC Rule 206(4)-1",
    },
    {
      id: "f.disclaimer.disclosure_brochure",
      surface: "every_page",
      text:
        "[Firm name] is a registered investment adviser. Form ADV brochure available at adviserinfo.sec.gov or upon request.",
      authority: "SEC Form ADV",
    },
  ],
  geoOverlays: [
    {
      jurisdiction: "EU",
      additionalDisclosures: [
        {
          id: "f.eu.mifid",
          surface: "every_page",
          text: "Capital at risk. Not financial advice. Not regulated by the FCA / authorised by [home regulator].",
          authority: "MiFID II + ESMA guidelines",
        },
      ],
    },
  ],
  examples: [
    {
      ok: "Historical returns shown are gross of fees; past performance is not a guarantee of future results.",
      bad: "Guaranteed 12% annual return.",
      rule: "f1.return_guarantee",
    },
  ],
};

// â”€â”€ LEGAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LEGAL_PERSONAL_INJURY: VerticalRuleset = {
  verticalSlug: "legal_personal_injury",
  prohibited: [
    {
      id: "l1.win_guarantee",
      description: "Guaranteed verdict / settlement amounts.",
      patterns: [
        /\bguarantee[ds]?\s+(?:win|verdict|settlement|recovery)/i,
        /\bwe\s+(?:will\s+win|guarantee\s+(?:you|to\s+win))/i,
      ],
      severity: "block",
      authority: "ABA Model Rule 7.1 (state bar advertising rules)",
    },
    {
      id: "l2.specific_dollar_results_no_disclaimer",
      description: "Specific past-result dollar figures without required disclaimer.",
      patterns: [/\$\s?[\d,]+(?:\.\d+)?(?:\s+million|m|M)?\s+(?:verdict|settlement|recovery|won)/i],
      severity: "human_review",
      authority: "ABA Model Rule 7.1 (state-by-state)",
    },
    {
      id: "l3.specialist_unverified",
      description: "Use of 'specialist' or 'expert' without state bar certification.",
      patterns: [/\b(?:certified\s+specialist|legal\s+expert|trial\s+expert)\b/i],
      severity: "human_review",
      authority: "ABA Model Rule 7.4",
    },
    {
      id: "l4.no_recovery_no_fee_mismatch",
      description: "'No fee unless we win' without disclosure of costs/expenses customer still owes.",
      patterns: [/\bno\s+(?:fee|fees|win)\s+(?:unless|until)\s+(?:we\s+)?win\b/i],
      severity: "warn",
      authority: "state bar (most jurisdictions require cost disclosure)",
    },
  ],
  required: [
    {
      id: "l.disclaimer.attorney_advertising",
      surface: "every_page",
      text:
        "Attorney advertising. Prior results do not guarantee a similar outcome. This site does not provide legal advice and does not create an attorney-client relationship.",
      authority: "ABA Model Rule 7.1 + 7.3",
    },
    {
      id: "l.disclaimer.firm_address",
      surface: "every_page",
      text: "[Firm name], [physical address], [responsible attorney]. Licensed in [states].",
      authority: "ABA Model Rule 7.2(c)",
    },
  ],
  geoOverlays: [
    {
      jurisdiction: "US-NY",
      additionalDisclosures: [
        {
          id: "l.ny.disclaimer",
          surface: "every_page",
          text: "Attorney Advertising. Prior results do not guarantee a similar outcome.",
          authority: "22 NYCRR Â§1200, Rule 7.1(e)(3)",
        },
      ],
    },
    {
      jurisdiction: "US-FL",
      notes:
        "Florida Bar Rule 4-7.13 prohibits testimonials about quality of representation without disclaimer.",
    },
  ],
  examples: [
    {
      ok: "We've recovered over $X million for our clients. Prior results do not guarantee a similar outcome.",
      bad: "We guarantee a win or you pay nothing.",
      rule: "l1.win_guarantee",
    },
  ],
};

// â”€â”€ INSURANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INSURANCE_LIFE: VerticalRuleset = {
  verticalSlug: "insurance_life",
  prohibited: [
    {
      id: "ins1.guarantee_approval",
      description: "Guaranteed approval / no underwriting.",
      patterns: [/\bguaranteed?\s+approval\b/i, /\bno\s+(?:medical\s+)?underwriting\b/i],
      severity: "human_review",
      authority: "state insurance-commissioner advertising rules + NAIC Model 570",
    },
    {
      id: "ins2.misleading_rate",
      description: "Rate quotes without 'rates may vary' disclosure.",
      patterns: [/\b(?:as\s+low\s+as|starting\s+at)\s+\$\d+/i],
      severity: "warn",
      authority: "NAIC Advertising Rule",
    },
  ],
  required: [
    {
      id: "ins.disclaimer.license",
      surface: "every_page",
      text: "Licensed insurance agent. License #[state-license-number]. Licensed in [states list].",
      authority: "state insurance commissioners",
    },
  ],
  geoOverlays: [],
  examples: [
    { ok: "Most applicants qualify subject to underwriting.", bad: "Guaranteed approval, no questions.", rule: "ins1.guarantee_approval" },
  ],
};

// â”€â”€ CREDIT REPAIR (CROA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CREDIT_REPAIR: VerticalRuleset = {
  verticalSlug: "finance_credit_repair",
  prohibited: [
    {
      id: "cr1.score_guarantee",
      description: "Promises specific credit score increases.",
      patterns: [/\b(?:raise|boost|increase|add)\s+(?:your\s+)?(?:credit\s+)?score\s+(?:by\s+)?\d+\s*(?:points|pts)\b/i, OUTCOME_GUARANTEE],
      severity: "block",
      authority: "FTC Credit Repair Organizations Act (CROA) 15 USC Â§1679b",
    },
    {
      id: "cr2.advance_fee",
      description: "Requests advance fees before services rendered (CROA-prohibited).",
      patterns: [/\bpay\s+(?:upfront|in\s+advance)\b/i],
      severity: "block",
      authority: "CROA 15 USC Â§1679b(b)",
    },
    {
      id: "cr3.remove_accurate_info",
      description: "Promises to remove accurate negative info.",
      patterns: [/\bremove\s+(?:all\s+)?(?:bankruptc|negative|late|collection)/i],
      severity: "human_review",
      authority: "FCRA + CROA",
    },
  ],
  required: [
    {
      id: "cr.disclaimer.croa",
      surface: "every_page",
      text:
        "Consumer Credit File Rights Under State and Federal Law. You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly. You have a right to obtain a copy of your credit report from a consumer reporting agency...",
      authority: "CROA 15 USC Â§1679c(a)",
    },
  ],
  geoOverlays: [],
  examples: [{ ok: "Help reviewing and disputing inaccurate items.", bad: "We guarantee +120 points in 30 days.", rule: "cr1.score_guarantee" }],
};

// â”€â”€ DEFAULT (every workspace, regulated or not) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_RULES: VerticalRuleset = {
  verticalSlug: "_default",
  prohibited: [
    {
      id: "d1.numeric_income_guarantee",
      description: "Specific numeric income guarantees.",
      patterns: [NUMERIC_GUARANTEE, /\bmake\s+\$[\d,]+\s+per\s+(?:day|week|month)\s+guaranteed?/i],
      severity: "block",
      authority: "FTC Business Opportunity Rule + FTC Endorsement Guide",
    },
    {
      id: "d2.passive_income_autopilot",
      description: "Passive-income-on-autopilot claims with $ figures.",
      patterns: [/\bpassive\s+income\s+(?:on\s+)?autopilot\s+\$[\d,]+/i],
      severity: "block",
      authority: "FTC Business Opportunity Rule",
    },
    {
      id: "d3.urgency_credential_request",
      description: "Urgency + credential request combo.",
      patterns: [URGENCY],
      severity: "human_review",
      authority: "FTC Act Â§5 (deceptive practices)",
    },
    {
      id: "d4.superlative_unsubstantiated",
      description: "Best/#1/leading without same-artifact substantiation.",
      patterns: [/\b(?:the\s+)?(?:best|#1|number\s+one|top[-\s]rated|leading|world[-\s]class)\b/i],
      severity: "warn",
      authority: "FTC Endorsement Guide Â§255",
    },
    {
      id: "d5.fake_scarcity",
      description: "Fake scarcity like 'only X spots left' without enforceable cap.",
      patterns: [/\bonly\s+\d+\s+(?:spots?|seats?|left|remaining)\b/i],
      severity: "warn",
      authority: "FTC Act Â§5",
    },
  ],
  required: [
    {
      id: "d.ai_disclosure",
      surface: "every_page",
      text: "Generated with GoFunnelAI â€” reviewed by [operator].",
      authority: "FTC AI Disclosure + EU AI Act Art. 50",
    },
    {
      id: "d.tcpa_optout",
      surface: "sms_first_message",
      text: "Reply STOP to unsubscribe. Msg & data rates may apply.",
      authority: "TCPA 47 USC Â§227 + CTIA Best Practices",
    },
    {
      id: "d.canspam_address",
      surface: "email_footer",
      text:
        "You received this email because you opted in at [URL]. [Physical mailing address]. Unsubscribe: [link].",
      authority: "CAN-SPAM 16 CFR Â§316",
    },
  ],
  geoOverlays: [
    {
      jurisdiction: "EU",
      additionalDisclosures: [
        {
          id: "d.eu.gdpr_legal_basis",
          surface: "every_page",
          text:
            "We process personal data under GDPR. See our Privacy Notice for the legal basis (Art. 6) and your rights.",
          authority: "GDPR Art. 13/14",
        },
        {
          id: "d.eu.aiact_synthetic_label",
          surface: "every_page",
          text: "This content was generated by an AI system. (EU AI Act Art. 50)",
          authority: "EU AI Act Art. 50",
        },
      ],
    },
  ],
  examples: [
    {
      ok: "Some customers report saving up to $X per month.",
      bad: "Guaranteed $5,000/month on autopilot.",
      rule: "d1.numeric_income_guarantee",
    },
    { ok: "may qualify after evaluation", bad: "guaranteed approval", rule: "ins1.guarantee_approval" },
  ],
};

const RULESETS: VerticalRuleset[] = [
  DEFAULT_RULES,
  HEALTHCARE_GENERIC,
  GLP1,
  FINANCE_ADVISORS,
  LEGAL_PERSONAL_INJURY,
  INSURANCE_LIFE,
  CREDIT_REPAIR,
];

const BY_SLUG = new Map(RULESETS.map((r) => [r.verticalSlug, r]));

export function getRuleset(verticalSlug: string | null | undefined): VerticalRuleset {
  if (!verticalSlug) return DEFAULT_RULES;
  return BY_SLUG.get(verticalSlug) ?? DEFAULT_RULES;
}

export function getAllRulesets(): readonly VerticalRuleset[] {
  return RULESETS;
}

export interface RuleHit {
  ruleId: string;
  description: string;
  severity: RuleSeverity;
  matched: string;
  authority: string;
}

/**
 * Pre-LLM regex/keyword pass over a content blob.
 * Combines default + vertical-specific + applicable geo overlays.
 */
export function scanForViolations(
  content: string,
  verticalSlug: string | null | undefined,
  jurisdictions: readonly Jurisdiction[] = ["US"],
): RuleHit[] {
  const hits: RuleHit[] = [];
  const sets: VerticalRuleset[] = [DEFAULT_RULES];
  if (verticalSlug && verticalSlug !== "_default") {
    const vs = BY_SLUG.get(verticalSlug);
    if (vs) sets.push(vs);
  }

  for (const set of sets) {
    for (const rule of set.prohibited) {
      for (const pat of rule.patterns) {
        const m = content.match(pat);
        if (m) {
          hits.push({
            ruleId: rule.id,
            description: rule.description,
            severity: rule.severity,
            matched: m[0].slice(0, 200),
            authority: rule.authority,
          });
          break; // one hit per rule is enough
        }
      }
    }
    // geo overlay rules
    for (const overlay of set.geoOverlays) {
      if (!jurisdictions.includes(overlay.jurisdiction)) continue;
      for (const rule of overlay.additionalProhibited ?? []) {
        for (const pat of rule.patterns) {
          if (pat.test(content)) {
            hits.push({
              ruleId: rule.id,
              description: rule.description,
              severity: rule.severity,
              matched: content.match(pat)?.[0].slice(0, 200) ?? "",
              authority: rule.authority,
            });
            break;
          }
        }
      }
    }
  }
  return hits;
}

/** Returns required disclosures for a vertical + jurisdictions combo. */
export function getRequiredDisclosures(
  verticalSlug: string | null | undefined,
  jurisdictions: readonly Jurisdiction[] = ["US"],
): RequiredDisclosure[] {
  const out = new Map<string, RequiredDisclosure>();
  const add = (d: RequiredDisclosure): void => {
    out.set(d.id, d);
  };
  for (const d of DEFAULT_RULES.required) add(d);
  if (verticalSlug && verticalSlug !== "_default") {
    const vs = BY_SLUG.get(verticalSlug);
    if (vs) {
      for (const d of vs.required) add(d);
      for (const o of vs.geoOverlays) {
        if (jurisdictions.includes(o.jurisdiction)) for (const d of o.additionalDisclosures ?? []) add(d);
      }
    }
  }
  for (const o of DEFAULT_RULES.geoOverlays) {
    if (jurisdictions.includes(o.jurisdiction)) for (const d of o.additionalDisclosures ?? []) add(d);
  }
  return [...out.values()];
}
